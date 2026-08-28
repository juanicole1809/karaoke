import Redis from 'ioredis';
import { createRedisOptions } from '@vkara/redis';

import { watchRedisClient } from '@/sentry';

import { env } from './env';

export const redis = watchRedisClient(
    new Redis(
        createRedisOptions({
            REDIS_HOST: env.REDIS_HOST,
            REDIS_PORT: String(env.REDIS_PORT),
            REDIS_PASSWORD: env.REDIS_PASSWORD,
        }),
    ),
    'app',
);
