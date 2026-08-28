import { parseEnvFlagValue } from '@vkara/env';

import { env } from '@/env';

/**
 * Experiments flag for the web client.
 *
 * Only the `NEXT_PUBLIC_VKARA_EXPERIMENTS` value is readable in the browser.
 * The server-only `VKARA_EXPERIMENTS` flag must NOT be touched here: @t3-oss/env
 * throws when a client bundle accesses a server-side variable, and this module
 * is used from client code (stores, hooks, settings panels).
 */
export function isExperimentsEnabled(): boolean {
    if (env.NEXT_PUBLIC_VKARA_EXPERIMENTS !== undefined) {
        return parseEnvFlagValue(env.NEXT_PUBLIC_VKARA_EXPERIMENTS, false);
    }
    return false;
}