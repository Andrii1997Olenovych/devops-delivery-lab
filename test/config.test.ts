import { describe, expect, it } from 'vitest';

import { readRuntimeConfig } from '../src/config.js';

describe('runtime configuration', () => {
  it('reads the required database URL and optional Redis URL', () => {
    expect(
      readRuntimeConfig({
        PORT: '4100',
        DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/tasks',
        REDIS_URL: 'redis://localhost:6379',
        LOG_LEVEL: 'debug',
      }),
    ).toEqual({
      port: 4100,
      databaseUrl: 'postgres://postgres:postgres@localhost:5432/tasks',
      redisUrl: 'redis://localhost:6379',
      logLevel: 'debug',
    });
  });

  it('defaults the structured log level to info', () => {
    expect(
      readRuntimeConfig({
        DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/tasks',
      }).logLevel,
    ).toBe('info');
  });

  it('rejects a missing database URL at startup', () => {
    expect(() => readRuntimeConfig({ PORT: '3000' })).toThrow('DATABASE_URL is required');
  });
});
