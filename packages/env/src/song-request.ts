import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import { envSkipValidation } from './base';

/**
 * Optional LLM "karaoke judge" agent for the song-request pipeline.
 * When no key is configured the pipeline runs in pure heuristic mode.
 *
 * Providers:
 *  - `anthropic`  → Anthropic Messages API (https://api.anthropic.com)
 *  - `openai`     → OpenAI / any OpenAI-compatible chat completions endpoint
 */
export function songRequestEnv() {
    return createEnv({
        server: {
            /** `none` | `heuristic` | `anthropic` | `openai` (default: `heuristic`). */
            KARAOKE_AGENT_PROVIDER: z
                .enum(['none', 'heuristic', 'anthropic', 'openai'])
                .default('heuristic'),
            KARAOKE_AGENT_API_KEY: z.string().optional(),
            /** Model id; default differs per provider. */
            KARAOKE_AGENT_MODEL: z.string().optional(),
            /** Optional custom base URL (OpenAI-compatible gateways, ollama, local LLMs). */
            KARAOKE_AGENT_BASE_URL: z.string().url().optional(),
            /** LLM HTTP timeout (ms). Default 20000. */
            KARAOKE_AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
        },
        runtimeEnv: {
            KARAOKE_AGENT_PROVIDER: process.env.KARAOKE_AGENT_PROVIDER,
            KARAOKE_AGENT_API_KEY: process.env.KARAOKE_AGENT_API_KEY,
            KARAOKE_AGENT_MODEL: process.env.KARAOKE_AGENT_MODEL,
            KARAOKE_AGENT_BASE_URL: process.env.KARAOKE_AGENT_BASE_URL,
            KARAOKE_AGENT_TIMEOUT_MS: process.env.KARAOKE_AGENT_TIMEOUT_MS,
        },
        emptyStringAsUndefined: true,
        skipValidation: envSkipValidation(),
    });
}

export type SongRequestEnv = ReturnType<typeof songRequestEnv>;