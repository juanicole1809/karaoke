import type { SongRequestResponse } from '@vkara/validators';

import { apiPost } from './client/api-client';

/**
 * Resolve a freetext song declaration ("Persiana Americana - Soda Stereo")
 * into ranked YouTube karaoke candidates via the API's validation pipeline
 * (heuristic scoring + optional LLM judge).
 */
export async function requestKaraokeSong(
    query: string,
    signal?: AbortSignal,
): Promise<SongRequestResponse> {
    return apiPost<SongRequestResponse>('/song-request', { query }, signal);
}