import type { Task, TaskPatch, TaskRepository, TaskStatus } from '../domain/task.js';

export interface SqlClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  created_at: string | Date;
  updated_at: string | Date;
}

export class PostgresTaskRepository implements TaskRepository {
  public constructor(private readonly client: SqlClient) {}

  public async create(task: Task): Promise<Task> {
    const result = await this.client.query(
      `INSERT INTO tasks (id, title, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, status, created_at, updated_at`,
      [task.id, task.title, task.status, task.createdAt, task.updatedAt],
    );
    return mapRequiredTaskRow(result.rows[0], 'create task');
  }

  public async list(): Promise<Task[]> {
    const result = await this.client.query(
      `SELECT id, title, status, created_at, updated_at
       FROM tasks
       ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => mapRequiredTaskRow(row, 'list task'));
  }

  public async update(id: string, patch: TaskPatch): Promise<Task | null> {
    const assignments = ['updated_at = $1'];
    const values: unknown[] = [patch.updatedAt];

    if (patch.title !== undefined) {
      values.push(patch.title);
      assignments.push(`title = $${values.length}`);
    }
    if (patch.status !== undefined) {
      values.push(patch.status);
      assignments.push(`status = $${values.length}`);
    }

    values.push(id);
    const result = await this.client.query(
      `UPDATE tasks
       SET ${assignments.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, title, status, created_at, updated_at`,
      values,
    );
    return result.rows[0] === undefined ? null : mapRequiredTaskRow(result.rows[0], 'update task');
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

function mapRequiredTaskRow(row: unknown, action: string): Task {
  if (!isTaskRow(row)) {
    throw new Error(`Database did not return a valid row for ${action}`);
  }

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function isTaskRow(value: unknown): value is TaskRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    isTaskStatus(row.status) &&
    (typeof row.created_at === 'string' || row.created_at instanceof Date) &&
    (typeof row.updated_at === 'string' || row.updated_at instanceof Date)
  );
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'todo' || value === 'in_progress' || value === 'done';
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
