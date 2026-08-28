/**
 * One-shot Sentry verification for vkara-api (no HTTP server).
 * Usage: SENTRY_DSN=... bun apps/api/scripts/verify-sentry.ts
 */
import * as Sentry from '@sentry/elysia';

const dsn = process.env.SENTRY_DSN;
if (!dsn) {
    console.error('SENTRY_DSN is required');
    process.exit(1);
}

Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
    tracesSampleRate: 1,
    enableLogs: true,
});

const eventId = Sentry.captureException(new Error('Sentry foundation verify — vkara-api'));
Sentry.logger.info('vkara-api sentry verify log', { eventId });
await Sentry.flush(5000);
console.log(`Sent verify event: ${eventId ?? '(no id)'}`);
