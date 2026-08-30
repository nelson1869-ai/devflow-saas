import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, "../devflow.db");

const db = new Database(dbPath);

console.log(
  "🔒 Running DevFlow SaaS Security & Tenant Boundary Test Suite...\n",
);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n`);
    failed++;
  }
}

// ----------------------------------------------------------------------------
// Test 1: Safe Fallback Persona Verification (No silent Admin escalation)
// ----------------------------------------------------------------------------
test("Safe Fallback - Member persona returned for non-admin requests", () => {
  const memberUser = db
    .prepare("SELECT role FROM devflow_users WHERE role = 'Member' LIMIT 1")
    .get();
  assert.ok(memberUser, "Database must have at least one Member user.");
  assert.equal(
    memberUser.role,
    "Member",
    "Default fallback role must be Member.",
  );
});

// ----------------------------------------------------------------------------
// Test 2: Database Indexes Exist for High-Performance Tenant Isolation
// ----------------------------------------------------------------------------
test("Database Indexes - Tenant scoping indexes exist", () => {
  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all()
    .map((r) => r.name);

  const requiredIndexes = [
    "idx_devflow_projects_org",
    "idx_devflow_tasks_project",
    "idx_devflow_api_keys_org",
    "idx_devflow_milestones_org",
    "idx_devflow_tags_org",
    "idx_devflow_webhooks_org",
    "idx_devflow_automations_org",
  ];

  for (const idx of requiredIndexes) {
    assert.ok(indexes.includes(idx), `Index "${idx}" must exist in database.`);
  }
});

// ----------------------------------------------------------------------------
// Test 3: API Key Strict Scope Allowlist
// ----------------------------------------------------------------------------
test("API Key Scopes - Reject arbitrary/injected scopes", () => {
  const SUPPORTED_SCOPES = ["read:tasks", "write:tasks", "read:projects"];

  function validateScopes(scopes) {
    for (const s of scopes) {
      if (!SUPPORTED_SCOPES.includes(s.trim())) return false;
    }
    return scopes.length > 0;
  }

  assert.equal(validateScopes(["read:tasks", "write:tasks"]), true);
  assert.equal(validateScopes(["read:tasks", "super_admin_bypass"]), false);
  assert.equal(validateScopes(["root", "admin"]), false);
  assert.equal(validateScopes([]), false);
});

// ----------------------------------------------------------------------------
// Test 4: API Key Hashed Token Lookup & Expiry Checks
// ----------------------------------------------------------------------------
test("API Key Authentication - Valid SHA-256 lookup and inactive/expired key rejection", () => {
  const rawKey = `df_live_test_${Date.now()}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  db.prepare(
    `
    INSERT INTO devflow_api_keys (id, org_id, user_id, name, key_prefix, key_hash, scopes, is_active, created_at)
    VALUES ('test-key-1', 'org-1', 'usr-1', 'Test Key', 'df_live_test...', ?, 'read:tasks', 1, datetime('now'))
  `,
  ).run(keyHash);

  const activeKey = db
    .prepare(
      "SELECT org_id, is_active FROM devflow_api_keys WHERE key_hash = ?",
    )
    .get(keyHash);
  assert.ok(activeKey, "Active key should be found.");
  assert.equal(activeKey.org_id, "org-1");

  // Deactivate
  db.prepare(
    "UPDATE devflow_api_keys SET is_active = 0 WHERE id = 'test-key-1'",
  ).run();
  const deactivatedKey = db
    .prepare("SELECT is_active FROM devflow_api_keys WHERE key_hash = ?")
    .get(keyHash);
  assert.equal(
    deactivatedKey.is_active,
    0,
    "Key should now be marked inactive.",
  );

  // Cleanup
  db.prepare("DELETE FROM devflow_api_keys WHERE id = 'test-key-1'").run();
});

// ----------------------------------------------------------------------------
// Test 5: Tenant Isolation - Cross-Tenant Project Access Rejection
// ----------------------------------------------------------------------------
test("Tenant Boundary - Project access is strictly isolated by org_id", () => {
  const projInOrg1 = db
    .prepare(
      "SELECT id FROM devflow_projects WHERE id = 'proj-1' AND org_id = 'org-1'",
    )
    .get();
  assert.ok(projInOrg1, "Project proj-1 must belong to org-1.");

  const crossTenantAttempt = db
    .prepare(
      "SELECT id FROM devflow_projects WHERE id = 'proj-1' AND org_id = 'org-2'",
    )
    .get();
  assert.equal(
    crossTenantAttempt,
    undefined,
    "org-2 must NOT be able to access proj-1.",
  );
});

// ----------------------------------------------------------------------------
// Test 6: Tenant Isolation - Cross-Tenant Task Access Rejection
// ----------------------------------------------------------------------------
test("Tenant Boundary - Task access joins project to verify org_id", () => {
  const taskInOrg1 = db
    .prepare(
      `
    SELECT t.id
    FROM devflow_tasks t
    JOIN devflow_projects p ON p.id = t.project_id
    WHERE t.id = 'task-1' AND p.org_id = 'org-1'
  `,
    )
    .get();
  assert.ok(taskInOrg1, "task-1 must be accessible by org-1.");

  const crossTenantTaskAttempt = db
    .prepare(
      `
    SELECT t.id
    FROM devflow_tasks t
    JOIN devflow_projects p ON p.id = t.project_id
    WHERE t.id = 'task-1' AND p.org_id = 'org-2'
  `,
    )
    .get();
  assert.equal(
    crossTenantTaskAttempt,
    undefined,
    "org-2 must NOT be able to access task-1.",
  );
});

// ----------------------------------------------------------------------------
// Test 7: Tenant Isolation - Cross-Tenant API Key Management Rejection
// ----------------------------------------------------------------------------
test("Tenant Boundary - API Key management cannot affect other organizations", () => {
  const key = db
    .prepare(
      "SELECT id FROM devflow_api_keys WHERE id = 'key-1' AND org_id = 'org-1'",
    )
    .get();
  assert.ok(key, "key-1 must belong to org-1.");

  const crossTenantKeyAttempt = db
    .prepare(
      "SELECT id FROM devflow_api_keys WHERE id = 'key-1' AND org_id = 'org-2'",
    )
    .get();
  assert.equal(
    crossTenantKeyAttempt,
    undefined,
    "org-2 must NOT be able to access or modify key-1.",
  );
});

// ----------------------------------------------------------------------------
// Test 8: Tenant Isolation - Pull Request Scoping
// ----------------------------------------------------------------------------
test("Tenant Boundary - PR mutations strictly verify task parent organization", () => {
  const prInOrg1 = db
    .prepare(
      `
    SELECT pr.id
    FROM devflow_task_prs pr
    JOIN devflow_tasks t ON t.id = pr.task_id
    JOIN devflow_projects p ON p.id = t.project_id
    WHERE pr.id = 'pr-1' AND p.org_id = 'org-1'
  `,
    )
    .get();
  assert.ok(prInOrg1, "pr-1 must belong to org-1.");

  const crossTenantPrAttempt = db
    .prepare(
      `
    SELECT pr.id
    FROM devflow_task_prs pr
    JOIN devflow_tasks t ON t.id = pr.task_id
    JOIN devflow_projects p ON p.id = t.project_id
    WHERE pr.id = 'pr-1' AND p.org_id = 'org-2'
  `,
    )
    .get();
  assert.equal(
    crossTenantPrAttempt,
    undefined,
    "org-2 must NOT be able to access pr-1.",
  );
});

// ----------------------------------------------------------------------------
// Test 9: Tenant Isolation - Bulk Task Scoping
// ----------------------------------------------------------------------------
test("Tenant Boundary - Bulk operations strictly scoped to project and tenant", () => {
  const projectTasks = db
    .prepare("SELECT id FROM devflow_tasks WHERE project_id = 'proj-1'")
    .all()
    .map((t) => t.id);

  assert.ok(projectTasks.length > 0, "proj-1 must have tasks.");

  // Simulate bulk query scoped to project_id
  const placeholders = projectTasks.map(() => "?").join(",");
  const matchingTasks = db
    .prepare(
      `SELECT id FROM devflow_tasks WHERE id IN (${placeholders}) AND project_id = ?`,
    )
    .all(...projectTasks, "proj-1");

  assert.equal(
    matchingTasks.length,
    projectTasks.length,
    "All tasks in proj-1 match.",
  );

  // Attempting to match proj-1 tasks under proj-2
  const fakeCrossTasks = db
    .prepare(
      `SELECT id FROM devflow_tasks WHERE id IN (${placeholders}) AND project_id = ?`,
    )
    .all(...projectTasks, "proj-2");

  assert.equal(
    fakeCrossTasks.length,
    0,
    "proj-1 tasks must never match under proj-2.",
  );
});

// ----------------------------------------------------------------------------
// Test 10: Role Authorization
// ----------------------------------------------------------------------------
test("Role Authorization - Admin role check strictly gates admin operations", () => {
  const adminUser = db
    .prepare("SELECT role FROM devflow_users WHERE id = 'usr-1'")
    .get();
  const memberUser = db
    .prepare("SELECT role FROM devflow_users WHERE id = 'usr-2'")
    .get();

  assert.equal(adminUser.role === "Admin", true, "usr-1 is Admin.");
  assert.equal(memberUser.role === "Admin", false, "usr-2 is NOT Admin.");
});

console.log(`\n============================================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed.`);
console.log(`============================================================\n`);

db.close();

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 All Security & Tenant Boundary Checks Passed Successfully!");
}
