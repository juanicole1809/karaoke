import * as Sentry from '@sentry/nextjs';

import {
    isSentryEnabled,
    readSentryEnvironmentFromProcess,
    resolveSentryReplaysOnErrorSampleRate,
    resolveSentryReplaysSessionSampleRate,
    resolveSentryTracesSampleRate,
} from '@vkara/env/sentry';

import { applyWebSentryScopeTags, resolveWebSentryRelease } from '@/lib/sentry/scope';
import {
    SENTRY_DENY_URLS,
    SENTRY_IGNORE_ERRORS,
    scrubSentryEvent,
} from '@/lib/sentry/scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const sentryEnvironment = readSentryEnvironmentFromProcess({
    preferPublic: true,
    runtimeHost: typeof window !== 'undefined' ? window.location.hostname : undefined,
});
const enabled = isSentryEnabled(
    dsn,
    process.env.NEXT_PUBLIC_SENTRY_ENABLED ?? process.env.SENTRY_ENABLED,
);
const release = resolveWebSentryRelease();

Sentry.init({
    dsn,
    enabled,
    environment: sentryEnvironment,
    ...(release ? { release } : {}),
    sendDefaultPii: true,
    tracesSampleRate: resolveSentryTracesSampleRate(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? process.env.SENTRY_TRACES_SAMPLE_RATE,
        sentryEnvironment,
    ),
    // Production default is low continuous sampling; errors still get 100% replay buffer flush.
    replaysSessionSampleRate: resolveSentryReplaysSessionSampleRate(
        process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
        sentryEnvironment,
    ),
    replaysOnErrorSampleRate: resolveSentryReplaysOnErrorSampleRate(
        process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    ),
    enableLogs: true,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    denyUrls: SENTRY_DENY_URLS,
    beforeSend: scrubSentryEvent,
    // Propagate traces to the vkara API (distributed tracing web → api).
    tracePropagationTargets: [
        'localhost',
        /^https?:\/\/[^/]*vkara/i,
        process.env.NEXT_PUBLIC_API_URL,
        process.env.NEXT_PUBLIC_APP_URL,
    ].filter((value): value is string | RegExp => Boolean(value)),
    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }),
        Sentry.feedbackIntegration({
            colorScheme: 'system',
            autoInject: false,
            showBranding: false,
            buttonLabel: 'Report a bug',
            submitButtonLabel: 'Send report',
            formTitle: 'Report a bug',
            messagePlaceholder: 'What happened? Steps to reproduce help a lot.',
        }),
    ],
});

if (enabled) {
    applyWebSentryScopeTags(sentryEnvironment);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
