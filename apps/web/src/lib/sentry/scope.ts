import * as Sentry from '@sentry/nextjs';

/** Shared service tags for all Next.js runtimes (client / server / edge). */
export function applyWebSentryScopeTags(sentryEnvironment: string): void {
    Sentry.setTag('service', 'vkara-web');
    Sentry.setTag('runtime', detectRuntime());
    Sentry.setTag(
        'deploy',
        process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV ? 'vercel' : 'local',
    );
    Sentry.getGlobalScope().setAttributes({
        'service.name': 'vkara-web',
        'deployment.environment': sentryEnvironment,
    });
}

function detectRuntime(): 'browser' | 'nodejs' | 'edge' | 'unknown' {
    if (typeof window !== 'undefined') {
        return 'browser';
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
        return 'edge';
    }
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        return 'nodejs';
    }
    return 'unknown';
}

/** Prefer explicit release; otherwise leave unset so the build plugin can inject it. */
export function resolveWebSentryRelease(): string | undefined {
    const explicit = process.env.SENTRY_RELEASE?.trim();
    return explicit || undefined;
}
