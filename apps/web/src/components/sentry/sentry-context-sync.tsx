'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

import { clearErrorRecoveryState } from '@/hooks/use-error-boundary-recovery';
import { getOrCreateDeviceId } from '@/lib/device-id';
import { getUserDisplayName } from '@/lib/device-label';
import { useYouTubeStore } from '@/store/youtubeStore';

/**
 * Keeps Sentry user + room context in sync for issue triage.
 * Anonymous device id only — no emails / auth PII.
 */
export function SentryContextSync() {
    const roomId = useYouTubeStore((s) => s.room?.id);

    useEffect(() => {
        // Healthy mount after a recovered crash — reset soft-retry counters.
        clearErrorRecoveryState();
    }, []);

    useEffect(() => {
        const deviceId = getOrCreateDeviceId();
        if (!deviceId) {
            return;
        }

        const displayName = getUserDisplayName();
        Sentry.setUser({
            id: deviceId,
            ...(displayName ? { username: displayName } : {}),
        });
    }, []);

    useEffect(() => {
        if (roomId) {
            Sentry.setTag('room_id', roomId);
            Sentry.setContext('room', { id: roomId });
            return;
        }
        Sentry.getCurrentScope().setTag('room_id', '');
        Sentry.setContext('room', null);
    }, [roomId]);

    return null;
}
