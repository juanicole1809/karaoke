'use client';

const DEVICE_ID_KEY = 'vkara_device_id';
const DEVICE_ID_COOKIE = 'vkara_did';
const DEVICE_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
    if (!isBrowser()) return;
    try {
        document.cookie = `${name}=${encodeURIComponent(
            value,
        )}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
    } catch {
        /* cookies disabled - ignore */
    }
}

function getCookie(name: string): string | null {
    if (!isBrowser()) return null;
    try {
        const match = document.cookie
            .split(';')
            .map((row) => row.trim())
            .find((row) => row.startsWith(`${name}=`));
        if (!match) return null;
        const value = match.slice(name.length + 1);
        return value ? decodeURIComponent(value) : null;
    } catch {
        return null;
    }
}

function readLocalStorage(): string | null {
    if (!isBrowser()) return null;
    try {
        return window.localStorage.getItem(DEVICE_ID_KEY);
    } catch {
        return null;
    }
}

function writeLocalStorage(value: string): void {
    if (!isBrowser()) return;
    try {
        window.localStorage.setItem(DEVICE_ID_KEY, value);
    } catch {
        /* storage disabled - ignore */
    }
}

function generateId(): string {
    if (isBrowser() && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback RFC4122-ish v4 for non-secure contexts.
    const random = (n: number): string =>
        Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `${random(8)}-${random(4)}-4${random(3)}-${random(4)}-${random(12)}`;
}

/**
 * Returns the persisted deviceId, creating + persisting one if missing.
 * Idempotent and safe in SSR (returns null on server).
 */
export function getOrCreateDeviceId(): string | null {
    if (!isBrowser()) return null;

    const fromStorage = readLocalStorage();
    if (fromStorage && fromStorage.length > 0) {
        if (!getCookie(DEVICE_ID_COOKIE)) {
            setCookie(DEVICE_ID_COOKIE, fromStorage, DEVICE_ID_COOKIE_MAX_AGE);
        }
        return fromStorage;
    }

    const fromCookie = getCookie(DEVICE_ID_COOKIE);
    if (fromCookie && fromCookie.length > 0) {
        writeLocalStorage(fromCookie);
        return fromCookie;
    }

    const fresh = generateId();
    writeLocalStorage(fresh);
    setCookie(DEVICE_ID_COOKIE, fresh, DEVICE_ID_COOKIE_MAX_AGE);
    return fresh;
}

/** Read-only accessor — never generates. */
export function getDeviceId(): string | null {
    if (!isBrowser()) return null;
    return readLocalStorage() ?? getCookie(DEVICE_ID_COOKIE);
}

export function getDeviceIdOrEmpty(): string {
    return getOrCreateDeviceId() ?? '';
}
