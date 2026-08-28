import type { VideoSource } from '@vkara/youtube';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createMigratingPersistStorage } from '@/lib/persisted-storage';
import { isExperimentsEnabled } from '@/lib/experiments';

interface AppSettingsState {
    useWhisperVoiceSearch: boolean;
    videoProvider: VideoSource;
    /** Seconds the TV waits before auto-playing the next song (3–10). */
    nextUpCountdownSeconds: number;
    setUseWhisperVoiceSearch: (enabled: boolean) => void;
    setVideoProvider: (provider: VideoSource) => void;
    setNextUpCountdownSeconds: (seconds: number) => void;
    getEffectiveVideoProvider: () => VideoSource;
}

export const useAppSettingsStore = create<AppSettingsState>()(
    persist(
        (set, get) => ({
            useWhisperVoiceSearch: false,
            videoProvider: 'youtube',
            nextUpCountdownSeconds: 5,
            setUseWhisperVoiceSearch: (enabled) => set({ useWhisperVoiceSearch: enabled }),
            setVideoProvider: (provider) => {
                if (provider === 'tiktok' && !isExperimentsEnabled()) {
                    set({ videoProvider: 'youtube' });
                    return;
                }
                set({ videoProvider: provider });
            },
            setNextUpCountdownSeconds: (seconds) =>
                set({ nextUpCountdownSeconds: Math.max(3, Math.min(10, Math.round(seconds))) }),
            getEffectiveVideoProvider: () => {
                if (!isExperimentsEnabled()) {
                    return 'youtube';
                }
                return get().videoProvider;
            },
        }),
        {
            name: 'vkara-app-settings',
            version: 3,
            storage: createJSONStorage(() => createMigratingPersistStorage()),
            partialize: (state) => ({
                useWhisperVoiceSearch: state.useWhisperVoiceSearch,
                videoProvider: state.videoProvider,
            }),
            migrate: (persisted, version) => {
                const state = persisted as Partial<AppSettingsState>;
                if (version < 2) {
                    return {
                        ...state,
                        videoProvider: state.videoProvider ?? 'youtube',
                    } as AppSettingsState;
                }
                if (version < 3) {
                    return {
                        ...state,
                        nextUpCountdownSeconds: state.nextUpCountdownSeconds ?? 5,
                    } as AppSettingsState;
                }
                return persisted as AppSettingsState;
            },
        },
    ),
);
