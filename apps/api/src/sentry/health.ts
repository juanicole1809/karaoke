import type { Redis } from 'ioredis';

export type ServiceHealth = {
    status: 'ok' | 'degraded';
    timestamp: number;
    uptime: number;
    checks: {
        redis: 'up' | 'down';
    };
    runtime: {
        wsConnections: number;
        memory: NodeJS.MemoryUsage;
        cpu: NodeJS.CpuUsage;
    };
};

const REDIS_PING_TIMEOUT_MS = 2000;

async function pingRedis(redis: Redis): Promise<'up' | 'down'> {
    try {
        const result = await Promise.race([
            redis.ping(),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('redis ping timeout')), REDIS_PING_TIMEOUT_MS);
            }),
        ]);
        return result === 'PONG' ? 'up' : 'down';
    } catch {
        return 'down';
    }
}

/**
 * Lightweight readiness snapshot for operators / load balancers.
 * Keeps `/health` cheap: one Redis PING + process stats (no queue scans).
 */
export async function getServiceHealth(input: {
    redis: Redis;
    wsConnections: number;
}): Promise<ServiceHealth> {
    const redisStatus = await pingRedis(input.redis);

    return {
        status: redisStatus === 'up' ? 'ok' : 'degraded',
        timestamp: Date.now(),
        uptime: process.uptime(),
        checks: { redis: redisStatus },
        runtime: {
            wsConnections: input.wsConnections,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
        },
    };
}
