/**
 * Creates the local SQLite tables and inserts repeatable learning data.
 * Run automatically before `npm run dev` and `npm run build`.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "learning.db");

mkdirSync(dataDirectory, { recursive: true });

const database = new Database(databasePath);

database.pragma("foreign_keys = ON");

database.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0)
  );

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

  CREATE TABLE IF NOT EXISTS devflow_projects (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL DEFAULT 'org-1',
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
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
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_title TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES devflow_organizations(id) ON DELETE CASCADE
  );
`);

// Migration: ensure org_id column exists on existing devflow_projects table
try {
  database.exec(
    "ALTER TABLE devflow_projects ADD COLUMN org_id TEXT NOT NULL DEFAULT 'org-1'",
  );
} catch {
  // Column already exists
}

// Migration: ensure tag column exists on existing devflow_tasks table
try {
  database.exec(
    "ALTER TABLE devflow_tasks ADD COLUMN tag TEXT NOT NULL DEFAULT 'feature'",
  );
} catch {
  // Column already exists
}

// Migration: ensure due_date column exists on existing devflow_tasks table
try {
  database.exec("ALTER TABLE devflow_tasks ADD COLUMN due_date TEXT");
} catch {
  // Column already exists
}

database.exec(`
  -- Seed Organizations
  INSERT OR IGNORE INTO devflow_organizations (id, name, slug) VALUES
    ('org-1', 'Acme Engineering', 'acme'),
    ('org-2', 'Stark Industries', 'stark');

  -- Seed Users
  INSERT OR IGNORE INTO devflow_users (id, name, email, role, avatar_url) VALUES
    ('user-1', 'Nelson Rivera', 'nelson@devflow.io', 'Admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'),
    ('user-2', 'Sarah Connor', 'sarah@devflow.io', 'Member', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80'),
    ('user-3', 'Devin Zhao', 'devin@devflow.io', 'Member', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80');

  -- Seed Projects (Acme Engineering: org-1)
  INSERT OR IGNORE INTO devflow_projects (id, org_id, name, key, description, status) VALUES
    ('proj-1', 'org-1', 'Platform Core APIs', 'CORE', 'Core authentication, multi-tenant isolation, and rate limiting services.', 'Active'),
    ('proj-2', 'org-1', 'Customer Dashboard v2', 'DASH', 'Real-time analytics and workflow telemetry dashboard for engineering teams.', 'Planning'),
    ('proj-3', 'org-1', 'CLI Tooling & SDKs', 'CLI', 'Developer command-line interface and client libraries for DevFlow APIs.', 'Completed');

  -- Seed Projects (Stark Industries: org-2)
  INSERT OR IGNORE INTO devflow_projects (id, org_id, name, key, description, status) VALUES
    ('proj-4', 'org-2', 'Arc Reactor Grid Management', 'ARC', 'Clean energy distribution telemetry and decentralized load balancing.', 'Active'),
    ('proj-5', 'org-2', 'Jarvis Neural Assistant v4', 'JARV', 'Edge inference neural network pipeline for autonomous diagnostics.', 'Planning');

  -- Seed Tasks (Acme Engineering)
  INSERT OR IGNORE INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag, due_date) VALUES
    ('task-101', 'proj-1', 'Implement JWT Session Verification', 'Validate session cookies in middleware:&#10;- [x] Decode RSA public key&#10;- [ ] Check tenant claims and permissions&#10;- [ ] Verify expired token handling', 'In Progress', 'High', 'Nelson Rivera', 'security', date('now', '+3 days')),
    ('task-102', 'proj-1', 'Configure Redis Rate Limiter', 'Apply 100 req/min bucket per API key for external traffic.', 'Todo', 'Urgent', 'Devin Zhao', 'backend', date('now')),
    ('task-103', 'proj-1', 'Database Isolation Unit Tests', 'Write integration tests ensuring zero data leak across organizations.', 'Review', 'Medium', 'Sarah Connor', 'infra', date('now', '-2 days')),
    ('task-201', 'proj-2', 'Design Telemetry Chart Wireframes', 'Draft Figma components for latency percentiles and error rates.', 'In Progress', 'Medium', 'Sarah Connor', 'frontend', date('now', '+7 days'));

  -- Seed Tasks (Stark Industries)
  INSERT OR IGNORE INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name, tag, due_date) VALUES
    ('task-401', 'proj-4', 'Thermal Safety Interlocks', 'Calibrate magnetic containment sensors for 100GW output spikes.', 'In Progress', 'Urgent', 'Nelson Rivera', 'infra', date('now', '+1 day')),
    ('task-501', 'proj-5', 'Optimize Attention Mechanism', 'Quantize transformer weights for on-device flight helmet compute.', 'Todo', 'High', 'Devin Zhao', 'backend', date('now', '+5 days'));

  -- Explicitly update existing tasks with due dates and tags
  UPDATE devflow_tasks SET due_date = date('now', '+3 days'), tag = 'security' WHERE id = 'task-101';
  UPDATE devflow_tasks SET due_date = date('now'), tag = 'backend' WHERE id = 'task-102';
  UPDATE devflow_tasks SET due_date = date('now', '-2 days'), tag = 'infra' WHERE id = 'task-103';
  UPDATE devflow_tasks SET due_date = date('now', '+7 days'), tag = 'frontend' WHERE id = 'task-201';
  UPDATE devflow_tasks SET due_date = date('now', '+1 day'), tag = 'infra' WHERE id = 'task-401';
  UPDATE devflow_tasks SET due_date = date('now', '+5 days'), tag = 'backend' WHERE id = 'task-501';

  -- Seed Comments
  INSERT OR IGNORE INTO devflow_comments (id, task_id, user_id, user_name, content, created_at) VALUES
    ('comm-1', 'task-101', 'user-2', 'Sarah Connor', 'Verified the RSA public key rotation logic. Looking solid!', datetime('now', '-25 minutes')),
    ('comm-2', 'task-101', 'user-1', 'Nelson Rivera', 'Thanks Sarah! Adding unit tests for tenant claims decoding now.', datetime('now', '-10 minutes')),
    ('comm-3', 'task-102', 'user-1', 'Nelson Rivera', 'We should use Redis token bucket algorithm with a 60-second window.', datetime('now', '-45 minutes'));

  -- Seed Notifications (Acme Engineering)
  INSERT OR IGNORE INTO devflow_notifications (id, user_id, org_id, title, message, type, link_url, is_read, created_at) VALUES
    ('notif-1', 'user-1', 'org-1', 'New Comment on your Task', 'Sarah Connor commented on "Implement JWT Session Verification"', 'comment', '/devflow-saas/projects/proj-1', 0, datetime('now', '-15 minutes')),
    ('notif-2', 'user-1', 'org-1', 'Task Assigned to You', 'You were assigned to lead Platform Core APIs authentication deliverables.', 'assignment', '/devflow-saas/projects/proj-1', 0, datetime('now', '-1 hour')),
    ('notif-3', 'user-1', 'org-1', 'Task Status Moved', 'Database Isolation Unit Tests moved to Review stage.', 'status', '/devflow-saas/projects/proj-1', 0, datetime('now', '-2 hours')),
    ('notif-4', 'user-2', 'org-1', 'Task Assigned', 'You were assigned to Database Isolation Unit Tests.', 'assignment', '/devflow-saas/projects/proj-1', 0, datetime('now', '-3 hours'));

  -- Seed Activity Log
  INSERT OR IGNORE INTO devflow_activity (id, org_id, project_id, user_name, action, entity_title, details, created_at) VALUES
    ('act-1', 'org-1', 'proj-1', 'Nelson Rivera', 'created_project', 'Platform Core APIs', 'Initial project repository established.', datetime('now', '-2 hours')),
    ('act-2', 'org-1', 'proj-1', 'Sarah Connor', 'created_task', 'Database Isolation Unit Tests', 'Assigned to Sarah Connor with Medium priority.', datetime('now', '-90 minutes')),
    ('act-3', 'org-1', 'proj-1', 'Nelson Rivera', 'updated_task_status', 'Implement JWT Session Verification', 'Status moved from Todo to In Progress.', datetime('now', '-45 minutes')),
    ('act-4', 'org-2', 'proj-4', 'Nelson Rivera', 'created_project', 'Arc Reactor Grid Management', 'Clean energy telemetry initialized.', datetime('now', '-3 hours')),
    ('act-5', 'org-2', 'proj-4', 'Nelson Rivera', 'created_task', 'Thermal Safety Interlocks', 'Marked Urgent priority.', datetime('now', '-1 hour'));
`);

database.close();

console.log("DevFlow database schema with notifications is ready.");
