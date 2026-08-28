import { describe, expect, it } from 'vitest';

import { ErrorCode, RoomError } from '@vkara/room';

import { captureUnexpected } from '@/sentry';

describe('captureUnexpected', () => {
    it('is a safe no-op when Sentry is not initialized', () => {
        expect(
            captureUnexpected(new Error('offline'), {
                tags: { area: 'test' },
            }),
        ).toBeUndefined();
    });

    it('skips expected RoomError domain codes by default', () => {
        expect(
            captureUnexpected(new RoomError(ErrorCode.ROOM_NOT_FOUND), {
                tags: { area: 'ws' },
            }),
        ).toBeUndefined();
    });
});
