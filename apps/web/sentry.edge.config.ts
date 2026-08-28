import * as Sentry from '@sentry/nextjs';

import {
    isSentryEnabled,
    readSentryEnvironmentFromProcess,
    resolveSentryTracesSampleRate,
} from '@vkara/env/sentry';

import { applyWebSentryScopeTags, resolveWebSentryRelease } from './src/lib/sentry/scope';
import { scrubSentryEvent } from './src/lib/sentry/scrub';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const sentryEnvironment = readSentryEnvironmentFromProcess();
const enabled = isSentryEnabled(dsn, process.env.SENTRY_ENABLED);
const release = resolveWebSentryRelease();

Sentry.init({
    dsn,
    enabled,
    environment: sentryEnvironment,
    ...(release ? { release } : {}),
    sendDefaultPii: true,
    tracesSampleRate: resolveSentryTracesSampleRate(
        process.env.SENTRY_TRACES_SAMPLE_RATE,
        sentryEnvironment,
    ),
    enableLogs: true,
    beforeSend: scrubSentryEvent,
});

if (enabled) {
    applyWebSentryScopeTags(sentryEnvironment);
}
