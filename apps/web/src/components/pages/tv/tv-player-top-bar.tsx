'use client';

import { coerceViewCount, formatViewCount } from '@vkara/youtube';
import { isVideoLive } from '@vkara/tiktok';
import { ListMusic, Mic2 } from 'lucide-react';

import { VideoChannels } from '@/components/video-channels';
import { useScopedI18n } from '@/locales/client';
import { useYouTubeStore } from '@/store/youtubeStore';
import { cn } from '@/lib/utils';

type TvPlayerTopBarProps = {
    className?: string;
};

/** Now-playing title — offsets when fixed QR is visible in the corner. */
export function TvPlayerTopBar({ className }: TvPlayerTopBarProps) {
    const tSearch = useScopedI18n('videoSearch');
    const tYoutube = useScopedI18n('youtubePage');

    const playingNow = useYouTubeStore((s) => s.room?.playingNow);
    const roomId = useYouTubeStore((s) => s.room?.id);
    const queueCount = useYouTubeStore((s) => s.room?.videoQueue?.length ?? 0);
    const showQRInPlayer = useYouTubeStore((s) => s.room?.showQRInPlayer ?? true);

    if (!playingNow) {
        return null;
    }

    const views = coerceViewCount(playingNow.views);
    const isLive = isVideoLive({ video: playingNow });
    const viewsLabel = views > 0 && !isLive ? `${formatViewCount(views)} ${tSearch('views')}` : null;
    const singers = playingNow.singers?.slice(0, 3);

    const reserveQrSpace = Boolean(showQRInPlayer && roomId);

    return (
        <header
            className={cn(
                'tv-player-top-bar relative min-w-0 w-full',
                reserveQrSpace && 'tv-player-top-bar--qr-visible',
                className,
            )}
        >
            {queueCount > 0 ? (
                <span className="absolute right-4 top-2 flex items-center gap-1.5 rounded-full bg-zinc-900/80 px-3 py-1 text-base font-bold tabular-nums text-amber-300 ring-1 ring-white/15 backdrop-blur">
                    <ListMusic className="h-4 w-4" aria-hidden />
                    {queueCount}
                </span>
            ) : null}
            <h1 className="tv-player-top-bar__title line-clamp-2">
                {playingNow.title}
            </h1>
            <div className="tv-player-top-bar__meta mt-2 min-w-0 max-w-full">
                <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
                    <VideoChannels
                        video={playingNow}
                        tone="inverse"
                        maxLines={2}
                        className="tv-player-top-bar__channels w-auto min-w-0"
                    />
                    {singers?.length ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-900/80 px-2.5 py-0.5 font-semibold text-amber-300 ring-1 ring-white/15">
                            <Mic2 className="h-4 w-4" aria-hidden />
                            {singers.join(', ')}
                        </span>
                    ) : null}
                    {isLive ? (
                        <span className="tv-player-top-bar__meta-extra shrink-0 text-zinc-200">
                            · {tYoutube('liveNow')}
                        </span>
                    ) : viewsLabel ? (
                        <span className="tv-player-top-bar__meta-extra shrink-0 tabular-nums text-zinc-200">
                            · {viewsLabel}
                        </span>
                    ) : null}
                </div>
            </div>
        </header>
    );
}
