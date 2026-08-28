/**
 * Sentry must initialize before any other application modules.
 * Loaded via `import './instrument'` (compiled binary).
 */
import * as Sentry from '@sentry/elysia';
import { bunRuntimeMetricsIntegration } from '@sentry/bun';

import {
    isSentryEnabled,
    readSentryEnvironmentFromProcess,
    resolveSentryTracesSampleRate,
    SENTRY_REDACT_ATTR_KEY,
} from '@vkara/env/sentry';

const dsn = process.env.SENTRY_DSN;
const sentryEnvironment = readSentryEnvironmentFromProcess();
const enabled = isSentryEnabled(dsn, process.env.SENTRY_ENABLED);
const isProduction = sentryEnvironment === 'production';

Sentry.init({
    dsn,
    enabled,
    environment: sentryEnvironment,
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: true,
    tracesSampleRate: resolveSentryTracesSampleRate(
        process.env.SENTRY_TRACES_SAMPLE_RATE,
        sentryEnvironment,
    ),
    enableLogs: true,
    integrations: [
        // Memory / CPU / event-loop gauges under bun.runtime.*
        bunRuntimeMetricsIntegration(),
        // Auto HTTP spans for ioredis when the package is loaded after init.
        Sentry.redisIntegration(),
    ],
    beforeSendLog: (log) => {
        // Belt-and-suspenders with Winston transport levels — never ship debug/trace from prod.
        if (isProduction && (log.level === 'debug' || log.level === 'trace')) {
            return null;
        }

        if (log.attributes) {
            for (const key of Object.keys(log.attributes)) {
                if (SENTRY_REDACT_ATTR_KEY.test(key)) {
                    log.attributes[key] = '[Redacted]';
                }
            }
        }

        return log;
    },
    beforeSend(event) {
        // Drop noisy CORS/origin rejections from the Issues stream.
        const message = event.exception?.values?.[0]?.value ?? event.message;
        if (typeof message === 'string' && message.includes('Forbidden: origin not allowed')) {
            return null;
        }
        return event;
    },
});

if (enabled) {
    Sentry.getGlobalScope().setAttributes({
        'service.name': 'vkara-api',
        'service.component': 'api',
        'deployment.environment': sentryEnvironment,
    });
    Sentry.setTag('service', 'vkara-api');
    Sentry.setTag('deploy', process.env.VERCEL_ENV ? 'vercel' : 'local');
}
