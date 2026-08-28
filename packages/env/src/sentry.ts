import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import { envSkipValidation, parseEnvFlagValue } from './base';

/** Canonical Sentry environments for vkara (exactly two). */
export type SentryDeployEnvironment = 'development' | 'production';

/**
 * Attribute / field keys that must never leave the process as Sentry payload values.
 * Shared by API `beforeSendLog` and web `scrubSentryEvent`.
 */
export const SENTRY_REDACT_ATTR_KEY =
    /pass(word|wd)?|secret|token|authorization|cookie|api[_-]?key|private[_-]?key|redis_password|rejoin/i;

export type ResolveSentryEnvironmentInput = {
    /** Explicit `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT`. */
    explicit?: string;
    /** Vercel system env: production | preview | development. */
    vercelEnv?: string;
    /** e.g. `vkara.vercel.app` (with or without scheme). */
    vercelUrl?: string;
    /** Public app URL (`NEXT_PUBLIC_APP_URL` / `PUBLIC_APP_URL`). */
    appUrl?: string;
    /**
     * Browser `window.location.hostname` — required for client bundles because
     * `VERCEL_ENV` / `VERCEL_URL` are NOT inlined into the browser without NEXT_PUBLIC_.
     */
    runtimeHost?: string;
};

const PRODUCTION_HOST =
    /^(?:www\.)?vkara\.vercel\.app$/i;

function hostnameFromUrlOrHost(raw: string | undefined): string | undefined {
    const trimmed = raw?.trim();
    if (!trimmed) {
        return undefined;
    }
    try {
        if (trimmed.includes('://')) {
            return new URL(trimmed).hostname;
        }
        return trimmed.split('/')[0]?.split(':')[0];
    } catch {
        return undefined;
    }
}

function normalizeSentryEnvironment(raw: string | undefined): SentryDeployEnvironment | undefined {
    if (!raw?.trim()) {
        return undefined;
    }
    const value = raw.trim().toLowerCase();
    if (value === 'production' || value === 'prod') {
        return 'production';
    }
    if (
        value === 'development' ||
        value === 'dev' ||
        value === 'local' ||
        value === 'preview' ||
        value === 'staging' ||
        value === 'test'
    ) {
        // Preview/staging intentionally fold into development so prod stays clean.
        return 'development';
    }
    return undefined;
}

/**
 * Resolve the Sentry `environment` tag to exactly `development` or `production`.
 *
 * Precedence:
 * 1. Explicit env var (normalized)
 * 2. `VERCEL_ENV=production` or host `vkara.vercel.app`
 * 3. Otherwise `development` (local, preview, unknown)
 *
 * Note: `NODE_ENV=production` alone does **not** imply Sentry production
 * (e.g. `next start` locally must stay `development`).
 */
export function resolveSentryEnvironment(
    input: ResolveSentryEnvironmentInput = {},
): SentryDeployEnvironment {
    const fromExplicit = normalizeSentryEnvironment(input.explicit);
    if (fromExplicit) {
        return fromExplicit;
    }

    if (input.vercelEnv?.trim().toLowerCase() === 'production') {
        return 'production';
    }

    for (const candidate of [input.runtimeHost, input.vercelUrl, input.appUrl]) {
        const host = hostnameFromUrlOrHost(candidate);
        if (host && PRODUCTION_HOST.test(host)) {
            return 'production';
        }
    }

    return 'development';
}

/** Convenience: read process.env and resolve (API / Next server / client). */
export function readSentryEnvironmentFromProcess(options?: {
    /** Prefer `NEXT_PUBLIC_SENTRY_ENVIRONMENT` first (browser bundle). */
    preferPublic?: boolean;
    /** Browser hostname (`window.location.hostname`). */
    runtimeHost?: string;
}): SentryDeployEnvironment {
    const explicit = options?.preferPublic
        ? (process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.SENTRY_ENVIRONMENT)
        : (process.env.SENTRY_ENVIRONMENT ?? process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT);

    return resolveSentryEnvironment({
        explicit,
        // Client bundles only see NEXT_PUBLIC_* unless inlined at build.
        vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV,
        vercelUrl: process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_APP_URL,
        runtimeHost: options?.runtimeHost,
    });
}

/**
 * Resolve traces sample rate for Sentry.
 * Explicit `SENTRY_TRACES_SAMPLE_RATE` wins; otherwise 1.0 in development, 0.1 in production.
 */
export function resolveSentryTracesSampleRate(
    raw: string | undefined,
    sentryEnvironment: string | undefined,
): number {
    const trimmed = raw?.trim();
    if (trimmed) {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
            return parsed;
        }
    }
    return sentryEnvironment === 'development' ? 1 : 0.1;
}

/**
 * Session Replay: fraction of all sessions (client only).
 * Default 1.0 development / 0.01 production (error-triggered replays stay at 1.0).
 * Prefer low continuous sampling in prod; debug via `replaysOnErrorSampleRate`.
 */
export function resolveSentryReplaysSessionSampleRate(
    raw: string | undefined,
    sentryEnvironment?: string,
): number {
    const trimmed = raw?.trim();
    if (trimmed) {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
            return parsed;
        }
    }
    return sentryEnvironment === 'development' ? 1 : 0.01;
}

/** Session Replay: fraction of sessions with an error (client only). Default 1.0. */
export function resolveSentryReplaysOnErrorSampleRate(raw: string | undefined): number {
    const trimmed = raw?.trim();
    if (trimmed) {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
            return parsed;
        }
    }
    return 1;
}

export function isSentryEnabled(dsn: string | undefined, enabledFlag?: string): boolean {
    if (!dsn?.trim()) {
        return false;
    }
    // Explicit disable via SENTRY_ENABLED=false|0|off
    if (enabledFlag !== undefined && enabledFlag !== '') {
        return parseEnvFlagValue(enabledFlag, true);
    }
    return true;
}

const SENTRY_LOG_SEVERITY_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type SentryLogSeverityLevel = (typeof SENTRY_LOG_SEVERITY_LEVELS)[number];

/**
 * Which Winston→Sentry log severities to forward.
 * Explicit `SENTRY_LOG_LEVELS` (comma-separated) wins; otherwise:
 * - development: info,warn,error
 * - production: warn,error (volume-safe default)
 */
export function resolveSentryLogLevels(
    raw: string | undefined,
    sentryEnvironment: string | undefined,
): SentryLogSeverityLevel[] {
    const trimmed = raw?.trim();
    if (trimmed) {
        const parsed = trimmed
            .split(',')
            .map((part) => part.trim().toLowerCase())
            .filter((part): part is SentryLogSeverityLevel =>
                (SENTRY_LOG_SEVERITY_LEVELS as readonly string[]).includes(part),
            );
        if (parsed.length > 0) {
            return [...new Set(parsed)];
        }
    }
    return sentryEnvironment === 'development' ? ['info', 'warn', 'error'] : ['warn', 'error'];
}

/**
 * Which BullMQ cron slugs may call `Sentry.withMonitor`.
 *
 * Developer (free) plans include **one** cron monitor; extra upserts stay
 * disabled and never record check-ins. Default to the critical room cleanup
 * job; set `SENTRY_CRON_MONITORS=*` (or `all`) when PAYG covers more monitors.
 *
 * @see https://docs.sentry.io/pricing/quotas/manage-cron-monitors/
 */
export function resolveSentryCronMonitorSlugs(raw: string | undefined): Set<string> | 'all' {
    const trimmed = raw?.trim().toLowerCase();
    if (!trimmed || trimmed === '*' || trimmed === 'all') {
        // Explicit * / all → every slug. Unset defaults to the free-plan-safe slug.
        if (trimmed === '*' || trimmed === 'all') {
            return 'all';
        }
        return new Set(['room-cleanup']);
    }
    if (trimmed === 'none' || trimmed === 'off' || trimmed === '0') {
        return new Set();
    }
    return new Set(
        trimmed
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
    );
}

export function isSentryCronMonitorAllowed(
    slug: string,
    allowlist: Set<string> | 'all' = resolveSentryCronMonitorSlugs(process.env.SENTRY_CRON_MONITORS),
): boolean {
    return allowlist === 'all' || allowlist.has(slug);
}

/** Shared server-side Sentry vars (API + Next.js server/edge). */
export function sentryServerEnv() {
    return createEnv({
        server: {
            SENTRY_DSN: z.string().url().optional(),
            SENTRY_ENVIRONMENT: z.string().min(1).optional(),
            SENTRY_RELEASE: z.string().min(1).optional(),
            SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
            /** Comma-separated: trace,debug,info,warn,error,fatal */
            SENTRY_LOG_LEVELS: z.string().optional(),
            /** Opt-out switch; unset + DSN = enabled. */
            SENTRY_ENABLED: z.string().optional(),
            /** Temporary verify route (`/debug-sentry`). Never enable in public prod long-term. */
            SENTRY_VERIFY: z.string().optional(),
            /**
             * Comma-separated cron monitor slugs allowed to upsert/check-in.
             * Default (unset): `room-cleanup`. Use `*` / `all` for every job when
             * the org has PAYG budget for multiple cron monitors.
             */
            SENTRY_CRON_MONITORS: z.string().optional(),
        },
        runtimeEnv: {
            SENTRY_DSN: process.env.SENTRY_DSN,
            SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
            SENTRY_RELEASE: process.env.SENTRY_RELEASE,
            SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
            SENTRY_LOG_LEVELS: process.env.SENTRY_LOG_LEVELS,
            SENTRY_ENABLED: process.env.SENTRY_ENABLED,
            SENTRY_VERIFY: process.env.SENTRY_VERIFY,
            SENTRY_CRON_MONITORS: process.env.SENTRY_CRON_MONITORS,
        },
        emptyStringAsUndefined: true,
        skipValidation: envSkipValidation(),
    });
}
