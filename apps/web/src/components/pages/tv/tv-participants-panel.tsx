'use client';

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
import { ChevronDown, Users } from 'lucide-react';

import { ParticipantsPanel, useSortedParticipants } from '@/components/room/participants-panel';
import { TvFocusable } from '@/components/pages/tv/tv-focusable';
import { useYouTubeStore } from '@/store/youtubeStore';
import { useScopedI18n } from '@/locales/client';
import { TV_FOCUS_KEYS } from '@/lib/tv-spatial-nav';
import { peekTvSettingsScrollUp } from '@/lib/tv-settings-scroll';
import {
    tvSettingsIconPlate,
    tvSettingsLabel,
    tvSettingsRow,
    tvSettingsSectionLabel,
} from '@/lib/tv-focus-styles';
import { cn } from '@/lib/utils';

type TvParticipantsPanelProps = {
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    peekScrollUpOnUp?: boolean;
};

/**
 * TV settings entry for participants — collapsed by default.
 * Enter expands the list; Up on the trigger collapses it.
 */
export function TvParticipantsPanel({
    scrollContainerRef,
    peekScrollUpOnUp = false,
}: TvParticipantsPanelProps) {
    const tRoom = useScopedI18n('roomSettings');
    const [open, setOpen] = useState(false);
    const participants = useYouTubeStore((s) => s.room?.participants);
    const hostDeviceId = useYouTubeStore((s) => s.room?.hostDeviceId);
    const list = useSortedParticipants(participants, hostDeviceId);
    const focusKey = TV_FOCUS_KEYS.settingsParticipants;

    const onlineCount = useMemo(
        () => list.filter((p) => p.connectionIds.length > 0).length,
        [list],
    );

    const summary =
        list.length === 0
            ? tRoom('participantsEmpty')
            : tRoom('participantsCount', { count: list.length, online: onlineCount });

    const closePanel = useCallback(() => {
        setOpen(false);
        requestAnimationFrame(() => {
            try {
                setFocus(focusKey);
            } catch {
                // Spatial tree may not be ready.
            }
        });
    }, [focusKey]);

    useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => {
            try {
                setFocus(`${focusKey}_list`);
            } catch {
                // Spatial tree may not be ready.
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [open, focusKey]);

    return (
        <section>
            <p className={tvSettingsSectionLabel()}>{tRoom('participants')}</p>

            <TvFocusable
                focusKey={focusKey}
                accessibilityLabel={`${tRoom('participants')}: ${summary}`}
                suppressFocusChrome
                scrollIntoViewOnFocus
                scrollContainerRef={scrollContainerRef}
                onEnterPress={() => setOpen((prev) => !prev)}
                onArrowPress={(direction) => {
                    if (direction === 'up' && open) {
                        closePanel();
                        return false;
                    }
                    if (direction === 'up' && !open && peekScrollUpOnUp) {
                        return peekTvSettingsScrollUp(scrollContainerRef.current);
                    }
                    return true;
                }}
                className={({ focused }) =>
                    cn(
                        tvSettingsRow(focused),
                        'tv-settings-dropdown-trigger',
                        open && !focused && 'tv-settings-dropdown-trigger--open',
                    )
                }
            >
                {({ focused }) => (
                    <>
                        <span className={tvSettingsIconPlate(focused)}>
                            <Users className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1 text-left">
                            <p className={tvSettingsLabel(focused)}>{tRoom('participants')}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <span
                                className={cn(
                                    'tv-settings-dropdown-value',
                                    focused && 'text-white',
                                )}
                            >
                                {onlineCount}
                            </span>
                            <ChevronDown
                                className={cn(
                                    'tv-settings-dropdown-chevron h-6 w-6 shrink-0',
                                    open && 'tv-settings-dropdown-chevron--open',
                                    focused ? 'text-white' : 'text-zinc-300',
                                )}
                                strokeWidth={2.5}
                                aria-hidden
                            />
                        </div>
                    </>
                )}
            </TvFocusable>

            {open ? (
                <div
                    className="tv-settings-dropdown-menu mt-2"
                    role="region"
                    aria-label={tRoom('participants')}
                >
                    <TvFocusable
                        focusKey={`${focusKey}_list`}
                        accessibilityLabel={summary}
                        suppressFocusChrome
                        scrollIntoViewOnFocus
                        scrollContainerRef={scrollContainerRef}
                        onEnterPress={closePanel}
                        onArrowPress={(direction) => {
                            if (direction === 'up') {
                                closePanel();
                                return false;
                            }
                            return true;
                        }}
                        className={({ focused }) =>
                            cn(
                                'rounded-xl p-2 outline-none',
                                focused && 'ring-2 ring-[#3ea6ff] ring-offset-2 ring-offset-black',
                            )
                        }
                    >
                        <ParticipantsPanel
                            participants={participants}
                            hostDeviceId={hostDeviceId}
                            variant="tv"
                        />
                    </TvFocusable>
                </div>
            ) : null}
        </section>
    );
}
