import * as Sentry from '@sentry/elysia';
import { ErrorCode, RoomError } from '@vkara/room';

export type CaptureTags = Record<string, string>;

export type CaptureUnexpectedOptions = {
    tags?: CaptureTags;
    extras?: Record<string, unknown>;
    level?: 'fatal' | 'error' | 'warning' | 'info';
    /**
     * When true (default), skip expected client-facing `RoomError`s.
     * `INTERNAL_ERROR` is never skipped — that is a real bug.
     */
    skipExpected?: boolean;
};

function isExpectedRoomError(error: unknown): boolean {
    return error instanceof RoomError && error.code !== ErrorCode.INTERNAL_ERROR;
}

/**
 * Report an unexpected failure as a Sentry Issue.
 * Safe no-op when Sentry is disabled / not initialized.
 */
export function captureUnexpected(
    error: unknown,
    options: CaptureUnexpectedOptions = {},
): string | undefined {
    if (!Sentry.isInitialized() || !Sentry.isEnabled()) {
        return undefined;
    }

    const skipExpected = options.skipExpected ?? true;
    if (skipExpected && isExpectedRoomError(error)) {
        return undefined;
    }

    return Sentry.withScope((scope) => {
        if (options.tags) {
            for (const [key, value] of Object.entries(options.tags)) {
                scope.setTag(key, value);
            }
        }
        if (options.extras) {
            scope.setExtras(options.extras);
        }
        if (options.level) {
            scope.setLevel(options.level);
        }
        return Sentry.captureException(error);
    });
}

/** Emit a searchable Sentry message (not an exception stack). */
export function captureMessage(
    message: string,
    options: Omit<CaptureUnexpectedOptions, 'skipExpected'> = {},
): string | undefined {
    if (!Sentry.isInitialized() || !Sentry.isEnabled()) {
        return undefined;
    }

    return Sentry.withScope((scope) => {
        if (options.tags) {
            for (const [key, value] of Object.entries(options.tags)) {
                scope.setTag(key, value);
            }
        }
        if (options.extras) {
            scope.setExtras(options.extras);
        }
        return Sentry.captureMessage(message, options.level ?? 'info');
    });
}
