import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import type { Task, TaskCache, TaskPatch, TaskRepository, TaskStatus } from '../src/domain/task.js';

class FakeTaskRepository implements TaskRepository {
  public readonly tasks: Task[] = [];
  public reachable = true;
  public listCalls = 0;

  public async create(task: Task): Promise<Task> {
    this.tasks.push(task);
    return task;
  }

  public async list(): Promise<Task[]> {
    this.listCalls += 1;
    return [...this.tasks];
  }

  public async update(id: string, patch: TaskPatch): Promise<Task | null> {
    const task = this.tasks.find((candidate) => candidate.id === id);
    if (task === undefined) {
      return null;
    }

    const updated: Task = {
      ...task,
      ...patch,
    };
    const index = this.tasks.indexOf(task);
    this.tasks[index] = updated;
    return updated;
  }

  public async healthCheck(): Promise<boolean> {
    return this.reachable;
  }
}

class FakeTaskCache implements TaskCache {
  public value: string | null = null;
  public getError: Error | undefined;
  public setError: Error | undefined;
  public deleteError: Error | undefined;
  public reachable = true;
  public readonly deletedKeys: string[] = [];

  public async get(): Promise<string | null> {
    if (this.getError !== undefined) {
      throw this.getError;
    }
    return this.value;
  }

  public async set(_key: string, value: string): Promise<void> {
    if (this.setError !== undefined) {
      throw this.setError;
    }
    this.value = value;
  }

  public async delete(key: string): Promise<void> {
    if (this.deleteError !== undefined) {
      throw this.deleteError;
    }
    this.deletedKeys.push(key);
    this.value = null;
  }

  public async healthCheck(): Promise<boolean> {
    return this.reachable;
  }
}

const apps: Array<ReturnType<typeof buildApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function makeApp(repository = new FakeTaskRepository(), cache?: TaskCache) {
  const app = buildApp({
    repository,
    cache,
    logger: { level: 'silent' },
    now: () => new Date('2026-08-26T10:00:00.000Z'),
    createId: () => 'task-1',
  });
  apps.push(app);
  return { app, repository };
}

describe('task API', () => {
  it('creates a trimmed todo task', async () => {
    const { app } = makeApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: '  Prepare delivery lab  ' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: 'task-1',
      title: 'Prepare delivery lab',
      status: 'todo',
      createdAt: '2026-08-26T10:00:00.000Z',
      updatedAt: '2026-08-26T10:00:00.000Z',
    });
  });

  it.each([undefined, '', '   ', 'x'.repeat(161), 42])(
    'rejects an invalid create title: %j',
    async (title) => {
      const { app } = makeApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { title },
      });

      expect(response.statusCode).toBe(400);
    },
  );

  it('invalidates the cached task list after creating a task', async () => {
    const cache = new FakeTaskCache();
    cache.value = '[]';
    const { app } = makeApp(new FakeTaskRepository(), cache);

    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Refresh task cache' },
    });

    expect(response.statusCode).toBe(201);
    expect(cache.deletedKeys).toEqual(['tasks:list:v1']);
  });

  it('uses a cached serialized list without reading the repository', async () => {
    const cache = new FakeTaskCache();
    cache.value = JSON.stringify([
      {
        id: 'cached-task',
        title: 'Cached task',
        status: 'done',
        createdAt: '2026-08-25T10:00:00.000Z',
        updatedAt: '2026-08-25T10:00:00.000Z',
      },
    ]);
    const { app, repository } = makeApp(new FakeTaskRepository(), cache);

    const response = await app.inject({ method: 'GET', url: '/api/tasks' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(JSON.parse(cache.value));
    expect(repository.listCalls).toBe(0);
  });

  it('falls back to the repository when cache reads fail', async () => {
    const cache = new FakeTaskCache();
    cache.getError = new Error('redis unavailable');
    const repository = new FakeTaskRepository();
    repository.tasks.push({
      id: 'database-task',
      title: 'Database task',
      status: 'todo',
      createdAt: '2026-08-25T10:00:00.000Z',
      updatedAt: '2026-08-25T10:00:00.000Z',
    });
    const { app } = makeApp(repository, cache);

    const response = await app.inject({ method: 'GET', url: '/api/tasks' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(repository.tasks);
    expect(repository.listCalls).toBe(1);
  });

  it('does not fail a list request when cache writes fail', async () => {
    const cache = new FakeTaskCache();
    cache.setError = new Error('redis unavailable');
    const repository = new FakeTaskRepository();
    repository.tasks.push({
      id: 'database-task',
      title: 'Database task',
      status: 'todo',
      createdAt: '2026-08-25T10:00:00.000Z',
      updatedAt: '2026-08-25T10:00:00.000Z',
    });
    const { app } = makeApp(repository, cache);

    const response = await app.inject({ method: 'GET', url: '/api/tasks' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(repository.tasks);
  });

  it('updates a task and invalidates its cached list', async () => {
    const cache = new FakeTaskCache();
    const repository = new FakeTaskRepository();
    repository.tasks.push({
      id: 'task-1',
      title: 'Initial title',
      status: 'todo',
      createdAt: '2026-08-25T10:00:00.000Z',
      updatedAt: '2026-08-25T10:00:00.000Z',
    });
    const { app } = makeApp(repository, cache);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/task-1',
      payload: { title: '  Updated title ', status: 'in_progress' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 'task-1',
      title: 'Updated title',
      status: 'in_progress',
      createdAt: '2026-08-25T10:00:00.000Z',
      updatedAt: '2026-08-26T10:00:00.000Z',
    });
    expect(cache.deletedKeys).toEqual(['tasks:list:v1']);
  });

  it.each([{}, { title: '' }, { title: 'x'.repeat(161) }, { status: 'blocked' }, { status: 7 }])(
    'rejects an invalid task update: %j',
    async (payload) => {
      const { app } = makeApp();

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/tasks/task-1',
        payload,
      });

      expect(response.statusCode).toBe(400);
    },
  );

  it('returns 404 when updating a missing task', async () => {
    const { app } = makeApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/missing-task',
      payload: { status: 'done' satisfies TaskStatus },
    });

    expect(response.statusCode).toBe(404);
  });

  it('keeps a successful update successful when cache invalidation fails', async () => {
    const cache = new FakeTaskCache();
    cache.deleteError = new Error('redis unavailable');
    const repository = new FakeTaskRepository();
    repository.tasks.push({
      id: 'task-1',
      title: 'Initial title',
      status: 'todo',
      createdAt: '2026-08-25T10:00:00.000Z',
      updatedAt: '2026-08-25T10:00:00.000Z',
    });
    const { app } = makeApp(repository, cache);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/task-1',
      payload: { status: 'done' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'done' });
  });
});

describe('operational endpoints', () => {
  it('returns health independently of dependencies', async () => {
    const repository = new FakeTaskRepository();
    repository.reachable = false;
    const { app } = makeApp(repository);

    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports readiness from the database health check', async () => {
    const repository = new FakeTaskRepository();
    const { app } = makeApp(repository);

    const ready = await app.inject({ method: 'GET', url: '/readyz' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: 'ready' });

    repository.reachable = false;
    const notReady = await app.inject({ method: 'GET', url: '/readyz' });
    expect(notReady.statusCode).toBe(503);
    expect(notReady.json()).toEqual({ status: 'not_ready' });
  });

  it('exposes Prometheus HTTP and dependency metrics', async () => {
    const cache = new FakeTaskCache();
    const { app } = makeApp(new FakeTaskRepository(), cache);

    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('http_requests_total');
    expect(response.body).toContain('http_request_duration_seconds');
    expect(response.body).toContain('dependency_up{dependency="postgres"} 1');
    expect(response.body).toContain('dependency_up{dependency="redis"} 1');
  });
});
