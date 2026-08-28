'use client';

/**
 * Friendly device labels for anonymous room participants.
 *
 * Web cannot read personal names like "Zang's Phone" (native-only / privacy).
 * We combine:
 *  1. User-chosen name (localStorage) — best personalization
 *  2. UA Client Hints `model` when available (Chrome Android → "Pixel 7", "SM-G991B")
 *  3. Coarse UA / platform fallbacks ("iPhone", "iPad", "Android", "Mac", "Windows")
 */

const USER_DISPLAY_NAME_KEY = 'vkara_display_name';
const AUTO_LABEL_KEY = 'vkara_auto_device_label';
const MAX_LABEL_LENGTH = 40;

let memoryAutoLabel: string | null = null;
let resolveInFlight: Promise<string> | null = null;

function clampLabel(value: string): string {
    return value.trim().slice(0, MAX_LABEL_LENGTH);
}

function getLocalStorage(): Storage | null {
    try {
        if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
            return globalThis.localStorage;
        }
    } catch {
        /* storage disabled */
    }
    return null;
}

function readStorage(key: string): string | null {
    const storage = getLocalStorage();
    if (!storage) return null;
    try {
        const value = storage.getItem(key);
        return value && value.trim() ? clampLabel(value) : null;
    } catch {
        return null;
    }
}

function writeStorage(key: string, value: string): void {
    const storage = getLocalStorage();
    if (!storage) return;
    try {
        storage.setItem(key, value);
    } catch {
        /* storage disabled */
    }
}

function removeStorage(key: string): void {
    const storage = getLocalStorage();
    if (!storage) return;
    try {
        storage.removeItem(key);
    } catch {
        /* storage disabled */
    }
}

/** User override — highest priority when set. */
export function getUserDisplayName(): string | null {
    return readStorage(USER_DISPLAY_NAME_KEY);
}

export function setUserDisplayName(name: string): void {
    const trimmed = clampLabel(name);
    if (!trimmed) {
        removeStorage(USER_DISPLAY_NAME_KEY);
        return;
    }
    writeStorage(USER_DISPLAY_NAME_KEY, trimmed);
}

export function clearUserDisplayName(): void {
    removeStorage(USER_DISPLAY_NAME_KEY);
}

type NavigatorUADataLike = {
    mobile?: boolean;
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<{
        model?: string;
        platform?: string;
        platformVersion?: string;
        mobile?: boolean;
    }>;
};

function getNavigator(): Navigator | null {
    if (typeof navigator === 'undefined') return null;
    return navigator;
}

function getUaData(): NavigatorUADataLike | null {
    const nav = getNavigator() as (Navigator & { userAgentData?: NavigatorUADataLike }) | null;
    return nav?.userAgentData ?? null;
}

function parseUaFallback(isTvClient: boolean): string {
    if (isTvClient) return 'TV';

    const nav = getNavigator();
    if (!nav) return 'Remote';

    const ua = nav.userAgent;
    const platform = nav.platform || '';

    if (/iPad|Tablet|PlayBook/i.test(ua) || (platform === 'MacIntel' && nav.maxTouchPoints > 1)) {
        return 'iPad';
    }
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/Android/i.test(ua)) {
        if (/Mobile/i.test(ua)) return 'Android';
        return 'Android tablet';
    }
    if (/CrOS/i.test(ua)) return 'Chromebook';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Linux/i.test(ua)) return 'Linux';

    const uaData = getUaData();
    if (uaData?.mobile) return 'Phone';
    if (uaData?.platform) return uaData.platform;

    return 'Remote';
}

function preferModelLabel(model: string | undefined, platform: string | undefined): string | null {
    const cleaned = model?.trim();
    if (!cleaned) return null;
    // Some Android builds return marketing-ish names; others return codes like SM-G991B.
    // Both are better than "Remote #1" for telling devices apart.
    if (platform && /Android/i.test(platform) && !/android/i.test(cleaned)) {
        return cleaned;
    }
    return cleaned;
}

async function detectAutoLabel(isTvClient: boolean): Promise<string> {
    if (isTvClient) return 'TV';

    const uaData = getUaData();
    if (uaData?.getHighEntropyValues) {
        try {
            const hints = await uaData.getHighEntropyValues([
                'model',
                'platform',
                'platformVersion',
            ]);
            const fromModel = preferModelLabel(hints.model, hints.platform ?? uaData.platform);
            if (fromModel) return clampLabel(fromModel);

            const platform = (hints.platform || uaData.platform || '').trim();
            if (platform) {
                // iOS Safari does not expose userAgentData; Chrome on Android often does.
                // Desktop Chrome returns platform without model → "Windows" / "macOS".
                if (/iOS|iPhone/i.test(platform)) return 'iPhone';
                if (/iPad/i.test(platform)) return 'iPad';
                if (/Android/i.test(platform)) return 'Android';
                if (/macOS|Mac OS/i.test(platform)) return 'Mac';
                if (/Windows/i.test(platform)) return 'Windows';
                if (/Linux/i.test(platform)) return 'Linux';
                if (/Chrome OS/i.test(platform)) return 'Chromebook';
                return clampLabel(platform);
            }
        } catch {
            /* permission / policy blocked — fall through */
        }
    }

    return clampLabel(parseUaFallback(isTvClient));
}

/**
 * Sync accessor for join payloads. Prefers user override, then cached auto label,
 * then a cheap UA fallback (may upgrade after `ensureDeviceLabelResolved`).
 */
export function getDeviceLabel(options?: { isTvClient?: boolean }): string {
    const user = getUserDisplayName();
    if (user) return user;

    const isTvClient = options?.isTvClient === true;
    if (isTvClient) return 'TV';

    if (memoryAutoLabel) return memoryAutoLabel;
    const cached = readStorage(AUTO_LABEL_KEY);
    if (cached) {
        memoryAutoLabel = cached;
        return cached;
    }

    return parseUaFallback(false);
}

/** Resolve and cache the best auto label (async Client Hints). Safe to call often. */
export async function ensureDeviceLabelResolved(options?: {
    isTvClient?: boolean;
}): Promise<string> {
    const user = getUserDisplayName();
    if (user) return user;

    const isTvClient = options?.isTvClient === true;
    if (isTvClient) return 'TV';

    if (memoryAutoLabel) return memoryAutoLabel;
    const cached = readStorage(AUTO_LABEL_KEY);
    if (cached) {
        memoryAutoLabel = cached;
        return cached;
    }

    if (!resolveInFlight) {
        resolveInFlight = detectAutoLabel(false)
            .then((label) => {
                memoryAutoLabel = label;
                writeStorage(AUTO_LABEL_KEY, label);
                return label;
            })
            .finally(() => {
                resolveInFlight = null;
            });
    }

    return resolveInFlight;
}

/** Force re-detect auto label (e.g. after clearing user override). */
export async function refreshAutoDeviceLabel(): Promise<string> {
    memoryAutoLabel = null;
    removeStorage(AUTO_LABEL_KEY);
    return ensureDeviceLabelResolved();
}

const AUTO_PLACEHOLDER_NAMES = new Set([
    'TV',
    'Remote',
    'Phone',
    'iPhone',
    'iPad',
    'Android',
    'Android tablet',
    'Mac',
    'Windows',
    'Linux',
    'Chromebook',
]);

/** True for server/client placeholders we may safely upgrade when a better label arrives. */
export function isAutoGeneratedDisplayName(name: string | undefined): boolean {
    if (!name) return true;
    if (/^Remote #\d+$/i.test(name)) return true;
    return AUTO_PLACEHOLDER_NAMES.has(name);
}

/** Test helper — clears in-memory and persisted label caches. */
export function resetDeviceLabelCacheForTests(): void {
    memoryAutoLabel = null;
    resolveInFlight = null;
    removeStorage(AUTO_LABEL_KEY);
    removeStorage(USER_DISPLAY_NAME_KEY);
}
