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
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devflow_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Todo',
    priority TEXT NOT NULL DEFAULT 'Medium',
    assignee_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES devflow_projects(id) ON DELETE CASCADE
  );

  INSERT OR IGNORE INTO devflow_users (id, name, email, role, avatar_url) VALUES
    ('user-1', 'Nelson Rivera', 'nelson@devflow.io', 'Admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'),
    ('user-2', 'Sarah Connor', 'sarah@devflow.io', 'Member', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80'),
    ('user-3', 'Devin Zhao', 'devin@devflow.io', 'Member', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80');

  INSERT OR IGNORE INTO devflow_projects (id, name, key, description, status) VALUES
    ('proj-1', 'Platform Core APIs', 'CORE', 'Core authentication, multi-tenant isolation, and rate limiting services.', 'Active'),
    ('proj-2', 'Customer Dashboard v2', 'DASH', 'Real-time analytics and workflow telemetry dashboard for engineering teams.', 'Planning'),
    ('proj-3', 'CLI Tooling & SDKs', 'CLI', 'Developer command-line interface and client libraries for DevFlow APIs.', 'Completed');

  INSERT OR IGNORE INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name) VALUES
    ('task-101', 'proj-1', 'Implement JWT Session Verification', 'Validate session cookies and decode tenant claims in middleware.', 'In Progress', 'High', 'Nelson Rivera'),
    ('task-102', 'proj-1', 'Configure Redis Rate Limiter', 'Apply 100 req/min bucket per API key for external traffic.', 'Todo', 'Urgent', 'Devin Zhao'),
    ('task-103', 'proj-1', 'Database Isolation Unit Tests', 'Write integration tests ensuring zero data leak across organizations.', 'Review', 'Medium', 'Sarah Connor'),
    ('task-201', 'proj-2', 'Design Telemetry Chart Wireframes', 'Draft Figma components for latency percentiles and error rates.', 'In Progress', 'Medium', 'Sarah Connor');
`);

database.close();

console.log("DevFlow SQL database schema and user seed data are ready.");
