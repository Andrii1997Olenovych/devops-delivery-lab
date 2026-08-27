import type { TaskCache } from '../domain/task.js';

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
  ping(): Promise<unknown>;
}

export class RedisTaskCache implements TaskCache {
  public constructor(private readonly client: RedisClient) {}

  public get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  public async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}
