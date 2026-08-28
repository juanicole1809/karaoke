/**
 * Verify Winston → Sentry Logs bridge for vkara-api.
 * Usage:
 *   SENTRY_DSN=... SENTRY_ENVIRONMENT=development SENTRY_LOG_LEVELS=info,warn,error \
 *     bun apps/api/scripts/verify-winston-sentry.ts
 */
import '../src/instrument';

import { createContextLogger, logger } from '../src/utils/logger';
import * as Sentry from '@sentry/elysia';

const log = createContextLogger('SentryVerify');

log.info('Winston→Sentry verify info', { verify: true, path: 'winston' });
log.warn('Winston→Sentry verify warn', { verify: true, path: 'winston' });
log.error('Winston→Sentry verify error', {
    verify: true,
    path: 'winston',
    error: new Error('winston bridge boom'),
    // Should be redacted by beforeSendLog
    redis_password: 'should-not-leak',
});

logger.info('Winston root logger verify', { verify: true });

await Sentry.flush(5000);
console.log('Flushed Winston→Sentry logs');
