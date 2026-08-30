import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, "../devflow.db");

const db = new Database(dbPath);

console.log("Setting up DevFlow SaaS database at:", dbPath);

// Enable WAL mode
db.pragma("journal_mode = WAL");

// 1. Organizations
db.exec(`
  CREATE TABLE IF NOT EXISTS devflow_organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'Free'
  );
`);

// 2. Users
db.exec(`
  CREATE TABLE IF NOT EXISTS devflow_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'Member',
    avatar_url TEXT
  );
`);

// 3. Projects
db.exec(`
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
`);

// 4. Milestones (Phase 62)
db.exec(`
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
`);

// 5. Tasks (with milestone_id)
db.exec(`
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
`);

// 6. Task Dependencies & Blockers
db.exec(`
  CREATE TABLE IF NOT EXISTS devflow_task_dependencies (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    depends_on_task_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, depends_on_task_id)
  );
`);

// 7. Comments
db.exec(`
  CREATE TABLE IF NOT EXISTS devflow_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES devflow_tasks(id) ON DELETE CASCADE
  );
`);

// 8. Activity Logs
db.exec(`
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
`);

// 9. Notifications
db.exec(`
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
`);

// 10. Workspace Domain Tags
db.exec(`
  CREATE TABLE IF NOT EXISTS devflow_tags (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'cyan',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(org_id, name)
  );
`);

// 11. Webhooks & Integrations
db.exec(`
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
`);

// 12. Webhook Deliveries
db.exec(`
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

// Seed Seed Data
const orgCount = db
  .prepare("SELECT count(*) as count FROM devflow_organizations")
  .get().count;
if (orgCount === 0) {
  console.log("Seeding Initial Organizations...");
  const insertOrg = db.prepare(
    "INSERT INTO devflow_organizations (id, name, slug, plan) VALUES (?, ?, ?, ?)",
  );
  insertOrg.run("org-1", "Acme Corp", "acme-corp", "Enterprise");
  insertOrg.run("org-2", "DevFlow Studios", "devflow-studios", "Pro");
}

const userCount = db
  .prepare("SELECT count(*) as count FROM devflow_users")
  .get().count;
if (userCount === 0) {
  console.log("Seeding Initial Users...");
  const insertUser = db.prepare(
    "INSERT INTO devflow_users (id, name, email, role, avatar_url) VALUES (?, ?, ?, ?, ?)",
  );
  insertUser.run("usr-1", "Nelson", "nelson@devflow.io", "Admin", null);
  insertUser.run("usr-2", "Sarah Chen", "sarah@acme.dev", "Member", null);
  insertUser.run("usr-3", "Alex Kim", "alex@acme.dev", "Member", null);
  insertUser.run("usr-4", "Elena Vance", "elena@acme.dev", "Member", null);
}

const tagCount = db
  .prepare("SELECT count(*) as count FROM devflow_tags")
  .get().count;
if (tagCount === 0) {
  console.log("Seeding Initial Tags...");
  const insertTag = db.prepare(
    "INSERT INTO devflow_tags (id, org_id, name, color, description) VALUES (?, ?, ?, ?, ?)",
  );
  insertTag.run(
    "tag-1",
    "org-1",
    "frontend",
    "purple",
    "Client UI, Next.js components and Tailwind styling.",
  );
  insertTag.run(
    "tag-2",
    "org-1",
    "backend",
    "cyan",
    "API routes, SQLite migrations, and Server Actions.",
  );
  insertTag.run(
    "tag-3",
    "org-1",
    "security",
    "emerald",
    "Auth, RBAC authorization, and data encryption.",
  );
  insertTag.run(
    "tag-4",
    "org-1",
    "infra",
    "amber",
    "Deployment pipelines, Docker containers, and edge cache.",
  );
  insertTag.run(
    "tag-5",
    "org-1",
    "bug",
    "rose",
    "Critical defect resolution and performance regressions.",
  );
  insertTag.run(
    "tag-6",
    "org-1",
    "feature",
    "sky",
    "New feature initiative and product capability.",
  );
}

const milestoneCount = db
  .prepare("SELECT count(*) as count FROM devflow_milestones")
  .get().count;
if (milestoneCount === 0) {
  console.log("Seeding Initial Milestones...");
  const insertMilestone = db.prepare(`
    INSERT INTO devflow_milestones (id, org_id, project_id, title, description, target_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 14);
  const targetIso = targetDate.toISOString().split("T")[0];

  insertMilestone.run(
    "ms-1",
    "org-1",
    "proj-1",
    "Sprint 24: Core Security & Auth Release",
    "Complete authentication hardening, rate limiting, and RBAC authorization flow.",
    targetIso,
    "Active",
  );

  // Link existing tasks in proj-1 to this sprint milestone
  db.prepare(
    "UPDATE devflow_tasks SET milestone_id = 'ms-1' WHERE project_id = 'proj-1'",
  ).run();
}

console.log("✅ Database schema and seeds successfully initialized.");
db.close();
