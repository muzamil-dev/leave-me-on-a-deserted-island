import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initializeSchema } from './schema';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/scrubbed.db');
console.log(`Database connected at: ${dbPath}`);


const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: console.log });
db.pragma('journal_mode = WAL');


initializeSchema(db);

export default db;
