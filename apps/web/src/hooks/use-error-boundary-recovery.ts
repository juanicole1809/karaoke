'use client';

import { useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export const ERROR_RECOVERY_STORAGE_KEY = 'vkara_error_recovery';
export const AUTO_RESET_MS = 1200;
export const HARD_RECOVER_MS = 2800;
/** Soft `reset()` attempts allowed for the same fingerprint before hard navigate. */
export const MAX_SOFT_RESETS = 2;

export type RecoveryBucket = {
    fingerprint: string;
    attempts: number;
    lastAt: number;
};

export function fingerprintError(error: unknown): string {
    if (error && typeof error === 'object') {
        const digest = 'digest' in error ? String((error as { digest?: string }).digest || '') : '';
        if (digest) return digest;
        const name = 'name' in error ? String((error as { name?: string }).name || 'Error') : 'Error';
        const message =
            'message' in error ? String((error as { message?: string }).message || '') : String(error);
        return `${name}:${message}`.slice(0, 160);
    }
    return `unknown:${String(error)}`.slice(0, 160);
}

export function readRecoveryBucket(fingerprint: string): RecoveryBucket {
    if (typeof window === 'undefined') {
        return { fingerprint, attempts: 0, lastAt: 0 };
    }
    try {
        const raw = sessionStorage.getItem(ERROR_RECOVERY_STORAGE_KEY);
        if (!raw) {
            return { fingerprint, attempts: 0, lastAt: 0 };
        }
        const parsed: unknown = JSON.parse(raw);
        if (
            !parsed ||
            typeof parsed !== 'object' ||
            !('fingerprint' in parsed) ||
            !('attempts' in parsed) ||
            !('lastAt' in parsed)
        ) {
            return { fingerprint, attempts: 0, lastAt: 0 };
        }
        const bucket = parsed as RecoveryBucket;
        if (
            bucket.fingerprint !== fingerprint ||
            Date.now() - bucket.lastAt > 5 * 60 * 1000
        ) {
            return { fingerprint, attempts: 0, lastAt: 0 };
        }
        return bucket;
    } catch {
        return { fingerprint, attempts: 0, lastAt: 0 };
    }
}

export function writeRecoveryBucket(bucket: RecoveryBucket): void {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(ERROR_RECOVERY_STORAGE_KEY, JSON.stringify(bucket));
    } catch {
        /* storage disabled */
    }
}

export function clearErrorRecoveryState(): void {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.removeItem(ERROR_RECOVERY_STORAGE_KEY);
    } catch {
        /* storage disabled */
    }
}

/**
 * Record one recovery attempt. Returns whether we should still soft-reset
 * (`soft`) or hard-navigate home (`hard`).
 */
export function planRecoveryAttempt(error: unknown): {
    fingerprint: string;
    attempts: number;
    mode: 'soft' | 'hard';
} {
    const fingerprint = fingerprintError(error);
    const bucket = readRecoveryBucket(fingerprint);
    const attempts = bucket.attempts + 1;
    writeRecoveryBucket({ fingerprint, attempts, lastAt: Date.now() });
    return {
        fingerprint,
        attempts,
        mode: attempts > MAX_SOFT_RESETS ? 'hard' : 'soft',
    };
}

export type ErrorRecoveryPhase = 'reporting' | 'retrying' | 'redirecting';

/**
 * Self-heal Next.js error boundaries:
 * 1. Report to Sentry once per error instance
 * 2. Soft `reset()` a few times automatically (no click)
 * 3. If the segment keeps crashing, hard-navigate home / reload
 */
export function useErrorBoundaryRecovery(
    error: Error & { digest?: string },
    reset?: () => void,
    options?: {
        /** Absolute path for hard recovery (default `/`). */
        homeHref?: string;
        /** Sentry tag value for `error_boundary` (default `auto_recovery`). */
        boundaryTag?: string;
    },
): ErrorRecoveryPhase {
    const homeHref = options?.homeHref ?? '/';
    const boundaryTag = options?.boundaryTag ?? 'auto_recovery';
    const reportedRef = useRef<string | null>(null);
    const [phase, setPhase] = useState<ErrorRecoveryPhase>('reporting');

    useEffect(() => {
        const plan = planRecoveryAttempt(error);

        if (reportedRef.current !== plan.fingerprint) {
            reportedRef.current = plan.fingerprint;
            Sentry.captureException(error, {
                tags: {
                    error_boundary: boundaryTag,
                    recovery_fingerprint: plan.fingerprint.slice(0, 64),
                    recovery_attempt: String(plan.attempts),
                    recovery_mode: plan.mode,
                },
            });
        }

        const shouldHard = plan.mode === 'hard' || typeof reset !== 'function';
        if (shouldHard) {
            setPhase('redirecting');
            const hardTimer = window.setTimeout(() => {
                clearErrorRecoveryState();
                window.location.replace(homeHref);
            }, HARD_RECOVER_MS);
            return () => window.clearTimeout(hardTimer);
        }

        setPhase('retrying');
        const softTimer = window.setTimeout(() => {
            try {
                reset();
            } catch (resetError) {
                Sentry.captureException(resetError, {
                    tags: { error_boundary: 'reset_failed' },
                });
                clearErrorRecoveryState();
                window.location.replace(homeHref);
            }
        }, AUTO_RESET_MS);

        return () => window.clearTimeout(softTimer);
    }, [error, reset, homeHref, boundaryTag]);

    return phase;
}
