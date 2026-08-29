import "server-only";
import Database from "better-sqlite3";
import path from "node:path";

const databasePath = path.join(process.cwd(), "data", "learning.db");

// Persistent SQLite database connection
export const db = new Database(databasePath);

db.pragma("foreign_keys = ON");
