import { randomUUID } from 'node:crypto';

import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';

import {
  taskStatuses,
  type Task,
  type TaskCache,
  type TaskPatch,
  type TaskRepository,
  type TaskStatus,
} from './domain/task.js';
import { AppMetrics } from './metrics.js';

const maximumTitleLength = 160;
const taskListCacheKey = 'tasks:list:v1';
const taskListCacheTtlSeconds = 30;

export interface BuildAppOptions {
  repository: TaskRepository;
  cache?: TaskCache | undefined;
  logger?: FastifyServerOptions['logger'];
  now?: () => Date;
  createId?: () => string;
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? { level: 'info' } });
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;
  const metrics = new AppMetrics();
  const requestStarts = new WeakMap<FastifyRequest, bigint>();

  app.addHook('onRequest', async (request) => {
    requestStarts.set(request, process.hrtime.bigint());
  });

  app.addHook('onResponse', async (request, reply) => {
    const startedAt = requestStarts.get(request);
    if (startedAt === undefined) {
      return;
    }
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    metrics.recordRequest(
      request.method,
      request.routeOptions.url ?? request.url,
      reply.statusCode,
      durationSeconds,
    );
  });

  app.post('/api/tasks', async (request, reply) => {
    const title = parseTitle(request.body);
    if (title === null) {
      return reply
        .code(400)
        .send({ error: 'title must be a non-empty string of at most 160 characters' });
    }

    const timestamp = now().toISOString();
    const task: Task = {
      id: createId(),
      title,
      status: 'todo',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const createdTask = await options.repository.create(task);
    if (options.cache !== undefined) {
      try {
        await options.cache.delete(taskListCacheKey);
      } catch (error) {
        request.log.warn(
          { err: error, cacheKey: taskListCacheKey },
          'Task list cache invalidation failed',
        );
      }
    }
    return reply.code(201).send(createdTask);
  });

  app.get('/api/tasks', async (request) => {
    if (options.cache !== undefined) {
      try {
        const serializedTasks = await options.cache.get(taskListCacheKey);
        if (serializedTasks !== null) {
          return parseCachedTasks(serializedTasks);
        }
        request.log.warn({ cacheKey: taskListCacheKey }, 'Task list cache miss; using repository');
      } catch (error) {
        request.log.warn(
          { err: error, cacheKey: taskListCacheKey },
          'Task list cache read failed; using repository',
        );
      }
    }

    const tasks = await options.repository.list();
    if (options.cache !== undefined) {
      try {
        await options.cache.set(taskListCacheKey, JSON.stringify(tasks), taskListCacheTtlSeconds);
      } catch (error) {
        request.log.warn(
          { err: error, cacheKey: taskListCacheKey },
          'Task list cache write failed',
        );
      }
    }
    return tasks;
  });

  app.patch<{ Params: { id: string } }>('/api/tasks/:id', async (request, reply) => {
    const patch = parseTaskPatch(request.body, now().toISOString());
    if (patch === null) {
      return reply.code(400).send({ error: 'provide a valid title and/or status' });
    }

    const task = await options.repository.update(request.params.id, patch);
    if (task === null) {
      return reply.code(404).send({ error: 'task not found' });
    }

    if (options.cache !== undefined) {
      try {
        await options.cache.delete(taskListCacheKey);
      } catch (error) {
        request.log.warn(
          { err: error, cacheKey: taskListCacheKey },
          'Task list cache invalidation failed',
        );
      }
    }
    return task;
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (_request, reply) => {
    const databaseReady = await checkHealth(options.repository);
    return databaseReady ? { status: 'ready' } : reply.code(503).send({ status: 'not_ready' });
  });

  app.get('/metrics', async (_request, reply) => {
    metrics.setDependencyUp('postgres', await checkHealth(options.repository));
    metrics.setDependencyUp(
      'redis',
      options.cache === undefined ? false : await checkHealth(options.cache),
    );
    reply.header('content-type', metrics.contentType);
    return metrics.render();
  });

  return app;
}

function parseTitle(body: unknown): string | null {
  if (!isRecord(body) || typeof body.title !== 'string') {
    return null;
  }

  return parseTitleValue(body.title);
}

function parseTitleValue(value: string): string | null {
  const title = value.trim();
  return title.length > 0 && title.length <= maximumTitleLength ? title : null;
}

function parseTaskPatch(body: unknown, updatedAt: string): TaskPatch | null {
  if (!isRecord(body)) {
    return null;
  }

  const keys = Object.keys(body);
  if (keys.length === 0 || keys.some((key) => key !== 'title' && key !== 'status')) {
    return null;
  }

  const patch: TaskPatch = { updatedAt };
  if (Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string') {
      return null;
    }
    const title = parseTitleValue(body.title);
    if (title === null) {
      return null;
    }
    patch.title = title;
  }

  if (Object.hasOwn(body, 'status')) {
    if (!isTaskStatus(body.status)) {
      return null;
    }
    patch.status = body.status;
  }

  return patch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCachedTasks(serializedTasks: string): Task[] {
  const parsed: unknown = JSON.parse(serializedTasks);
  if (!Array.isArray(parsed) || !parsed.every(isTask)) {
    throw new Error('Task list cache contains an invalid payload');
  }
  return parsed;
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    isTaskStatus(value.status) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && taskStatuses.some((status) => status === value);
}

async function checkHealth(dependency: { healthCheck(): Promise<boolean> }): Promise<boolean> {
  try {
    return await dependency.healthCheck();
  } catch {
    return false;
  }
}
