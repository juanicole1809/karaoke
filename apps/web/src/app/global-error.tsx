'use client';

import { useErrorBoundaryRecovery } from '@/hooks/use-error-boundary-recovery';

/**
 * Root layout crash boundary. Must render its own <html>/<body>.
 * Auto-reports to Sentry and hard-navigates home — silent spinner only.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset?: () => void;
}) {
    const phase = useErrorBoundaryRecovery(error, reset, { homeHref: '/' });

    const label =
        phase === 'redirecting'
            ? 'Taking you back'
            : phase === 'retrying'
              ? 'Recovering'
              : 'Reporting the issue';

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0a0a0f',
                }}
            >
                <div
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                    data-recovery-phase={phase}
                >
                    <span
                        style={{
                            position: 'absolute',
                            width: 1,
                            height: 1,
                            padding: 0,
                            margin: -1,
                            overflow: 'hidden',
                            clip: 'rect(0, 0, 0, 0)',
                            whiteSpace: 'nowrap',
                            border: 0,
                        }}
                    >
                        {label}
                    </span>
                    <div
                        aria-hidden
                        style={{
                            width: 20,
                            height: 20,
                            borderRadius: '999px',
                            border: '2px solid rgba(232,232,237,0.2)',
                            borderTopColor: 'rgba(232,232,237,0.75)',
                            animation: 'vkara-spin 0.8s linear infinite',
                        }}
                    />
                </div>
                <style>{`@keyframes vkara-spin{to{transform:rotate(360deg)}}`}</style>
            </body>
        </html>
    );
}
