import Database from "better-sqlite3";
import path from "node:path";
import crypto from "node:crypto";
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

// 15. Subtasks & Nested Checklist (Phase 67)
db.exec(`
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
`);

// 16. Workflow Automation Rules (Phase 71)
db.exec(`
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
`);

// 17. Workflow Automation Execution Logs (Phase 71)
db.exec(`
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
`);

// 18. Task File Attachments (Phase 72)
db.exec(`
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
`);

// 19. Task Pull Requests & Git Branch Links (Phase 79)
db.exec(`
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
`);

// 20. Workspace API Keys & Developer Tokens (Phase 80)
db.exec(`
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
  insertUser.run("usr-1", "Alex Rivera", "alex@acme.dev", "Admin", null);
  insertUser.run("usr-2", "Sarah Connor", "sarah@acme.dev", "Member", null);
  insertUser.run("usr-3", "Devin Zhao", "devin@acme.dev", "Member", null);
}

// Seed Projects (Acme Corp & DevFlow Studios)
const projectCount = db
  .prepare("SELECT count(*) as count FROM devflow_projects")
  .get().count;
if (projectCount === 0) {
  console.log("Seeding Initial Projects & Tasks...");
  const insertProj = db.prepare(
    "INSERT INTO devflow_projects (id, org_id, name, key, description, status) VALUES (?, ?, ?, ?, ?, ?)",
  );

  // Acme Corp Projects
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

  // DevFlow Studios Projects
  insertProj.run(
    "proj-4",
    "org-2",
    "Mobile Game Engine v2",
    "GAME",
    "Cross-platform 2D/3D mobile graphics pipeline, physics, and input mapping.",
    "Active",
  );
  insertProj.run(
    "proj-5",
    "org-2",
    "Creator Studio Web UI",
    "STUDIO",
    "Visual node editor, asset management, and live shader preview workspace.",
    "Active",
  );

  const insertTask = db.prepare(`
    INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag, due_date, estimated_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Tasks for proj-1 (Acme)
  insertTask.run(
    "task-1",
    "proj-1",
    "Implement OAuth2 provider integration",
    "Connect GitHub and Google OAuth providers with PKCE flow.",
    "Done",
    "High",
    "Alex Rivera",
    "security",
    "2026-09-05",
    8,
  );
  insertTask.run(
    "task-2",
    "proj-1",
    "Configure Redis Rate Limiter middleware",
    "Prevent brute-force authentication attacks using sliding-window rate limit algorithm.",
    "Todo",
    "Urgent",
    "Sarah Connor",
    "backend",
    "2026-09-02",
    4,
  );
  insertTask.run(
    "task-3",
    "proj-1",
    "Setup Automated SQLite Backup S3 Pipeline",
    "Cron job for nightly snapshots and WAL checkpoint integrity checks.",
    "Done",
    "Medium",
    "Devin Zhao",
    "infra",
    "2026-08-28",
    6,
  );
  insertTask.run(
    "task-4",
    "proj-1",
    "Resolve memory leak in WebSocket connection pool",
    "Clean up event listeners on client disconnect to avoid dangling sockets.",
    "Todo",
    "Urgent",
    "Alex Rivera",
    "bug",
    "2026-09-01",
    3,
  );
  insertTask.run(
    "task-5",
    "proj-1",
    "Build responsive project navigation tab strip",
    "Implement horizontal tab scroll on mobile viewports with accessible active indicators.",
    "Review",
    "Medium",
    "Sarah Connor",
    "frontend",
    "2026-09-08",
    5,
  );

  // Tasks for proj-4 (DevFlow Studios)
  insertTask.run(
    "task-20",
    "proj-4",
    "Implement WebGPU Renderer Backend",
    "Next-generation rendering pipeline with compute shaders.",
    "In Progress",
    "High",
    "Alex Rivera",
    "engine",
    "2026-09-10",
    12,
  );
  insertTask.run(
    "task-21",
    "proj-4",
    "Touch Input Gesture Recognizer",
    "Multi-touch pinch, zoom, and joystick controls for mobile.",
    "Todo",
    "Medium",
    "Devin Zhao",
    "mobile",
    "2026-09-15",
    6,
  );

  // Tasks for proj-5 (DevFlow Studios)
  insertTask.run(
    "task-22",
    "proj-5",
    "Node Graph Canvas Drag & Drop",
    "Interactive node-based shader graph editor with undo/redo.",
    "Review",
    "Urgent",
    "Sarah Connor",
    "ui",
    "2026-09-06",
    8,
  );

  // Subtasks for Task 1
  const insertSubtask = db.prepare(`
    INSERT INTO devflow_subtasks (id, task_id, title, is_completed, position)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertSubtask.run(
    "sub-1",
    "task-1",
    "Register GitHub OAuth App credentials",
    1,
    0,
  );
  insertSubtask.run(
    "sub-2",
    "task-1",
    "Implement PKCE token exchange endpoint",
    1,
    1,
  );
  insertSubtask.run(
    "sub-3",
    "task-1",
    "Add user session cookie encryption",
    1,
    2,
  );
  insertSubtask.run(
    "sub-4",
    "task-1",
    "Write integration tests for token refresh",
    1,
    3,
  );

  // Pull Request for Task 1
  const insertPR = db.prepare(`
    INSERT INTO devflow_task_prs (id, task_id, pr_number, pr_title, pr_url, repository, branch_name, status, author_name, additions, deletions, merged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'merged', ?, ?, ?, datetime('now'))
  `);
  insertPR.run(
    "pr-1",
    "task-1",
    42,
    "feat(auth): PKCE OAuth2 Provider Callback Handler",
    "https://github.com/acme/cloud-api/pull/42",
    "acme/cloud-api",
    "feat/PLAT-1-oauth-pkce",
    "Alex Rivera",
    184,
    32,
  );
}

const keyCount = db
  .prepare("SELECT count(*) as count FROM devflow_api_keys")
  .get().count;
if (keyCount === 0) {
  console.log("Seeding Initial Developer API Key...");
  const sampleRawKey = "df_live_sample_token_8892fbc1";
  const sampleHash = crypto
    .createHash("sha256")
    .update(sampleRawKey)
    .digest("hex");
  const insertKey = db.prepare(`
    INSERT INTO devflow_api_keys (id, org_id, user_id, name, key_prefix, key_hash, scopes, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  insertKey.run(
    "key-1",
    "org-1",
    "usr-1",
    "GitHub Actions CI Pipeline",
    "df_live_samp...",
    sampleHash,
    "read:tasks,write:tasks,read:projects",
  );
}

console.log("✅ Database schema and seeds successfully initialized.");
db.close();
