'use client';

import { useScopedI18n } from '@/locales/client';
import { useAppSettingsStore } from '@/store/appSettingsStore';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const COUNTDOWN_OPTIONS = [3, 5, 8, 10] as const;

/** Seconds the TV waits before auto-playing the next song ("Up next" countdown). */
export function NextUpCountdownRow() {
    const t = useScopedI18n('settingsSections');
    const countdownSeconds = useAppSettingsStore((state) => state.nextUpCountdownSeconds);
    const setCountdownSeconds = useAppSettingsStore((state) => state.setNextUpCountdownSeconds);

    return (
        <div className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor="next-up-countdown" className="text-sm font-medium">
                        {t('nextUpCountdownLabel')}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t('nextUpCountdownHint')}</p>
                </div>
                <div
                    id="next-up-countdown"
                    className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background p-1"
                    role="radiogroup"
                    aria-label={t('nextUpCountdownLabel')}
                >
                    {COUNTDOWN_OPTIONS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={countdownSeconds === option}
                            onClick={() => setCountdownSeconds(option)}
                            className={cn(
                                'h-8 min-w-9 rounded-full px-2.5 text-sm font-semibold leading-none transition-colors',
                                countdownSeconds === option
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                        >
                            {option}s
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}