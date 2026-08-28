import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    ERROR_RECOVERY_STORAGE_KEY,
    MAX_SOFT_RESETS,
    clearErrorRecoveryState,
    fingerprintError,
    planRecoveryAttempt,
    readRecoveryBucket,
} from '@/hooks/use-error-boundary-recovery';

function installMemorySessionStorage() {
    const store = new Map<string, string>();
    const sessionStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, String(value));
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => store.clear(),
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
            return store.size;
        },
    };
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { sessionStorage },
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: sessionStorage,
    });
}

describe('error boundary recovery planner', () => {
    beforeEach(() => {
        installMemorySessionStorage();
    });

    afterEach(() => {
        clearErrorRecoveryState();
        // @ts-expect-error test cleanup
        delete globalThis.window;
        // @ts-expect-error test cleanup
        delete globalThis.sessionStorage;
    });

    it('fingerprints by digest when present', () => {
        expect(fingerprintError(Object.assign(new Error('x'), { digest: 'abc123' }))).toBe(
            'abc123',
        );
    });

    it('soft-plans the first MAX_SOFT_RESETS attempts, then hard', () => {
        const err = new Error('boom-same');
        for (let i = 1; i <= MAX_SOFT_RESETS; i += 1) {
            const plan = planRecoveryAttempt(err);
            expect(plan.mode).toBe('soft');
            expect(plan.attempts).toBe(i);
        }
        const hard = planRecoveryAttempt(err);
        expect(hard.mode).toBe('hard');
        expect(hard.attempts).toBe(MAX_SOFT_RESETS + 1);
    });

    it('resets the counter for a different fingerprint', () => {
        planRecoveryAttempt(new Error('a'));
        planRecoveryAttempt(new Error('a'));
        const next = planRecoveryAttempt(new Error('b'));
        expect(next.attempts).toBe(1);
        expect(next.mode).toBe('soft');
    });

    it('persists attempts in sessionStorage', () => {
        planRecoveryAttempt(new Error('persist-me'));
        const bucket = readRecoveryBucket(fingerprintError(new Error('persist-me')));
        expect(bucket.attempts).toBe(1);
        expect(sessionStorage.getItem(ERROR_RECOVERY_STORAGE_KEY)).toContain('persist-me');
    });
});
