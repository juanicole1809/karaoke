import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    selectRejoinPassword,
    useRoomRejoinSecretStore,
} from '@/store/roomRejoinSecretStore';

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
    uninstallBrowserStorage();
});

describe('useRoomRejoinSecretStore', () => {
    it('stashes, commits, and reads password per room', () => {
        const store = useRoomRejoinSecretStore.getState();
        store.stashPendingPassword('  party  ');
        store.commitPassword('1234');

        expect(store.resolvePassword('1234')).toBe('party');
        expect(store.resolvePassword('9999')).toBeUndefined();
    });

    it('ignores empty passwords', () => {
        const store = useRoomRejoinSecretStore.getState();
        store.stashPendingPassword('   ');
        store.commitPassword('1234');

        expect(store.resolvePassword('1234')).toBeUndefined();
        expect(useRoomRejoinSecretStore.getState().secrets).toEqual({});
    });

    it('forgets password for a room', () => {
        const store = useRoomRejoinSecretStore.getState();
        store.stashPendingPassword('secret');
        store.commitPassword('1234');
        store.forgetPassword('1234');

        expect(store.resolvePassword('1234')).toBeUndefined();
    });

    it('returns pending stash before commit', () => {
        useRoomRejoinSecretStore.getState().stashPendingPassword('pending');

        expect(useRoomRejoinSecretStore.getState().resolvePassword('1234')).toBe('pending');
    });

    it('overwrites password on re-commit', () => {
        const store = useRoomRejoinSecretStore.getState();
        store.stashPendingPassword('old');
        store.commitPassword('1234');
        store.stashPendingPassword('new');
        store.commitPassword('1234');

        expect(store.resolvePassword('1234')).toBe('new');
    });

    it('selectRejoinPassword mirrors resolvePassword', () => {
        const store = useRoomRejoinSecretStore.getState();
        store.stashPendingPassword('secret');
        store.commitPassword('1234');

        expect(selectRejoinPassword('1234')(useRoomRejoinSecretStore.getState())).toBe('secret');
    });
});
