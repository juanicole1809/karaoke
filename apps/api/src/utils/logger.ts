import chalk from 'chalk';
import winston from 'winston';
import Transport from 'winston-transport';
import * as Sentry from '@sentry/elysia';

import { env } from '@/env';
import { parseEnvFlagValue } from '@vkara/env/base';
import * as VkSentryEnv from '@vkara/env/sentry';

const LOG_TO_FILES = parseEnvFlagValue(env.LOG_TO_FILES, false);
const ERROR_LOG_PATH = env.ERROR_LOG_PATH;
const COMBINED_LOG_PATH = env.COMBINED_LOG_PATH;
const isProduction = env.NODE_ENV === 'production';

// Custom log format
const customFormat = winston.format.printf(({ level, message, timestamp, context }) => {
    const colorizedLevel = (() => {
        switch (level) {
            case 'error':
                return chalk.red.bold(level);
            case 'warn':
                return chalk.yellow.bold(level);
            case 'info':
                return chalk.blue.bold(level);
            case 'debug':
                return chalk.gray.bold(level);
            default:
                return level;
        }
    })();

    const colorizedContext = context ? chalk.magenta(`[${context}]`) : '';
    return `${chalk.gray(timestamp)} ${colorizedLevel} ${colorizedContext}: ${message}`;
});

/**
 * Sentry Logs only accept string | number | boolean attributes.
 * Flatten Error / nested objects so Winston meta survives the bridge.
 *
 * Mutates `info` in place so Winston Symbol keys (LEVEL, MESSAGE, SPLAT) stay intact.
 */
const sentryAttributesFormat = winston.format((info) => {
    const record = info as Record<string, unknown> & { error?: unknown };
    const error = record.error;

    if (error instanceof Error) {
        record.error_name = error.name;
        record.error_message = error.message;
        if (!isProduction && error.stack) {
            record.error_stack = error.stack;
        }
        delete record.error;
    } else if (error !== undefined && error !== null) {
        record.error =
            typeof error === 'string' || typeof error === 'number' || typeof error === 'boolean'
                ? error
                : safeJson(error);
    }

    for (const [key, value] of Object.entries(record)) {
        if (key === 'level' || key === 'message' || key === 'timestamp' || key === 'error') {
            continue;
        }
        if (value === undefined || value === null) {
            delete record[key];
            continue;
        }
        const valueType = typeof value;
        if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
            continue;
        }
        record[key] = safeJson(value);
    }

    return info;
})();

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return '[unserializable]';
    }
}

const transports: Transport[] = [
    new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.padLevels()),
    }),
];

if (LOG_TO_FILES) {
    if (ERROR_LOG_PATH) {
        transports.push(
            new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                format: winston.format.json(),
            }),
        );
    }

    if (COMBINED_LOG_PATH) {
        transports.push(
            new winston.transports.File({
                filename: COMBINED_LOG_PATH,
                format: winston.format.json(),
            }),
        );
    }
}

if (VkSentryEnv.isSentryEnabled(env.SENTRY_DSN, env.SENTRY_ENABLED) && Sentry.isInitialized()) {
    // Namespace import avoids HMR/TDZ "is not defined" on named bindings.
    const sentryEnvironment = VkSentryEnv.readSentryEnvironmentFromProcess();
    const levels = VkSentryEnv.resolveSentryLogLevels(env.SENTRY_LOG_LEVELS, sentryEnvironment);
    const SentryWinstonTransport = Sentry.createSentryWinstonTransport(Transport, {
        levels,
    });

    transports.push(
        new SentryWinstonTransport({
            // Skip calling the transport for noisier levels Winston-side.
            level: sentryEnvironment === 'production' ? 'warn' : 'info',
            format: sentryAttributesFormat,
        }),
    );
}

const logger = winston.createLogger({
    level: env.LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        isProduction ? winston.format.json() : customFormat,
    ),
    defaultMeta: { service: 'vkara-api' },
    transports,
});

export const createContextLogger = (context: string) => {
    return {
        error: (message: string, meta: object = {}) => {
            logger.error(message, { context, ...meta });
        },
        warn: (message: string, meta: object = {}) => {
            logger.warn(message, { context, ...meta });
        },
        info: (message: string, meta: object = {}) => {
            logger.info(message, { context, ...meta });
        },
        debug: (message: string, meta: object = {}) => {
            logger.debug(message, { context, ...meta });
        },
    };
};

export const roomLogger = createContextLogger('Room');
export const wsLogger = createContextLogger('WebSocket');
export const cleanupLogger = createContextLogger('Cleanup');
export const redisLogger = createContextLogger('Redis');

export { logger };
export default logger;
