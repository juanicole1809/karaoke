/**
 * One-shot Sentry verification for vkara-web (Node runtime init).
 * Usage: SENTRY_DSN=... bun apps/web/scripts/verify-sentry.mjs
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
if (!dsn) {
    console.error('SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is required');
    process.exit(1);
}

Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
    tracesSampleRate: 1,
    enableLogs: true,
});

const eventId = Sentry.captureException(new Error('Sentry foundation verify — vkara-web'));
await Sentry.flush(5000);
console.log(`Sent verify event: ${eventId ?? '(no id)'}`);
