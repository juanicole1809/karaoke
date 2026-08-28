import { Elysia } from 'elysia';
import type Redis from 'ioredis';
import type { Client, VideoCompact } from 'youtubei';

import { fetchSearchInitialPage } from '@/modules/youtube/fetch-search-page';
import { prepareYoutubeVideos } from '@/modules/youtube/prepare-youtube-videos';
import { checkEmbeddable } from '@/modules/youtube/resolve-embed-playability';
import { getYoutubeiClient } from '@/modules/youtube/youtubei-client';
import { createContextLogger } from '@/utils/logger';
import type { DeclaredSong, SongRequestCandidate, SongRequestResponse } from '@vkara/validators';
import type { YouTubeVideo } from '@vkara/youtube';
import { songRequestBodySchema } from '@vkara/validators';

import { agentOptionsFromEnv, judgeWithAgent } from './agent';
import { parseDeclaration, scoreCandidates } from './scoring';
import { env } from '@/env';

const logger = createContextLogger('SongRequest');

const DEFAULT_CANDIDATE_LIMIT = 8;
const SEARCH_FETCH_LIMIT = 14;

export interface SongRequestServiceOptions {
    redisClient: Redis;
    youtubeiClient?: Client;
    candidateLimit?: number;
}

function buildSearchQuery(declaration: DeclaredSong): string {
    const base = [declaration.title, declaration.artist].filter(Boolean).join(' ');
    // If the guest already asked for a karaoke variant, don't append it again.
    if (/\b(karaoke|instrumental|pista|sin\s*voz|backing)\b/i.test(base)) {
        return base;
    }
    return `${base} karaoke`;
}

function uniqueById(videos: YouTubeVideo[]): YouTubeVideo[] {
    const seen = new Set<string>();
    const unique: YouTubeVideo[] = [];
    for (const video of videos) {
        if (seen.has(video.id)) continue;
        seen.add(video.id);
        unique.push(video);
    }
    return unique;
}

export function createSongRequestService({ redisClient, youtubeiClient, candidateLimit }: SongRequestServiceOptions) {
    const client = youtubeiClient ?? getYoutubeiClient();
    const limit = candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
    const agentOptions = agentOptionsFromEnv(env);

    async function resolve(query: string): Promise<SongRequestResponse> {
        const declaration = parseDeclaration(query);
        const searchQuery = buildSearchQuery(declaration);

        logger.info('Resolving song request', {
            raw: declaration.raw,
            title: declaration.title,
            artist: declaration.artist,
            searchQuery,
            agent: agentOptions?.provider ?? 'heuristic',
        });

        // 1. YouTube search (karaoke-biased query).
        const page = await fetchSearchInitialPage(client, searchQuery);
        const rawItems = (page.items as VideoCompact[]).slice(0, SEARCH_FETCH_LIMIT);

        // 2. Map to app videos (channels, views, embed-prefilter when enabled).
        const prepared = await prepareYoutubeVideos(client, redisClient, rawItems, page.metadata);

        // 3. Keep only embeddable videos so queue-adds never fail downstream.
        const embeddable: YouTubeVideo[] = [];
        for (const video of uniqueById(prepared)) {
            if (embeddable.length >= limit) break;
            if (await checkEmbeddable(redisClient, video.id)) {
                embeddable.push(video);
            }
        }

        if (embeddable.length === 0) {
            return { declaration, mode: 'heuristic', candidates: [] };
        }

        // 4. Heuristic scoring always runs (the fallback and the agent's context).
        const candidates: SongRequestCandidate[] = scoreCandidates(declaration, embeddable).map(
            ({ video, confidence, isKaraoke, reasons, scores }) => ({
                video,
                confidence,
                isKaraoke,
                reasons,
                scores,
            }),
        );

        // 5. Optional LLM judge refinement.
        if (agentOptions) {
            try {
                const judgment = await judgeWithAgent(agentOptions, declaration, candidates);
                const refined = candidates
                    .map((candidate) => {
                        const judge = judgment.get(candidate.video.id);
                        if (!judge) return candidate;
                        return {
                            ...candidate,
                            confidence: judge.confidence,
                            isKaraoke: judge.isKaraoke,
                            reasons: judge.reasons.length > 0 ? judge.reasons : candidate.reasons,
                        };
                    })
                    .sort((a, b) => b.confidence - a.confidence);

                return { declaration, mode: 'agent', candidates: refined };
            } catch (error) {
                logger.warn('Agent judge failed, keeping heuristic ranking', {
                    declared: declaration.raw,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return { declaration, mode: 'heuristic', candidates };
    }

    return { resolve };
}

export function createSongRequestElysia(options: SongRequestServiceOptions) {
    const service = createSongRequestService(options);

    return new Elysia({ name: 'song-request' }).post(
        '/song-request',
        async ({ body: { query } }) => {
            try {
                return await service.resolve(query);
            } catch (error) {
                logger.error('Failed to resolve song request', {
                    query,
                    error: error instanceof Error ? error.message : String(error),
                });
                return { error: 'youtube_upstream_failed' };
            }
        },
        {
            body: songRequestBodySchema,
        },
    );
}