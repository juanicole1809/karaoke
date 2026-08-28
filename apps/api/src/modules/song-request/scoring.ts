import type { YouTubeVideo } from '@vkara/youtube';

import type { DeclaredSong } from '@vkara/validators';

/**
 * Heuristic karaoke judge.
 *
 * Scores each candidate on 5 axes (each 0..1):
 *  - title   : how much of the declared song (title + artist tokens) appears in the video title
 *  - artist  : declared artist tokens matching video title or channel name
 *  - karaoke : how strongly the title smells like a karaoke/instrumental backing track
 *  - duration: typical karaoke-track length band
 *  - popularity: views (log-scaled) + verified channel bonus
 *
 * Confidence is a weighted blend. We deliberately stay conservative: a candidate
 * only gets `isKaraoke=true` when the karaoke signal is strong enough.
 */

// --- normalization ---------------------------------------------------------

const ACCENT_MAP: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n',
    à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u', ç: 'c',
    â: 'a', ê: 'e', ô: 'o', û: 'u', ã: 'a', õ: 'o',
};

function removeAccents(value: string): string {
    return value
        .toLowerCase()
        .replace(/[áéíóúüñàèìòùçâêôûãõ]/g, (ch) => ACCENT_MAP[ch] ?? ch);
}

const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'of', 'to', 'in', 'on', 'for', 'with', 'feat', 'ft',
    'el', 'la', 'los', 'las', 'de', 'del', 'y', 'e', 'en', 'con', 'para', 'por',
    'que', 'un', 'una', 'al', 'a', 'o', 'u', 'mi', 'tu', 'su', 'es',
]);

function tokenize(value: string): string[] {
    return removeAccents(value)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

/** Video title with karaoke/format words stripped → pure song text for matching. */
const STRIP_WORDS_PATTERN =
    /\b(karaoke|instrumental|backing\s*track|backtrack|minus\s*one|minus-one|minus1|sing\s*along|play\s*along|con\s*letra|with\s*lyrics|letra|lyrics|lyric|pista|sin\s*voz|base\s*musical|acompañamiento|acompanamiento|cover|tutorial|lesson|en\s*vivo|live|official\s*video|official\s*audio|music\s*video|video\s*oficial|audio\s*oficial|remix|dance|reaction|karaoke\s*version|version)\b/gi;

function strippedTitle(title: string): string {
    return title.replace(STRIP_WORDS_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}

// --- karaoke signal ---------------------------------------------------------

const KARAOKE_POSITIVE: Array<{ pattern: RegExp; weight: number }> = [
    { pattern: /\bkaraoke\b/i, weight: 3 },
    { pattern: /\binstrumental\b/i, weight: 3 },
    { pattern: /\bminus\s*-?\s*one\b|\b-\s*1\b/i, weight: 3 },
    { pattern: /\bbacking\s*track\b|\bbacktrack\b/i, weight: 2.5 },
    { pattern: /\bsing\s*along\b/i, weight: 2.5 },
    { pattern: /\bcon\s*letra\b/i, weight: 1.5 },
    { pattern: /\bwith\s*lyrics\b/i, weight: 1.5 },
    { pattern: /\bkaraoke\s*version\b|\bversion\s*karaoke\b/i, weight: 3 },
    { pattern: /\bpista\b/i, weight: 2 },
    { pattern: /\bsin\s*voz\b/i, weight: 2.5 },
    { pattern: /\bbase\s*musical\b/i, weight: 2 },
    { pattern: /\b伴奏\b|\bカラオケ\b/i, weight: 3 },
];

const KARAOKE_NEGATIVE: Array<{ pattern: RegExp; weight: number }> = [
    { pattern: /\bofficial\s*video\b|\bofficial\s*audio\b|\bmusic\s*video\b|\bvideo\s*oficial\b|\baudio\s*oficial\b|\bmv\b/i, weight: 2 },
    { pattern: /\blyrics?\s*video\b|\bvideo\s*letra\b|\blyric\s*video\b/i, weight: 1.5 },
    { pattern: /\ben\s*vivo\b|\blive\b/i, weight: 1.5 },
    { pattern: /\bletra\b/i, weight: 1 },
    { pattern: /\bcover\b/i, weight: 0.75 },
    { pattern: /\btutorial\b|\blesson\b|\bplaythrough\b/i, weight: 2 },
    { pattern: /\breaction\b/i, weight: 2 },
    { pattern: /\bremix\b/i, weight: 1 },
    { pattern: /\bdance\b/i, weight: 0.75 },
    { pattern: /\bkaraoke\s*mic\b|\bmic\s*only\b/i, weight: 1.5 },
];

export function karaokeSignal(title: string): number {
    const positive = KARAOKE_POSITIVE.reduce((sum, entry) => (entry.pattern.test(title) ? sum + entry.weight : sum), 0);
    const negative = KARAOKE_NEGATIVE.reduce((sum, entry) => (entry.pattern.test(title) ? sum + entry.weight : sum), 0);
    return Math.max(0, Math.min(1, 1 - Math.exp(-Math.max(0, positive - negative) * 0.55)));
}

// --- declaration parsing -----------------------------------------------------

const SEPARATOR_PATTERN = /\s*[-–—|/:;]\s*/;

export function parseDeclaration(raw: string): DeclaredSong {
    const trimmed = raw.trim();
    const parts = trimmed.split(SEPARATOR_PATTERN).map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
        // Most common guest input: "Song Title - Artist". We also keep the
        // reversed reading ("Artist - Title") as an alias so matching works either way.
        return { raw: trimmed, title: parts[0], artist: parts[1] };
    }

    // No separator: treat the whole string as title, artist unknown.
    return { raw: trimmed, title: trimmed, artist: null };
}

function tokensMatch(declaredTokens: string[], haystack: string): number {
    if (declaredTokens.length === 0) return 0;
    const hayTokens = new Set(tokenize(strippedTitle(haystack)));
    const hits = declaredTokens.filter((token) => hayTokens.has(token));
    return hits.length / declaredTokens.length;
}

// --- per-axis scores --------------------------------------------------------

export function titleScore(declaration: DeclaredSong, videoTitle: string): number {
    const titleTokens = tokenize(declaration.title);
    const artistTokens = declaration.artist ? tokenize(declaration.artist) : [];
    const videoTokens = new Set(tokenize(strippedTitle(videoTitle)));

    // "Song Title - Artist" input: title is the first part.
    const titleHit =
        titleTokens.length > 0 ? titleTokens.filter((t) => videoTokens.has(t)).length / titleTokens.length : 0;

    // "Artist - Song Title" input: the artist part is actually the song text.
    const reversedHit =
        artistTokens.length > 0 ? artistTokens.filter((t) => videoTokens.has(t)).length / artistTokens.length : 0;

    const bestPartHit = Math.max(titleHit, reversedHit);

    // Full-declaration coverage: how many of ALL declared words appear in the title.
    const allTokens = [...new Set([...titleTokens, ...artistTokens])];
    const fullHit =
        allTokens.length > 0 ? allTokens.filter((t) => videoTokens.has(t)).length / allTokens.length : 0;

    return Math.max(0, Math.min(1, bestPartHit * 0.6 + fullHit * 0.4));
}

export function artistScore(declaration: DeclaredSong, videoTitle: string, channelName: string): number {
    const artistTokens = declaration.artist ? tokenize(declaration.artist) : [];
    if (artistTokens.length === 0) return 0.5; // unknown artist → neutral

    const titleHit = tokensMatch(artistTokens, videoTitle);
    const channelHit = tokensMatch(artistTokens, channelName);
    return Math.max(0, Math.min(1, titleHit * 0.7 + channelHit * 0.3));
}

export function durationScore(durationSeconds: number): number {
    if (durationSeconds <= 0) return 0.3;
    if (durationSeconds < 60) return 0.1;
    if (durationSeconds < 120) return 0.45;
    if (durationSeconds <= 300) return 1;
    if (durationSeconds <= 480) return 0.85;
    if (durationSeconds <= 720) return 0.5;
    return 0.25;
}

export function popularityScore(views: number, verified: boolean): number {
    const logViews = views > 0 ? Math.log10(views + 1) : 0;
    const viewsScore = Math.max(0, Math.min(1, (logViews - 2) / 4)); // ~100 views → 0, 1M+ → 1
    return Math.max(0, Math.min(1, viewsScore * 0.9 + (verified ? 0.1 : 0)));
}

// --- composition -------------------------------------------------------------

export interface ScoredCandidate {
    video: YouTubeVideo;
    confidence: number;
    isKaraoke: boolean;
    reasons: string[];
    scores: {
        title: number;
        artist: number;
        karaoke: number;
        duration: number;
        popularity: number;
    };
}

export function scoreCandidate(declaration: DeclaredSong, video: YouTubeVideo): ScoredCandidate {
    const title = video.title ?? '';
    const channel = video.channels?.[0]?.name ?? '';

    const karaoke = karaokeSignal(title);
    const titleMatch = titleScore(declaration, title);
    const artist = artistScore(declaration, title, channel);
    const duration = durationScore(video.duration);
    const popularity = popularityScore(video.views, Boolean(video.channels?.[0]?.verified));

    // A candidate that matches the song but is NOT karaoke must never win over
    // a weaker match that IS karaoke. Enforce via karaoke gate:
    const matchQuality = titleMatch * 0.7 + artist * 0.3;
    const confidence =
        karaoke >= 0.5
            ? Math.max(0, Math.min(1, karaoke * 0.5 + matchQuality * 0.4 + duration * 0.05 + popularity * 0.05))
            : Math.max(0, Math.min(1, matchQuality * 0.55 + duration * 0.05 + popularity * 0.05));

    const isKaraoke = karaoke >= 0.5 && matchQuality >= 0.35;

    const reasons: string[] = [];
    if (karaoke >= 0.5) reasons.push('Karaoke / instrumental');
    if (matchQuality >= 0.6) reasons.push('Matches the requested song');
    if (artist >= 0.5) reasons.push('Artist match');
    if (duration >= 0.85) reasons.push('Typical song length');
    if (reasons.length === 0) reasons.push('Weak match');

    return {
        video,
        confidence,
        isKaraoke,
        reasons,
        scores: { title: titleMatch, artist, karaoke, duration, popularity },
    };
}

export function scoreCandidates(declaration: DeclaredSong, videos: YouTubeVideo[]): ScoredCandidate[] {
    return videos
        .map((video) => scoreCandidate(declaration, video))
        .sort((a, b) => b.confidence - a.confidence);
}

export default scoreCandidates;