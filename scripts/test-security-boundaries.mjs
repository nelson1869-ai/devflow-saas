/**
 * ============================================================================
 * DEVFLOW SAAS — SECURITY & TENANT BOUNDARY AUTOMATED TEST SUITE
 * ============================================================================
 * Runs all security & tenant tests against an ISOLATED TEMPORARY SQLite Database.
 * The production/developer devflow.db is 100% untouched.
 *
 * 1. Pure Security Core (security-core.ts)
 *    - Runtime Role Allowlist & Validation (isUserRole, validateUserRole)
 *    - API Key Scope Allowlist (validateApiScopes)
 *    - Pure Admin Authorization Check (checkDemoAdmin)
 * 2. Database-Dependent Security (security-access.ts via Isolated DB)
 *    - Real SHA-256 API Key Validation & Scope Check (validateApiKeyAndScope)
 *    - Real Expired & Revoked Key Rejection (validateApiKeyAndScope)
 *    - Real Project Tenant Isolation (checkDemoProjectAccess)
 *    - Real Task Tenant Isolation (checkDemoTaskAccess)
 *    - Real Milestone Relational Ownership Guard (checkDemoMilestoneAccess)
 *    - Real API Key Tenant Isolation (checkDemoApiKeyAccess)
 * 3. Database Multi-Tenant B-Tree Performance Indexes
 * ============================================================================
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// 1. Setup Isolated Temporary Database Path BEFORE importing application modules
const tempDbPath = path.join(
  os.tmpdir(),
  `devflow-test-security-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.db`,
);
process.env.DEVFLOW_DB_PATH = tempDbPath;

// 2. Pure Security Core (No DB dependency)
import {
  USER_ROLES,
  isUserRole,
  validateUserRole,
  SUPPORTED_API_SCOPES,
  validateApiScopes,
  checkDemoAdmin,
} from "../src/app/devflow-saas/lib/security-core.ts";

// 3. Dynamically import database and real security access functions with isolated DB
const { db } = await import("../src/app/devflow-saas/lib/db.ts");
const {
  validateApiKeyAndScope,
  checkDemoProjectAccess,
  checkDemoTaskAccess,
  checkDemoMilestoneAccess,
  checkDemoApiKeyAccess,
} = await import("../src/app/devflow-saas/lib/security-access.ts");

console.log("\n============================================================");
console.log("🛡️  RUNNING DEVFLOW REAL SECURITY & BOUNDARY TEST SUITE");
console.log(`📦 ISOLATED TEST DATABASE: ${tempDbPath}`);
console.log("============================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

// ----------------------------------------------------------------------------
// SEED BASELINE TEST FIXTURES IN ISOLATED DATABASE
// ----------------------------------------------------------------------------
db.exec(`
  INSERT INTO devflow_organizations (id, name, slug, plan) VALUES
    ('org-1', 'Acme Corporation', 'acme-corp', 'Pro'),
    ('org-2', 'Beta Industries', 'beta-ind', 'Free');

  INSERT INTO devflow_users (id, name, email, role) VALUES
    ('usr-1', 'Alice Admin', 'alice@acme.com', 'Admin'),
    ('usr-2', 'Bob Member', 'bob@acme.com', 'Member'),
    ('usr-3', 'Charlie Viewer', 'charlie@acme.com', 'Viewer');

  INSERT INTO devflow_projects (id, org_id, name, key, description, status) VALUES
    ('proj-1', 'org-1', 'Core Platform', 'CORE', 'Main infrastructure', 'Active'),
    ('proj-2', 'org-2', 'Beta Project', 'BETA', 'Secondary org project', 'Active');

  INSERT INTO devflow_tasks (id, project_id, title, description, status, priority, assignee_name) VALUES
    ('task-1', 'proj-1', 'Initial Setup', 'Bootstrap repo', 'In Progress', 'High', 'Alice Admin'),
    ('task-2', 'proj-2', 'Beta Task', 'Beta testing task', 'Todo', 'Medium', 'Bob Member');
`);

// ----------------------------------------------------------------------------
// SECTION A: PURE SECURITY CORE TESTS (Zero DB, Zero Network, Pure Functions)
// ----------------------------------------------------------------------------
console.log("--- SECTION A: PURE SECURITY CORE TESTS ---");

// TEST 1: Runtime Role Validation & Strict Allowlist
console.log("TEST 1: Runtime Role Validation & Strict Allowlist");
assert(isUserRole("Admin") === true, "isUserRole('Admin') is valid");
assert(isUserRole("Member") === true, "isUserRole('Member') is valid");
assert(isUserRole("Viewer") === true, "isUserRole('Viewer') is valid");
assert(
  isUserRole("SuperAdmin") === false,
  "isUserRole('SuperAdmin') is rejected",
);
assert(isUserRole("Root") === false, "isUserRole('Root') is rejected");
assert(
  isUserRole("admin") === false,
  "isUserRole('admin') (lowercase) is rejected",
);
assert(isUserRole("Owner") === false, "isUserRole('Owner') is rejected");

const validRoleCheck = validateUserRole("Admin");
assert(
  validRoleCheck.valid && validRoleCheck.role === "Admin",
  "validateUserRole('Admin') succeeds",
);

const invalidRoleCheck = validateUserRole("SuperAdmin");
assert(
  !invalidRoleCheck.valid && invalidRoleCheck.error?.includes("Invalid role"),
  "validateUserRole('SuperAdmin') returns descriptive error",
);

// TEST 2: Pure Admin Authorization Guard
console.log("\nTEST 2: Pure Admin Authorization Guard");
const adminAuth = checkDemoAdmin("Admin");
assert(
  adminAuth.authorized === true,
  "Admin persona is authorized for admin actions",
);

const memberAuth = checkDemoAdmin("Member");
assert(
  !memberAuth.authorized &&
    memberAuth.error?.includes("Administrative privileges"),
  "Member persona is rejected from admin actions",
);

const viewerAuth = checkDemoAdmin("Viewer");
assert(!viewerAuth.authorized, "Viewer persona is rejected from admin actions");

const spoofedRoleAuth = checkDemoAdmin("SuperAdmin");
assert(
  !spoofedRoleAuth.authorized,
  "Unsupported/spoofed role is rejected from admin actions",
);

// TEST 3: API Key Scope Strict Allowlist
console.log("\nTEST 3: API Key Scope Strict Allowlist");
const validScopes = validateApiScopes([
  "read:tasks",
  "write:tasks",
  "read:projects",
]);
assert(
  validScopes.valid && validScopes.validatedScopes.length === 3,
  "Valid supported scopes are accepted",
);

const arbitraryScope = validateApiScopes(["read:tasks", "admin:all"]);
assert(
  !arbitraryScope.valid &&
    arbitraryScope.error?.includes("Unsupported API scope"),
  "Arbitrary scope 'admin:all' is rejected",
);

const oldAdminScope = validateApiScopes(["admin"]);
assert(
  !oldAdminScope.valid &&
    oldAdminScope.error?.includes("Unsupported API scope"),
  "Legacy arbitrary scope 'admin' is rejected",
);

const emptyScopes = validateApiScopes([]);
assert(!emptyScopes.valid, "Empty scopes list is rejected");

// ----------------------------------------------------------------------------
// SECTION B: SERVER-SIDE DATABASE SECURITY & TENANT ACCESS CHECKS
// ----------------------------------------------------------------------------
console.log(
  "\n--- SECTION B: SERVER DATABASE SECURITY & TENANT BOUNDARIES ---",
);

// TEST 4: Real SHA-256 API Key Authentication & Scope Enforcement
console.log("TEST 4: Real SHA-256 API Key Authentication & Scope Enforcement");
const rawApiKey = `df_live_test_${crypto.randomBytes(16).toString("hex")}`;
const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
const testKeyId = `key-test-${Date.now()}`;

db.prepare(
  `
  INSERT INTO devflow_api_keys (id, org_id, user_id, name, key_prefix, key_hash, scopes, is_active)
  VALUES (?, 'org-1', 'usr-1', 'Automated Test Key', ?, ?, 'read:tasks,read:projects', 1)
`,
).run(testKeyId, rawApiKey.slice(0, 15), keyHash);

const validAuth = validateApiKeyAndScope(rawApiKey, "read:tasks");
assert(
  validAuth.valid && validAuth.orgId === "org-1",
  "Valid active API key with granted scope succeeds",
);

const missingScopeAuth = validateApiKeyAndScope(rawApiKey, "write:tasks");
assert(
  !missingScopeAuth.valid &&
    missingScopeAuth.error?.includes("Missing required scope"),
  "API key without 'write:tasks' scope is rejected",
);

const unknownKeyAuth = validateApiKeyAndScope(
  "df_live_unknown_nonexistent_key_999",
  "read:tasks",
);
assert(
  !unknownKeyAuth.valid && unknownKeyAuth.error?.includes("not recognized"),
  "Unknown API key fails authentication",
);

// TEST 5: Real Expired & Revoked API Key Validation
console.log("\nTEST 5: Real Expired & Revoked API Key Validation");
const expiredRawKey = `df_live_expired_${crypto.randomBytes(16).toString("hex")}`;
const expiredHash = crypto
  .createHash("sha256")
  .update(expiredRawKey)
  .digest("hex");
const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

db.prepare(
  `
  INSERT INTO devflow_api_keys (id, org_id, user_id, name, key_prefix, key_hash, scopes, is_active, expires_at)
  VALUES (?, 'org-1', 'usr-1', 'Expired Test Key', ?, ?, 'read:tasks', 1, ?)
`,
).run(
  `key-exp-${Date.now()}`,
  expiredRawKey.slice(0, 15),
  expiredHash,
  yesterdayIso,
);

const expiredAuth = validateApiKeyAndScope(expiredRawKey, "read:tasks");
assert(
  !expiredAuth.valid && expiredAuth.error?.includes("expired"),
  "Real expired API key (expires_at in past) is rejected",
);

const revokedRawKey = `df_live_revoked_${crypto.randomBytes(16).toString("hex")}`;
const revokedHash = crypto
  .createHash("sha256")
  .update(revokedRawKey)
  .digest("hex");

db.prepare(
  `
  INSERT INTO devflow_api_keys (id, org_id, user_id, name, key_prefix, key_hash, scopes, is_active)
  VALUES (?, 'org-1', 'usr-1', 'Revoked Test Key', ?, ?, 'read:tasks', 0)
`,
).run(`key-rev-${Date.now()}`, revokedRawKey.slice(0, 15), revokedHash);

const revokedAuth = validateApiKeyAndScope(revokedRawKey, "read:tasks");
assert(
  !revokedAuth.valid && revokedAuth.error?.includes("revoked or deactivated"),
  "Revoked API key (is_active = 0) is rejected",
);

// TEST 6: Real Tenant Isolation for Projects
console.log("\nTEST 6: Real Tenant Isolation for Projects");
const validProjectAccess = checkDemoProjectAccess("proj-1", "org-1");
assert(
  validProjectAccess.authorized && validProjectAccess.project?.id === "proj-1",
  "Org-1 successfully accesses its own project proj-1",
);

const crossTenantProjectAccess = checkDemoProjectAccess("proj-1", "org-2");
assert(
  !crossTenantProjectAccess.authorized &&
    crossTenantProjectAccess.error?.includes("Project not found"),
  "Org-2 is strictly blocked from accessing Org-1's project proj-1",
);

// TEST 7: Real Tenant Isolation for Tasks
console.log("\nTEST 7: Real Tenant Isolation for Tasks");
const validTaskAccess = checkDemoTaskAccess("task-1", "org-1");
assert(
  validTaskAccess.authorized && validTaskAccess.task?.id === "task-1",
  "Org-1 successfully accesses task task-1",
);

const crossTenantTaskAccess = checkDemoTaskAccess("task-1", "org-2");
assert(
  !crossTenantTaskAccess.authorized &&
    crossTenantTaskAccess.error?.includes("Task not found"),
  "Org-2 is strictly blocked from accessing Org-1's task task-1",
);

// TEST 8: Real Milestone Relational Ownership Guard
console.log("\nTEST 8: Real Milestone Relational Ownership Guard");
const msTestProj1 = "proj-1";
const msTestProj2 = "proj-2";
const msTestId = `ms-test-${Date.now()}`;

db.prepare(
  `
  INSERT INTO devflow_milestones (id, org_id, project_id, title, target_date, status)
  VALUES (?, 'org-1', ?, 'Sprint Milestone 1', '2026-12-31', 'Active')
`,
).run(msTestId, msTestProj1);

const validMsAccess = checkDemoMilestoneAccess(msTestId, msTestProj1, "org-1");
assert(
  validMsAccess.authorized && validMsAccess.milestone?.id === msTestId,
  "Milestone with correct parent project and org succeeds",
);

const crossOrgMsAccess = checkDemoMilestoneAccess(
  msTestId,
  msTestProj1,
  "org-2",
);
assert(
  !crossOrgMsAccess.authorized,
  "Milestone access from different organization org-2 is rejected",
);

const crossProjMsAccess = checkDemoMilestoneAccess(
  msTestId,
  msTestProj2,
  "org-1",
);
assert(
  !crossProjMsAccess.authorized,
  "Milestone assignment to mismatched project proj-2 is rejected",
);

// TEST 9: Real Tenant Isolation for API Keys
console.log("\nTEST 9: Real Tenant Isolation for API Keys");
const validKeyAccess = checkDemoApiKeyAccess(testKeyId, "org-1");
assert(
  validKeyAccess.authorized && validKeyAccess.apiKey?.id === testKeyId,
  "Org-1 accesses its own API key",
);

const crossTenantKeyAccess = checkDemoApiKeyAccess(testKeyId, "org-2");
assert(
  !crossTenantKeyAccess.authorized &&
    crossTenantKeyAccess.error?.includes("API Key not found"),
  "Org-2 is blocked from managing Org-1's API key",
);

// TEST 10: Database Multi-Tenant B-Tree Performance Indexes
console.log("\nTEST 10: Database Multi-Tenant B-Tree Performance Indexes");
const expectedIndexes = [
  "idx_devflow_projects_org",
  "idx_devflow_tasks_project",
  "idx_devflow_api_keys_org",
  "idx_devflow_milestones_org",
  "idx_devflow_tags_org",
  "idx_devflow_webhooks_org",
  "idx_devflow_automations_org",
  "idx_devflow_activities_org",
];

const indexRows = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
  .all();
const existingIndexes = new Set(indexRows.map((r) => r.name));

for (const idxName of expectedIndexes) {
  assert(existingIndexes.has(idxName), `Database index exists: ${idxName}`);
}

// ----------------------------------------------------------------------------
// TEARDOWN & CLEANUP OF ISOLATED TEST DATABASE
// ----------------------------------------------------------------------------
try {
  db.close();
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  if (fs.existsSync(`${tempDbPath}-shm`)) fs.unlinkSync(`${tempDbPath}-shm`);
  if (fs.existsSync(`${tempDbPath}-wal`)) fs.unlinkSync(`${tempDbPath}-wal`);
} catch (err) {
  console.warn("Notice: Cleanup of temporary test database:", err);
}

console.log("\n============================================================");
console.log(`TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log("============================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
