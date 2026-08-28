'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mic2, UserRound, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlayerAction } from '@/hooks/use-player-action';
import { useScopedI18n } from '@/locales/client';
import { cn } from '@/lib/utils';
import { parseSingers, useSingersStore } from '@/store/singersStore';

/**
 * "¿Quiénes cantan?" — inline overlay confined to the remote panel.
 * Unlike a full-screen dialog, it never covers the player video and has no
 * Radix focus flow that could race with the actions menu that triggered it.
 */
export function SingersPrompt() {
    const t = useScopedI18n('singers');
    const pending = useSingersStore((state) => state.pending);
    const closeSingersPrompt = useSingersStore((state) => state.closeSingersPrompt);
    const { commitQueueAdd } = usePlayerAction();

    const [value, setValue] = useState('');

    useEffect(() => {
        if (!pending) return;
        // Always start empty — never carry over names from a previous add.
        setValue('');
    }, [pending]);

    const singerCount = useMemo(() => parseSingers(value).length, [value]);

    const handleSubmit = async (singers: string[]) => {
        if (!pending) return;
        const video = pending.video;
        closeSingersPrompt();
        await commitQueueAdd(video, { moveToTop: pending.action === 'priority', singers });
    };

    if (!pending) {
        return null;
    }

    return (
        <div
            className="absolute inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
            onClick={closeSingersPrompt}
            role="dialog"
            aria-modal="true"
            aria-label={t('title')}
        >
            <div
                className="w-full max-w-sm rounded-2xl border bg-background p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-base font-semibold leading-tight">
                            <Mic2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                            {t('title')}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {pending.video.title}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={closeSingersPrompt}
                        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label={t('close')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void handleSubmit(parseSingers(value));
                    }}
                    className="space-y-3"
                >
                    <div className="relative">
                        <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            placeholder={t('placeholder')}
                            className={cn('pl-9 pr-16')}
                            autoFocus
                            maxLength={160}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">
                            {singerCount}/6
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('hint')}</p>

                    <div className="flex items-center justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => void handleSubmit([])}>
                            {t('solo')}
                        </Button>
                        <Button type="submit">{t('confirm')}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}