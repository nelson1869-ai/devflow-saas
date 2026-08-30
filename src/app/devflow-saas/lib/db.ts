import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "devflow.db");

// Singleton connection to SQLite
const globalForDb = global as unknown as { db?: Database.Database };

export const db =
  globalForDb.db ||
  new Database(dbPath, {
    verbose: process.env.NODE_ENV === "development" ? undefined : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

// Enable Write-Ahead Logging
db.pragma("journal_mode = WAL");

// Self-healing runtime database migrations
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS devflow_organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'Free'
    );

    CREATE TABLE IF NOT EXISTS devflow_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'Member',
      avatar_url TEXT
    );

    CREATE TABLE IF NOT EXISTS devflow_projects (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      is_archived INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_milestones (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES devflow_projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      milestone_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Todo',
      priority TEXT NOT NULL DEFAULT 'Medium',
      assignee_name TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT 'feature',
      due_date TEXT,
      FOREIGN KEY (project_id) REFERENCES devflow_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (milestone_id) REFERENCES devflow_milestones(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS devflow_task_dependencies (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      depends_on_task_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (depends_on_task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE,
      UNIQUE(task_id, depends_on_task_id)
    );

    CREATE TABLE IF NOT EXISTS devflow_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_activities (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      project_id TEXT,
      task_id TEXT,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devflow_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      link_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devflow_tags (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'cyan',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(org_id, name)
    );

    CREATE TABLE IF NOT EXISTS devflow_webhooks (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      target_url TEXT NOT NULL,
      service_preset TEXT NOT NULL DEFAULT 'custom',
      event_type TEXT NOT NULL DEFAULT 'all',
      secret TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      response_status INTEGER NOT NULL DEFAULT 200,
      duration_ms INTEGER NOT NULL DEFAULT 45,
      delivered_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (webhook_id) REFERENCES devflow_webhooks(id) ON DELETE CASCADE
    );
  `);

  // Runtime self-healing migrations for existing SQLite databases
  try {
    db.exec(
      `ALTER TABLE devflow_projects ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;`,
    );
  } catch {}
  try {
    db.exec(`ALTER TABLE devflow_projects ADD COLUMN archived_at TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE devflow_activities ADD COLUMN task_id TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE devflow_tasks ADD COLUMN milestone_id TEXT;`);
  } catch {}
} catch (e) {
  console.error("Database self-healing migration warning:", e);
}
