import "server-only";
import Database from "better-sqlite3";
import path from "node:path";

const databasePath = path.join(process.cwd(), "data", "learning.db");

// Persistent SQLite database connection
export const db = new Database(databasePath);

db.pragma("foreign_keys = ON");

// Self-healing runtime migrations
try {
  db.exec("ALTER TABLE devflow_activity ADD COLUMN task_id TEXT");
} catch {
  // Column already exists
}

try {
  db.exec(
    "ALTER TABLE devflow_projects ADD COLUMN org_id TEXT NOT NULL DEFAULT 'org-1'",
  );
} catch {
  // Column already exists
}

try {
  db.exec(
    "ALTER TABLE devflow_tasks ADD COLUMN tag TEXT NOT NULL DEFAULT 'feature'",
  );
} catch {
  // Column already exists
}

try {
  db.exec("ALTER TABLE devflow_tasks ADD COLUMN due_date TEXT");
} catch {
  // Column already exists
}
