export const taskStatuses = ['todo', 'in_progress', 'done'] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPatch {
  title?: string;
  status?: TaskStatus;
  updatedAt: string;
}

export interface TaskRepository {
  create(task: Task): Promise<Task>;
  list(): Promise<Task[]>;
  update(id: string, patch: TaskPatch): Promise<Task | null>;
  healthCheck(): Promise<boolean>;
}

export interface TaskCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}
