import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DEVFLOW_DB_PATH
  ? path.resolve(process.env.DEVFLOW_DB_PATH)
  : path.resolve(process.cwd(), "devflow.db");

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
      estimated_hours REAL NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS devflow_saved_views (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      project_id TEXT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🔍',
      filters_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES devflow_users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES devflow_projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_time_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      hours REAL NOT NULL,
      description TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES devflow_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      assignee_name TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_automations (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      trigger_event TEXT NOT NULL,
      condition_json TEXT NOT NULL DEFAULT '{}',
      action_type TEXT NOT NULL,
      action_payload_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      execution_count INTEGER NOT NULL DEFAULT 0,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES devflow_projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_automation_logs (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL,
      task_id TEXT,
      trigger_event TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SUCCESS',
      executed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (automation_id) REFERENCES devflow_automations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      file_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES devflow_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_task_prs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      pr_title TEXT NOT NULL,
      pr_url TEXT NOT NULL,
      repository TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      author_name TEXT NOT NULL,
      additions INTEGER NOT NULL DEFAULT 0,
      deletions INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      merged_at TEXT,
      FOREIGN KEY (task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devflow_api_keys (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      scopes TEXT NOT NULL DEFAULT 'read:tasks,write:tasks,read:projects',
      last_used_at TEXT,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES devflow_users(id) ON DELETE CASCADE
    );

    -- Tenant Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_devflow_projects_org ON devflow_projects(org_id);
    CREATE INDEX IF NOT EXISTS idx_devflow_tasks_project ON devflow_tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_devflow_api_keys_org ON devflow_api_keys(org_id);
    CREATE INDEX IF NOT EXISTS idx_devflow_milestones_org ON devflow_milestones(org_id);
    CREATE INDEX IF NOT EXISTS idx_devflow_tags_org ON devflow_tags(org_id);
    CREATE INDEX IF NOT EXISTS idx_devflow_webhooks_org ON devflow_webhooks(org_id);
    CREATE INDEX IF NOT EXISTS idx_devflow_automations_org ON devflow_automations(org_id);
    CREATE INDEX IF NOT EXISTS idx_devflow_activities_org ON devflow_activities(org_id);
  `);

  // Runtime self-healing column migrations
  try {
    db.exec(
      `ALTER TABLE devflow_organizations ADD COLUMN plan TEXT NOT NULL DEFAULT 'Free';`,
    );
  } catch {}
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
  try {
    db.exec(
      `ALTER TABLE devflow_tasks ADD COLUMN estimated_hours REAL NOT NULL DEFAULT 0;`,
    );
  } catch {}
} catch (e) {
  console.error("Database self-healing migration warning:", e);
}
