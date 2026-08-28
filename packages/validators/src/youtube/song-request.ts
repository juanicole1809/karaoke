import { z } from 'zod';

import { youtubeVideoSchema } from './video';

export const songRequestBodySchema = z.object({
    /** Freetext song declaration, e.g. "Persiana Americana - Soda Stereo". */
    query: z.string().trim().min(1).max(200),
});

export const declaredSongSchema = z.object({
    raw: z.string(),
    title: z.string(),
    artist: z.string().nullable(),
});

export const songRequestCandidateSchema = z.object({
    video: youtubeVideoSchema,
    /** 0..1 — how confident we are this candidate is the right karaoke version. */
    confidence: z.number().min(0).max(1),
    isKaraoke: z.boolean(),
    reasons: z.array(z.string()),
    scores: z.object({
        title: z.number(),
        artist: z.number(),
        karaoke: z.number(),
        duration: z.number(),
        popularity: z.number(),
    }),
});

export const songRequestResponseSchema = z.object({
    declaration: declaredSongSchema,
    /** `agent` when the LLM judge refined the ranking, `heuristic` otherwise. */
    mode: z.enum(['agent', 'heuristic']),
    candidates: z.array(songRequestCandidateSchema),
});

export type SongRequestBody = z.infer<typeof songRequestBodySchema>;
export type DeclaredSong = z.infer<typeof declaredSongSchema>;
export type SongRequestCandidate = z.infer<typeof songRequestCandidateSchema>;
export type SongRequestResponse = z.infer<typeof songRequestResponseSchema>;