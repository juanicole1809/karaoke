'use client';

import type { ErrorRecoveryPhase } from '@/hooks/use-error-boundary-recovery';

type RecoveryShellProps = {
    phase: ErrorRecoveryPhase | 'retrying' | 'redirecting';
    /** Screen-reader only — nothing visible except a quiet spinner. */
    label: string;
    className?: string;
};

/**
 * Minimal auto-recovery chrome: spinner only.
 * Copy stays visually hidden so the user is not interrupted mid-recover.
 */
export function RecoveryShell({ phase, label, className }: RecoveryShellProps) {
    return (
        <div
            className={
                className ??
                'flex min-h-[40vh] items-center justify-center px-6 py-12'
            }
            role="status"
            aria-live="polite"
            aria-busy="true"
            data-recovery-phase={phase}
        >
            <span className="sr-only">{label}</span>
            <div
                className="size-5 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-foreground/70"
                aria-hidden
            />
        </div>
    );
}
