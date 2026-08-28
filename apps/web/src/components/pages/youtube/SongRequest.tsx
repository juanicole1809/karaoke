'use client';

import { useCallback, useRef, useState } from 'react';
import { ListPlus, Mic2, Play, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlayerAction } from '@/hooks/use-player-action';
import { useScopedI18n } from '@/locales/client';
import { cn } from '@/lib/utils';
import type { SongRequestCandidate, SongRequestResponse } from '@vkara/validators';
import { requestKaraokeSong } from '@/services/song-request-api';

import { VideoListItem } from './VideoListItem';

/**
 * "Pedir canción" tab — guests type a song + artist ("Persiana Americana - Soda")
 * and the validation pipeline returns ranked YouTube karaoke candidates.
 * One tap adds the chosen version to the shared queue.
 */
export function SongRequest() {
    const t = useScopedI18n('songRequest');
    const { handlePlayVideoNow, handleAddVideoToQueue } = usePlayerAction();

    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<SongRequestResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const handleSubmit = useCallback(
        async (event?: React.FormEvent) => {
            event?.preventDefault();
            const trimmed = query.trim();
            if (!trimmed || isLoading) return;

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setIsLoading(true);
            setError(null);
            setResult(null);

            try {
                const response = await requestKaraokeSong(trimmed, controller.signal);
                setResult(response);
            } catch (caught) {
                if ((caught as Error)?.name === 'AbortError') return;
                setError(t('error'));
            } finally {
                setIsLoading(false);
            }
        },
        [query, isLoading, t],
    );

    const renderActions = useCallback(
        (candidate: SongRequestCandidate) => (
            <div className="flex gap-2 px-1 pb-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 ring-1 ring-inset ring-border/80 dark:ring-border"
                    onClick={() => handlePlayVideoNow(candidate.video)}
                >
                    <Play className="h-4 w-4" />
                    {t('playNow')}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => handleAddVideoToQueue(candidate.video)}
                >
                    <ListPlus className="h-4 w-4" />
                    {t('addToQueue')}
                </Button>
            </div>
        ),
        [handlePlayVideoNow, handleAddVideoToQueue, t],
    );

    const best = result?.candidates[0];

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col">
            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-1.5 px-page-gutter pb-3 pt-safe-offset sm:gap-2"
            >
                <p className="text-xs text-muted-foreground">{t('hint')}</p>
                <div className="flex min-w-0 items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t('placeholder')}
                            className="pl-9"
                            autoFocus
                        />
                    </div>
                    <Button type="submit" size="sm" disabled={isLoading || !query.trim()}>
                        <Mic2 className="h-4 w-4" />
                        {t('request')}
                    </Button>
                </div>
            </form>

            <div className="min-h-0 flex-1 overflow-y-auto px-page-gutter pb-4">
                {isLoading && (
                    <div className="space-y-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-[100px] animate-pulse rounded-lg bg-accent/60"
                            />
                        ))}
                        <p className="text-center text-xs text-muted-foreground">{t('searching')}</p>
                    </div>
                )}

                {error && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </p>
                )}

                {result && (
                    <>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                    {t('declaration')}&nbsp;
                                    <span className="text-muted-foreground">
                                        &ldquo;{result.declaration.raw}&rdquo;
                                    </span>
                                </p>
                                {best && (
                                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-0.5 text-[0.6875rem] font-bold leading-none',
                                                best.confidence >= 0.7
                                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                    : best.confidence >= 0.45
                                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                      : 'bg-muted text-muted-foreground',
                                            )}
                                        >
                                            {Math.round(best.confidence * 100)}%
                                        </span>
                                        {best.isKaraoke && (
                                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.6875rem] font-bold leading-none text-primary">
                                                KARAOKE
                                            </span>
                                        )}
                                        {best.reasons.slice(0, 2).join(' · ')}
                                    </p>
                                )}
                            </div>
                        </div>

                        {result.candidates.length === 0 ? (
                            <p className="rounded-lg bg-muted px-3 py-3 text-center text-sm text-muted-foreground">
                                {t('noResults')}
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {result.candidates.map((candidate, index) => (
                                    <div key={candidate.video.id} className="space-y-1">
                                        {index === 0 && (
                                            <p className="px-1 text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
                                                {t('topPick')}
                                            </p>
                                        )}
                                        <div className="rounded-lg border border-border/70">
                                            <VideoListItem
                                                video={candidate.video}
                                                viewsLabel={t('views')}
                                                actions={renderActions(candidate)}
                                            />
                                            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
                                                <span
                                                    className={cn(
                                                        'rounded-full px-2 py-0.5 text-[0.6875rem] font-bold leading-none',
                                                        candidate.confidence >= 0.7
                                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                            : candidate.confidence >= 0.45
                                                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                              : 'bg-muted text-muted-foreground',
                                                    )}
                                                >
                                                    {t('confidence')} {Math.round(candidate.confidence * 100)}%
                                                </span>
                                                {candidate.isKaraoke && (
                                                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.6875rem] font-bold leading-none text-primary">
                                                        {t('karaoke')}
                                                    </span>
                                                )}
                                                <span className="text-[0.6875rem] text-muted-foreground">
                                                    {candidate.reasons.join(' · ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {!isLoading && !error && !result && (
                    <p className="px-2 pb-20 pt-10 text-center text-sm text-muted-foreground">
                        {t('emptyState')}
                    </p>
                )}
            </div>
        </div>
    );
}