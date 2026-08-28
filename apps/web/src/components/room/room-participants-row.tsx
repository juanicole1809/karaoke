'use client';

import { useMemo } from 'react';
import { ChevronRight, Users } from 'lucide-react';

import { ParticipantsPanel, useSortedParticipants } from '@/components/room/participants-panel';
import { DeviceDisplayNameField } from '@/components/room/device-display-name-field';
import { useYouTubeStore } from '@/store/youtubeStore';
import { useScopedI18n } from '@/locales/client';
import { cn } from '@/lib/utils';

type RoomParticipantsRowProps = {
    className?: string;
};

/**
 * Inline disclosure for room participants + display name.
 * Lives in the settings scroll flow (no portal), so bottom nav / now-playing stay visible
 * and the browser can scroll the focused name field above the soft keyboard.
 */
export function RoomParticipantsRow({ className }: RoomParticipantsRowProps) {
    const tRoom = useScopedI18n('roomSettings');
    const participants = useYouTubeStore((s) => s.room?.participants);
    const hostDeviceId = useYouTubeStore((s) => s.room?.hostDeviceId);
    const list = useSortedParticipants(participants, hostDeviceId);

    const onlineCount = useMemo(
        () => list.filter((p) => p.connectionIds.length > 0).length,
        [list],
    );

    const summary =
        list.length === 0
            ? tRoom('participantsEmpty')
            : tRoom('participantsCount', { count: list.length, online: onlineCount });

    return (
        <details className={cn('group', className)}>
            <summary
                className={cn(
                    'flex min-h-[52px] w-full cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-left',
                    'transition-colors hover:bg-muted/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    '[&::-webkit-details-marker]:hidden',
                )}
            >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Users className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-medium leading-none">{tRoom('participants')}</p>
                        <p className="truncate text-xs text-muted-foreground">{summary}</p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {list.length > 0 ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground">
                            {onlineCount}
                        </span>
                    ) : null}
                    <ChevronRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90"
                        aria-hidden
                    />
                </div>
            </summary>

            <div className="space-y-4 border-t border-border bg-muted/20 px-4 py-4">
                <DeviceDisplayNameField />
                <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {tRoom('participants')}
                    </p>
                    <ParticipantsPanel
                        participants={participants}
                        hostDeviceId={hostDeviceId}
                    />
                </div>
            </div>
        </details>
    );
}
