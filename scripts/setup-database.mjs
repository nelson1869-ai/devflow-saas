import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "learning.db");

console.log(`Setting up DevFlow SQLite database at ${dbPath}...`);
const database = new Database(dbPath);

database.pragma("journal_mode = WAL");

database.exec(`
  CREATE TABLE IF NOT EXISTS devflow_organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devflow_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'Member',
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devflow_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Member',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES devflow_users(id) ON DELETE CASCADE,
    FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE,
    UNIQUE(user_id, org_id)
  );

  CREATE TABLE IF NOT EXISTS devflow_projects (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL DEFAULT 'org-1',
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devflow_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Todo',
    priority TEXT NOT NULL DEFAULT 'Medium',
    assignee_name TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT 'feature',
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES devflow_projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devflow_tags (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL DEFAULT 'org-1',
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'cyan',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE,
    UNIQUE(org_id, name)
  );

  CREATE TABLE IF NOT EXISTS devflow_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES devflow_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devflow_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'assignment',
    link_url TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES devflow_users(id) ON DELETE CASCADE,
    FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devflow_activity (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    project_id TEXT,
    task_id TEXT,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_title TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE
  );
`);

// Migrations
try {
  database.exec(
    "ALTER TABLE devflow_projects ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",
  );
} catch {}

try {
  database.exec("ALTER TABLE devflow_projects ADD COLUMN archived_at TEXT");
} catch {}

try {
  database.exec("ALTER TABLE devflow_activity ADD COLUMN task_id TEXT");
} catch {}

console.log("Database schema setup complete.");
database.close();
