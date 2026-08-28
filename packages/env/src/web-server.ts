import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import { envSkipValidation } from './base';

/** Next.js server-only variables (route handlers, not exposed to client bundle). */
export function webServerEnv() {
    return createEnv({
        server: {
            WHISPER_URL: z.string().url().optional(),
            HF_TOKEN: z.string().optional(),
            VKARA_AIO: z.string().optional(),
            GOOGLE_SITE_VERIFICATION: z.string().optional(),
            ANALYZE: z.string().optional(),
            NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
            VERCEL_ENV: z.string().optional(),
            VERCEL_URL: z.string().optional(),
            /** Server/edge Sentry DSN; falls back to NEXT_PUBLIC_SENTRY_DSN when unset. */
            SENTRY_DSN: z.string().url().optional(),
            SENTRY_ENVIRONMENT: z.string().min(1).optional(),
            SENTRY_RELEASE: z.string().min(1).optional(),
            SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
            SENTRY_ENABLED: z.string().optional(),
            /** Build-time only — source map upload for `withSentryConfig`. */
            SENTRY_AUTH_TOKEN: z.string().optional(),
            SENTRY_ORG: z.string().optional(),
            SENTRY_PROJECT: z.string().optional(),
        },
        runtimeEnv: {
            WHISPER_URL: process.env.WHISPER_URL,
            HF_TOKEN: process.env.HF_TOKEN,
            VKARA_AIO: process.env.VKARA_AIO,
            GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION,
            ANALYZE: process.env.ANALYZE,
            NODE_ENV: process.env.NODE_ENV,
            VERCEL_ENV: process.env.VERCEL_ENV,
            VERCEL_URL: process.env.VERCEL_URL,
            SENTRY_DSN: process.env.SENTRY_DSN,
            SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
            SENTRY_RELEASE: process.env.SENTRY_RELEASE,
            SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
            SENTRY_ENABLED: process.env.SENTRY_ENABLED,
            SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
            SENTRY_ORG: process.env.SENTRY_ORG,
            SENTRY_PROJECT: process.env.SENTRY_PROJECT,
        },
        emptyStringAsUndefined: true,
        skipValidation: envSkipValidation(),
    });
}
