import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export * from './schema.js';

export function getDb(connectionString?: string) {
  if (!connectionString) {
    return null;
  }
  const client = new pg.Client({ connectionString });
  return drizzle(client, { schema });
}
