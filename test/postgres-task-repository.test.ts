import { describe, expect, it } from 'vitest';

import type { Task } from '../src/domain/task.js';
import { PostgresTaskRepository, type SqlClient } from '../src/infra/postgres-task-repository.js';

class FakeSqlClient implements SqlClient {
  public readonly calls: Array<{ text: string; values: unknown[] | undefined }> = [];
  public rows: unknown[] = [];
  public healthy = true;

  public async query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    this.calls.push({ text, values });
    if (!this.healthy) {
      throw new Error('database unavailable');
    }
    return { rows: this.rows };
  }
}

const task: Task = {
  id: 'a1f9fc1e-7bb9-4c7d-a66f-1f84294dd66f',
  title: 'Persist this task',
  status: 'todo',
  createdAt: '2026-08-26T10:00:00.000Z',
  updatedAt: '2026-08-26T10:00:00.000Z',
};

describe('PostgresTaskRepository', () => {
  it('persists a task with parameterized SQL and maps its database row', async () => {
    const client = new FakeSqlClient();
    client.rows = [
      {
        id: task.id,
        title: task.title,
        status: task.status,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      },
    ];
    const repository = new PostgresTaskRepository(client);

    await expect(repository.create(task)).resolves.toEqual(task);
    expect(client.calls).toEqual([
      expect.objectContaining({
        text: expect.stringContaining('INSERT INTO tasks'),
        values: [task.id, task.title, task.status, task.createdAt, task.updatedAt],
      }),
    ]);
  });

  it('returns null when an update affects no task', async () => {
    const client = new FakeSqlClient();
    const repository = new PostgresTaskRepository(client);

    await expect(
      repository.update('missing', { status: 'done', updatedAt: '2026-08-26T10:01:00.000Z' }),
    ).resolves.toBeNull();
    expect(client.calls[0]?.text).toContain('UPDATE tasks');
  });

  it('uses a simple database query for its readiness check', async () => {
    const client = new FakeSqlClient();
    const repository = new PostgresTaskRepository(client);

    await expect(repository.healthCheck()).resolves.toBe(true);
    expect(client.calls).toEqual([{ text: 'SELECT 1', values: undefined }]);

    client.healthy = false;
    await expect(repository.healthCheck()).resolves.toBe(false);
  });
});
