import { describe, expect, it } from 'vitest';

import {
    isSentryCronMonitorAllowed,
    isSentryEnabled,
    resolveSentryCronMonitorSlugs,
    resolveSentryEnvironment,
    resolveSentryLogLevels,
    resolveSentryReplaysOnErrorSampleRate,
    resolveSentryReplaysSessionSampleRate,
    resolveSentryTracesSampleRate,
} from '../src/sentry';

describe('resolveSentryEnvironment', () => {
    it('honors explicit development / production (and aliases)', () => {
        expect(resolveSentryEnvironment({ explicit: 'production' })).toBe('production');
        expect(resolveSentryEnvironment({ explicit: 'prod' })).toBe('production');
        expect(resolveSentryEnvironment({ explicit: 'development' })).toBe('development');
        expect(resolveSentryEnvironment({ explicit: 'dev' })).toBe('development');
        expect(resolveSentryEnvironment({ explicit: 'preview' })).toBe('development');
    });

    it('maps Vercel production and vkara.vercel.app to production', () => {
        expect(resolveSentryEnvironment({ vercelEnv: 'production' })).toBe('production');
        expect(resolveSentryEnvironment({ vercelUrl: 'vkara.vercel.app' })).toBe('production');
        expect(
            resolveSentryEnvironment({ appUrl: 'https://vkara.vercel.app' }),
        ).toBe('production');
        expect(resolveSentryEnvironment({ runtimeHost: 'vkara.vercel.app' })).toBe('production');
        expect(resolveSentryEnvironment({ runtimeHost: 'www.vkara.vercel.app' })).toBe(
            'production',
        );
    });

    it('defaults local / preview to development', () => {
        expect(resolveSentryEnvironment({})).toBe('development');
        expect(resolveSentryEnvironment({ vercelEnv: 'preview' })).toBe('development');
        expect(resolveSentryEnvironment({ appUrl: 'http://localhost:3000' })).toBe('development');
    });

    it('lets explicit override host detection', () => {
        expect(
            resolveSentryEnvironment({
                explicit: 'development',
                vercelEnv: 'production',
                appUrl: 'https://vkara.vercel.app',
            }),
        ).toBe('development');
    });
});

describe('resolveSentryTracesSampleRate', () => {
    it('defaults to 1 in development and 0.1 otherwise', () => {
        expect(resolveSentryTracesSampleRate(undefined, 'development')).toBe(1);
        expect(resolveSentryTracesSampleRate(undefined, 'production')).toBe(0.1);
        expect(resolveSentryTracesSampleRate(undefined, undefined)).toBe(0.1);
    });

    it('honors an explicit rate in range', () => {
        expect(resolveSentryTracesSampleRate('0.25', 'production')).toBe(0.25);
        expect(resolveSentryTracesSampleRate('1', 'production')).toBe(1);
        expect(resolveSentryTracesSampleRate('0', 'development')).toBe(0);
    });

    it('falls back when the raw value is invalid', () => {
        expect(resolveSentryTracesSampleRate('nope', 'development')).toBe(1);
        expect(resolveSentryTracesSampleRate('2', 'production')).toBe(0.1);
    });
});

describe('replay sample rates', () => {
    it('uses env-aware session defaults', () => {
        expect(resolveSentryReplaysSessionSampleRate(undefined, 'development')).toBe(1);
        expect(resolveSentryReplaysSessionSampleRate(undefined, 'production')).toBe(0.01);
        expect(resolveSentryReplaysOnErrorSampleRate(undefined)).toBe(1);
    });
});

describe('isSentryEnabled', () => {
    it('requires a DSN', () => {
        expect(isSentryEnabled(undefined)).toBe(false);
        expect(isSentryEnabled('')).toBe(false);
        expect(
            isSentryEnabled(
                'https://9486059e287181cacf72326c9bac8a43@o4511749689901056.ingest.us.sentry.io/4511749707792384',
            ),
        ).toBe(true);
    });

    it('allows explicit opt-out', () => {
        expect(
            isSentryEnabled(
                'https://9486059e287181cacf72326c9bac8a43@o4511749689901056.ingest.us.sentry.io/4511749707792384',
                'false',
            ),
        ).toBe(false);
    });
});

describe('resolveSentryLogLevels', () => {
    it('defaults to volume-safe production levels', () => {
        expect(resolveSentryLogLevels(undefined, 'production')).toEqual(['warn', 'error']);
        expect(resolveSentryLogLevels(undefined, 'development')).toEqual(['info', 'warn', 'error']);
    });

    it('parses an explicit allow-list', () => {
        expect(resolveSentryLogLevels('error, warn, nope', 'production')).toEqual(['error', 'warn']);
    });
});

describe('resolveSentryCronMonitorSlugs', () => {
    it('defaults to the free-plan-safe room-cleanup slug', () => {
        expect(resolveSentryCronMonitorSlugs(undefined)).toEqual(new Set(['room-cleanup']));
        expect(isSentryCronMonitorAllowed('room-cleanup', new Set(['room-cleanup']))).toBe(true);
        expect(isSentryCronMonitorAllowed('search-instance-cleanup', new Set(['room-cleanup']))).toBe(
            false,
        );
    });

    it('supports all / none / explicit lists', () => {
        expect(resolveSentryCronMonitorSlugs('*')).toBe('all');
        expect(resolveSentryCronMonitorSlugs('all')).toBe('all');
        expect(resolveSentryCronMonitorSlugs('none')).toEqual(new Set());
        expect(resolveSentryCronMonitorSlugs('room-cleanup, service-hourly-report')).toEqual(
            new Set(['room-cleanup', 'service-hourly-report']),
        );
        expect(isSentryCronMonitorAllowed('any', 'all')).toBe(true);
    });
});
