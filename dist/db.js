import { join } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
const dataDir = join(process.cwd(), 'data');
const dbFile = join(dataDir, 'db.json');
// Ensure data directory exists
import { mkdirSync, existsSync } from 'node:fs';
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}
const adapter = new JSONFile(dbFile);
export const db = new Low(adapter, {
    users: [],
    activities: [],
    journals: [],
    moods: [],
    therapySessions: [],
    chatMessages: [],
});
export async function initDb() {
    await db.read();
}
