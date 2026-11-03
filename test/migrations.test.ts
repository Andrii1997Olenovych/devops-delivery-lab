import { describe, expect, it } from 'vitest';

import { applyMigrations, type MigrationClient } from '../src/migrations.js';

class FakeMigrationClient implements MigrationClient {
  public readonly statements: string[] = [];

  public async query(statement: string): Promise<void> {
    this.statements.push(statement);
  }
}

describe('applyMigrations', () => {
  it('executes the checked-in task schema exactly once', async () => {
    const client = new FakeMigrationClient();

    await applyMigrations(client, async () => 'CREATE TABLE tasks (id UUID PRIMARY KEY);');

    expect(client.statements).toEqual(['CREATE TABLE tasks (id UUID PRIMARY KEY);']);
  });
});
