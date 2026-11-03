const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevel = (typeof logLevels)[number];

export interface RuntimeConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string | undefined;
  logLevel: LogLevel;
}

export function readRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  const port = parsePort(environment.PORT);
  const redisUrl = environment.REDIS_URL?.trim();
  return {
    port,
    databaseUrl,
    redisUrl: redisUrl === undefined || redisUrl.length === 0 ? undefined : redisUrl,
    logLevel: parseLogLevel(environment.LOG_LEVEL),
  };
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (value === undefined || value.trim().length === 0) {
    return 'info';
  }

  const normalized = value.trim();
  if (logLevels.some((level) => level === normalized)) {
    return normalized as LogLevel;
  }
  throw new Error(`LOG_LEVEL must be one of: ${logLevels.join(', ')}`);
}
