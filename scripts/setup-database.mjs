/**
 * Creates the local SQLite table and inserts repeatable learning data.
 * Run automatically before `npm run dev` and `npm run build`.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "learning.db");

mkdirSync(dataDirectory, { recursive: true });

const database = new Database(databasePath);

database.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0)
  );

  INSERT OR IGNORE INTO products (id, name, price) VALUES
    (1, 'USB Cable', 250),
    (2, 'Webcam', 1200),
    (3, 'Headset', 850);
`);

database.close();

console.log("SQLite learning database is ready.");
