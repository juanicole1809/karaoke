import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearStaleRoomSession } from '@/lib/room-session-lifecycle';
import { useRoomRejoinSecretStore } from '@/store/roomRejoinSecretStore';
import { useYouTubeStore } from '@/store/youtubeStore';
import { createTestPersistedRoom } from '@vkara/room/test-fixtures';

function createMapStorage(): Storage {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear() {
            map.clear();
        },
        getItem(key: string) {
            return map.get(key) ?? null;
        },
        key(index: number) {
            return [...map.keys()][index] ?? null;
        },
        removeItem(key: string) {
            map.delete(key);
        },
        setItem(key: string, value: string) {
            map.set(key, value);
        },
    } as Storage;
}

function installBrowserStorage(): void {
    const storage = createMapStorage();
    globalThis.localStorage = storage;
    globalThis.window = { localStorage: storage } as Window & typeof globalThis;
}

function uninstallBrowserStorage(): void {
  // @ts-expect-error test cleanup
    delete globalThis.window;
  // @ts-expect-error test cleanup
    delete globalThis.localStorage;
}

beforeEach(() => {
    installBrowserStorage();
});

afterEach(() => {
    useRoomRejoinSecretStore.getState().resetForTests();
    useYouTubeStore.setState({
        room: null,
        player: null,
        tvSuppressAutoCreate: false,
    });
    uninstallBrowserStorage();
});

describe('clearStaleRoomSession', () => {
    it('clears room state and forgets stored rejoin password', () => {
        const secrets = useRoomRejoinSecretStore.getState();
        secrets.stashPendingPassword('secret');
        secrets.commitPassword('1234');
        useYouTubeStore.setState({
            room: createTestPersistedRoom({ id: '1234' }),
            player: {} as YT.Player,
        });

        const roomId = clearStaleRoomSession({ roomId: '1234' });

        expect(roomId).toBe('1234');
        expect(useYouTubeStore.getState().room).toBeNull();
        expect(useYouTubeStore.getState().player).toBeNull();
        expect(useRoomRejoinSecretStore.getState().resolvePassword('1234')).toBeUndefined();
    });

    it('sets tvSuppressAutoCreate on TV layout', () => {
        useYouTubeStore.setState({
            room: createTestPersistedRoom({ id: '1234' }),
            tvSuppressAutoCreate: false,
        });

        clearStaleRoomSession({ isTvLayout: true, roomId: '1234' });

        expect(useYouTubeStore.getState().tvSuppressAutoCreate).toBe(true);
    });
});
