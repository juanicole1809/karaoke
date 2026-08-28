'use client';

import { useCallback, useMemo } from 'react';

import { getOrCreateDeviceId } from '@/lib/device-id';
import { useWebSocket } from '@/providers/websocket-provider';
import { useYouTubeStore } from '@/store/youtubeStore';
import { useI18n, useScopedI18n } from '@/locales/client';
import { SettingsRow } from '@/components/settings/settings-row';
import { Switch } from '@/components/ui/switch';
import { toastSessionNotReady } from '@/lib/session-toast';

/**
 * Compact lock toggle as a settings row.
 * Host can lock; any member in the room can unlock.
 */
export function RoomLockControls() {
    const t = useI18n();
    const tRoom = useScopedI18n('roomSettings');
    const room = useYouTubeStore((s) => s.room);
    const { ensureConnectedAndSend } = useWebSocket();
    const myDeviceId = getOrCreateDeviceId();

    const isHost = useMemo(() => {
        if (!room || !myDeviceId) return false;
        const me = room.participants?.[myDeviceId];
        return me?.role === 'host' || room.hostDeviceId === myDeviceId;
    }, [room, myDeviceId]);

    const isInRoom = Boolean(room?.id && myDeviceId && room.participants?.[myDeviceId]);
    const locked = Boolean(room?.locked);
    const canToggle = isInRoom && (locked || isHost);

    const onCheckedChange = useCallback(
        (next: boolean) => {
            if (!room?.id) {
                toastSessionNotReady({
                    title: t('toast.sessionNotReady'),
                    description: t('toast.sessionNotReadyDescription'),
                });
                return;
            }
            if (next) {
                if (!isHost) return;
                ensureConnectedAndSend({ type: 'lockRoom' });
                return;
            }
            ensureConnectedAndSend({ type: 'unlockRoom' });
        },
        [room?.id, isHost, ensureConnectedAndSend, t],
    );

    if (!canToggle) return null;

    return (
        <SettingsRow
            label={locked ? tRoom('roomLocked') : tRoom('lockRoom')}
            hint={tRoom('lockHint')}
            htmlFor="room-lock-toggle"
            control={
                <Switch
                    id="room-lock-toggle"
                    checked={locked}
                    onCheckedChange={onCheckedChange}
                    aria-label={locked ? tRoom('unlockRoom') : tRoom('lockRoom')}
                />
            }
        />
    );
}
