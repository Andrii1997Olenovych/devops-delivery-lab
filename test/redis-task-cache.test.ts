import { describe, expect, it } from 'vitest';

import { RedisTaskCache, type RedisClient } from '../src/infra/redis-task-cache.js';

class FakeRedisClient implements RedisClient {
  public readonly calls: Array<{ method: string; arguments: unknown[] }> = [];
  public available = true;
  public value: string | null = null;

  public async get(key: string): Promise<string | null> {
    this.calls.push({ method: 'get', arguments: [key] });
    this.throwWhenUnavailable();
    return this.value;
  }

  public async set(key: string, value: string, mode: 'EX', seconds: number): Promise<'OK'> {
    this.calls.push({ method: 'set', arguments: [key, value, mode, seconds] });
    this.throwWhenUnavailable();
    this.value = value;
    return 'OK';
  }

  public async del(key: string): Promise<number> {
    this.calls.push({ method: 'del', arguments: [key] });
    this.throwWhenUnavailable();
    this.value = null;
    return 1;
  }

  public async ping(): Promise<'PONG'> {
    this.calls.push({ method: 'ping', arguments: [] });
    this.throwWhenUnavailable();
    return 'PONG';
  }

  private throwWhenUnavailable(): void {
    if (!this.available) {
      throw new Error('redis unavailable');
    }
  }
}

describe('RedisTaskCache', () => {
  it('uses an expiring Redis value for task list storage', async () => {
    const client = new FakeRedisClient();
    const cache = new RedisTaskCache(client);

    await cache.set('tasks:list:v1', '[{"id":"task-1"}]', 30);
    await expect(cache.get('tasks:list:v1')).resolves.toBe('[{"id":"task-1"}]');
    await cache.delete('tasks:list:v1');

    expect(client.calls).toEqual([
      { method: 'set', arguments: ['tasks:list:v1', '[{"id":"task-1"}]', 'EX', 30] },
      { method: 'get', arguments: ['tasks:list:v1'] },
      { method: 'del', arguments: ['tasks:list:v1'] },
    ]);
  });

  it('reports false rather than throwing when Redis is unavailable', async () => {
    const client = new FakeRedisClient();
    const cache = new RedisTaskCache(client);

    await expect(cache.healthCheck()).resolves.toBe(true);
    client.available = false;
    await expect(cache.healthCheck()).resolves.toBe(false);
  });
});
