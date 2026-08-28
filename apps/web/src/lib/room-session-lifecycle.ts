import { ErrorCode } from '@vkara/room';

import { useRoomRejoinSecretStore } from '@/store/roomRejoinSecretStore';
import { useYouTubeStore } from '@/store/youtubeStore';

export const FATAL_REJOIN_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
    ErrorCode.ROOM_LOCKED,
    ErrorCode.INCORRECT_PASSWORD,
    ErrorCode.ROOM_NOT_FOUND,
    ErrorCode.REJOIN_ROOM_NOT_FOUND,
]);

export function isFatalRejoinError(code: ErrorCode): boolean {
    return FATAL_REJOIN_ERROR_CODES.has(code);
}

export type ClearStaleRoomSessionOptions = {
    isTvLayout?: boolean;
    roomId?: string | null;
};

/**
 * Drop persisted in-room UI when the socket is not in a valid room session
 * (fatal rejoin/join failure, room gone, locked out, etc.).
 */
export function clearStaleRoomSession({
    isTvLayout = false,
    roomId,
}: ClearStaleRoomSessionOptions = {}): string | null {
    const resolvedRoomId = roomId ?? useYouTubeStore.getState().room?.id ?? null;
    if (resolvedRoomId) {
        useRoomRejoinSecretStore.getState().forgetPassword(resolvedRoomId);
    }

    useYouTubeStore.setState((state) => ({
        room: null,
        player: null,
        tvSuppressAutoCreate: state.tvSuppressAutoCreate || Boolean(isTvLayout),
    }));

    return resolvedRoomId;
}
