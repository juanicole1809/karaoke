'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { ERROR_RECOVERY_STORAGE_KEY } from '@/hooks/use-error-boundary-recovery';

function hasSoftAttemptRecorded(): boolean {
    try {
        const raw = sessionStorage.getItem(ERROR_RECOVERY_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { fingerprint?: string; attempts?: number };
        return (
            typeof parsed.attempts === 'number' &&
            parsed.attempts >= 1 &&
            typeof parsed.fingerprint === 'string' &&
            parsed.fingerprint.includes('E2E soft recovery crash')
        );
    } catch {
        return false;
    }
}

function E2ERecoveryCrash() {
    const params = useSearchParams();
    const mode = params.get('mode');
    const [armed, setArmed] = useState(false);

    useEffect(() => {
        setArmed(true);
    }, []);

    if (process.env.NODE_ENV !== 'development') {
        return (
            <main className="p-8 text-sm text-muted-foreground">
                Not available outside development.
            </main>
        );
    }

    if (!armed) {
        return (
            <main className="p-8 text-sm text-muted-foreground" id="e2e-arming">
                arming…
            </main>
        );
    }

    if (mode === 'soft') {
        // Throw until the recovery planner records an attempt (boundary soft-reset),
        // then render success. Avoids session flags that break under Strict Mode.
        if (!hasSoftAttemptRecorded()) {
            throw new Error('E2E soft recovery crash');
        }
        return (
            <main className="flex min-h-[40vh] items-center justify-center p-8">
                <p data-testid="e2e-soft-recovered" id="e2e-soft-recovered">
                    soft recovered
                </p>
            </main>
        );
    }

    if (mode === 'hard') {
        throw new Error('E2E hard recovery crash');
    }

    return (
        <main className="space-y-2 p-8 text-sm">
            <p>Use ?mode=soft or ?mode=hard</p>
        </main>
    );
}

/** Dev-only harness: soft (throw once → auto reset) vs hard (always throw → home). */
export default function E2ERecoveryPage() {
    return (
        <Suspense fallback={<main className="p-8 text-sm">loading…</main>}>
            <E2ERecoveryCrash />
        </Suspense>
    );
}
