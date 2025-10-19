import { join } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { DbSchema } from './types.js';

const dataDir = join(process.cwd(), 'data');
const dbFile = join(dataDir, 'db.json');

// Ensure data directory exists
import { mkdirSync, existsSync } from 'node:fs';
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const adapter = new JSONFile<DbSchema>(dbFile);
export const db = new Low<DbSchema>(
  adapter,
  {
    users: [],
    activities: [],
    journals: [],
    moods: [],
    therapySessions: [],
    chatMessages: [],
  },
);

export async function initDb(): Promise<void> {
  await db.read();
}
