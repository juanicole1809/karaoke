import { createContextLogger } from '@/utils/logger';
import type { DeclaredSong, SongRequestCandidate } from '@vkara/validators';

const logger = createContextLogger('SongRequestAgent');

export type AgentProvider = 'anthropic' | 'openai';

export interface AgentOptions {
    provider: AgentProvider;
    apiKey: string;
    model?: string;
    baseUrl?: string;
    timeoutMs?: number;
}

export interface AgentJudgeResult {
    videoId: string;
    confidence: number;
    isKaraoke: boolean;
    reasons: string[];
}

const DEFAULT_MODELS: Record<AgentProvider, string> = {
    anthropic: 'claude-3-5-haiku-latest',
    openai: 'gpt-4o-mini',
};

const JUDGE_SYSTEM_PROMPT = `You are a karaoke song judge for a party app. Guests declare a song and artist, and the system finds YouTube candidates. Your job: decide which candidates are actual KARAOKE versions of the DECLARED song.

A karaoke version means:
- Instrumental backing track (usually labeled "karaoke", "instrumental", "backing track", "minus one", "pista", "sin voz", "base musical")
- Ideally with lyrics overlay (subtitles) or at least clearly a sing-along track
- NOT the official music video, official audio, lyric video (vocals + lyrics), live performance, cover by a different artist, tutorial, remix, or reaction

Rules:
- The candidate must be the SAME song by the SAME artist (or an explicit instrumental/karaoke cover by another channel that is clearly of that song). Covers of the song by random people are usually NOT what the party wants unless it's an instrumental karaoke track.
- Assign confidence 0..1: probability that adding this video gives the party a good karaoke experience of the declared song.
- Reasons must be short, human-readable strings in English (max ~8 words each), e.g. "Explicit karaoke track", "Wrong song", "Official music video".
- Return STRICT JSON only, no markdown fences, no commentary: a JSON array of exactly one object per candidate, in the same order: [{"videoId": "...", "confidence": 0.0, "isKaraoke": true, "reasons": ["...", "..."]}]`;

function buildUserPrompt(declaration: DeclaredSong, candidates: SongRequestCandidate[]): string {
    const list = candidates
        .map(
            (c, i) =>
                `${i + 1}. videoId=${c.video.id}\n   title="${c.video.title}"\n   channel="${c.video.channels?.[0]?.name ?? 'N/A'}"\n   duration=${c.video.duration}s views=${c.video.views}`,
        )
        .join('\n');

    return `DECLARED SONG: "${declaration.raw}"\n(title part: "${declaration.title}"${declaration.artist ? `, artist part: "${declaration.artist}"` : ''})\n\nCANDIDATES:\n${list}\n\nReturn the JSON array now.`;
}

/** Extract a JSON array from an LLM response that may include fences/commentary. */
function extractJsonArray(text: string): Array<Record<string, unknown>> | null {
    const cleaned = text.replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('[');
    if (start === -1) return null;
    const end = cleaned.lastIndexOf(']');
    if (end <= start) return null;
    try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : null;
    } catch {
        return null;
    }
}

function normalizeResult(
    raw: Record<string, unknown>,
    videoIds: string[],
): AgentJudgeResult | null {
    const videoId = typeof raw.videoId === 'string' ? raw.videoId : '';
    if (!videoIds.includes(videoId)) return null;

    const confidence =
        typeof raw.confidence === 'number'
            ? Math.max(0, Math.min(1, raw.confidence))
            : typeof raw.confidence === 'string'
              ? Math.max(0, Math.min(1, Number(raw.confidence) || 0))
              : 0;

    const isKaraoke = raw.isKaraoke === true || raw.isKaraoke === 'true';
    const reasons = Array.isArray(raw.reasons)
        ? raw.reasons.filter((r): r is string => typeof r === 'string').slice(0, 3)
        : [];

    return { videoId, confidence, isKaraoke, reasons };
}

async function callAnthropic(options: AgentOptions, userPrompt: string): Promise<string> {
    const baseUrl = options.baseUrl?.replace(/\/$/, '') ?? 'https://api.anthropic.com';
    const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: options.model ?? DEFAULT_MODELS.anthropic,
            max_tokens: 2048,
            system: JUDGE_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Anthropic ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (data.content ?? [])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('');
    if (!text) throw new Error('Anthropic returned empty text');
    return text;
}

async function callOpenAi(options: AgentOptions, userPrompt: string): Promise<string> {
    const baseUrl = options.baseUrl?.replace(/\/$/, '') ?? 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
            model: options.model ?? DEFAULT_MODELS.openai,
            temperature: 0,
            max_tokens: 2048,
            messages: [
                { role: 'system', content: JUDGE_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`OpenAI ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('OpenAI returned empty text');
    return text;
}

/**
 * Ask the LLM judge to re-rank the heuristic candidates.
 * Returns a partial map (videoId → judgment); candidates missing from the
 * response keep their heuristic scores. Throws if the LLM call fails entirely.
 */
export async function judgeWithAgent(
    options: AgentOptions,
    declaration: DeclaredSong,
    candidates: SongRequestCandidate[],
): Promise<Map<string, AgentJudgeResult>> {
    const userPrompt = buildUserPrompt(declaration, candidates);
    const raw = await (options.provider === 'anthropic'
        ? callAnthropic(options, userPrompt)
        : callOpenAi(options, userPrompt));

    const parsed = extractJsonArray(raw);
    if (!parsed || parsed.length === 0) {
        throw new Error('Agent response did not contain a JSON array');
    }

    const videoIds = candidates.map((c) => c.video.id);
    const results = new Map<string, AgentJudgeResult>();
    for (const entry of parsed) {
        const normalized = normalizeResult(entry, videoIds);
        if (normalized) {
            results.set(normalized.videoId, normalized);
        }
    }

    if (results.size === 0) {
        throw new Error('Agent response contained no valid judgments');
    }

    logger.info('Agent judged candidates', {
        declared: declaration.raw,
        candidates: candidates.length,
        judged: results.size,
    });

    return results;
}

export function agentOptionsFromEnv(env: {
    KARAOKE_AGENT_PROVIDER?: string;
    KARAOKE_AGENT_API_KEY?: string;
    KARAOKE_AGENT_MODEL?: string;
    KARAOKE_AGENT_BASE_URL?: string;
    KARAOKE_AGENT_TIMEOUT_MS?: number;
}): AgentOptions | null {
    const provider = env.KARAOKE_AGENT_PROVIDER ?? 'heuristic';
    if (provider === 'none' || provider === 'heuristic') return null;
    if (!env.KARAOKE_AGENT_API_KEY) return null;

    return {
        provider: provider as 'anthropic' | 'openai',
        apiKey: env.KARAOKE_AGENT_API_KEY,
        model: env.KARAOKE_AGENT_MODEL,
        baseUrl: env.KARAOKE_AGENT_BASE_URL,
        timeoutMs: env.KARAOKE_AGENT_TIMEOUT_MS,
    };
}