'use client';

import { create } from 'zustand';
import type { YouTubeVideo } from '@vkara/youtube';

export type SingerQueueAction = 'queue' | 'priority';

export interface PendingSingerAdd {
    video: YouTubeVideo;
    action: SingerQueueAction;
}

interface SingersStore {
    /** Non-null while the "who sings?" dialog is open. */
    pending: PendingSingerAdd | null;
    openSingersPrompt: (video: YouTubeVideo, action: SingerQueueAction) => void;
    closeSingersPrompt: () => void;
}

export const useSingersStore = create<SingersStore>((set) => ({
    pending: null,
    openSingersPrompt: (video, action) => set({ pending: { video, action } }),
    closeSingersPrompt: () => set({ pending: null }),
}));

/** Parse the freetext input into a list of singer names. */
export function parseSingers(value: string): string[] {
    return value
        .split(/[,;]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 6);
}