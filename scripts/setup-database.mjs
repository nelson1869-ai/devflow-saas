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

// 5. Tasks
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
    estimated_hours REAL NOT NULL DEFAULT 0,
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

// 13. Saved Filter Views (Phase 64)
db.exec(`
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
`);

// 14. Time Logs (Phase 66)
db.exec(`
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
`);

// Seed Initial Data
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

const projectCount = db
  .prepare("SELECT count(*) as count FROM devflow_projects")
  .get().count;
if (projectCount === 0) {
  console.log("Seeding Initial Projects & Tasks...");
  const insertProj = db.prepare(
    "INSERT INTO devflow_projects (id, org_id, name, key, description, status) VALUES (?, ?, ?, ?, ?, ?)",
  );
  insertProj.run(
    "proj-1",
    "org-1",
    "Cloud Platform API",
    "PLAT",
    "Core backend microservices, authentication flow, and REST endpoints.",
    "Active",
  );
  insertProj.run(
    "proj-2",
    "org-1",
    "Customer Mobile App",
    "MOB",
    "React Native cross-platform mobile experience with offline sync.",
    "Active",
  );
  insertProj.run(
    "proj-3",
    "org-1",
    "Web Admin Console",
    "ADM",
    "Internal tooling, customer success controls, and billing analytics.",
    "Planning",
  );

  const insertTask = db.prepare(`
    INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTask.run(
    "task-1",
    "proj-1",
    "Implement OAuth2 provider integration",
    "Connect GitHub and Google OAuth providers with PKCE flow.",
    "In Progress",
    "High",
    "Nelson",
    "security",
    "2026-09-05",
  );

  insertTask.run(
    "task-2",
    "proj-1",
    "Configure Redis Rate Limiter middleware",
    "Prevent brute-force authentication attacks using sliding-window rate limit algorithm.",
    "Todo",
    "Urgent",
    "Sarah Chen",
    "backend",
    "2026-09-02",
  );

  insertTask.run(
    "task-3",
    "proj-1",
    "Setup Automated SQLite Backup S3 Pipeline",
    "Cron job for nightly snapshots and WAL checkpoint integrity checks.",
    "Done",
    "Medium",
    "Alex Kim",
    "infra",
    "2026-08-28",
  );

  insertTask.run(
    "task-4",
    "proj-1",
    "Resolve memory leak in WebSocket connection pool",
    "Clean up event listeners on client disconnect to avoid dangling sockets.",
    "Todo",
    "Urgent",
    "Nelson",
    "bug",
    "2026-09-01",
  );

  insertTask.run(
    "task-5",
    "proj-1",
    "Build responsive project navigation tab strip",
    "Implement horizontal tab scroll on mobile viewports with accessible active indicators.",
    "Review",
    "Medium",
    "Elena Vance",
    "frontend",
    "2026-09-08",
  );
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

const savedViewCount = db
  .prepare("SELECT count(*) as count FROM devflow_saved_views")
  .get().count;
if (savedViewCount === 0) {
  console.log("Seeding Initial Saved Filter Views...");
  const insertView = db.prepare(`
    INSERT INTO devflow_saved_views (id, org_id, user_id, project_id, name, icon, filters_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertView.run(
    "view-1",
    "org-1",
    "usr-1",
    "proj-1",
    "Urgent Bugs",
    "🔥",
    JSON.stringify({
      priority: "Urgent",
      tag: "bug",
      status: "All",
      assignee: "All",
      query: "",
    }),
  );

  insertView.run(
    "view-2",
    "org-1",
    "usr-1",
    "proj-1",
    "Frontend Features",
    "🎨",
    JSON.stringify({
      priority: "All",
      tag: "frontend",
      status: "All",
      assignee: "All",
      query: "",
    }),
  );
}

console.log("✅ Database schema and seeds successfully initialized.");
db.close();
