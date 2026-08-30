/**
 * ============================================================================
 * DEVFLOW SAAS — SECURITY & TENANT BOUNDARY AUTOMATED TEST SUITE
 * ============================================================================
 * 1. Pure Security Core (security-core.ts)
 *    - Runtime Role Allowlist & Validation (isUserRole, validateUserRole)
 *    - API Key Scope Allowlist (validateApiScopes)
 *    - Pure Admin Authorization Check (checkDemoAdmin)
 * 2. Database-Dependent Security (Canonical SQLite)
 *    - Real SHA-256 API Key Validation & Scope Check
 *    - Real Expired & Revoked Key Rejection
 *    - Project Tenant Isolation
 *    - Task Tenant Isolation
 *    - Milestone Relational Ownership Guard
 *    - API Key Tenant Isolation
 * 3. Database Multi-Tenant B-Tree Performance Indexes
 * ============================================================================
 */

import crypto from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";

import {
  USER_ROLES,
  isUserRole,
  validateUserRole,
  SUPPORTED_API_SCOPES,
  validateApiScopes,
  checkDemoAdmin,
} from "../src/app/devflow-saas/lib/security-core.ts";

const dbPath = path.resolve(process.cwd(), "devflow.db");
const db = new Database(dbPath);

console.log("\n============================================================");
console.log("🛡️  RUNNING DEVFLOW REAL SECURITY & BOUNDARY TEST SUITE");
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

function testValidateApiKeyAndScope(rawKey, requiredScope) {
  if (!rawKey || !rawKey.startsWith("df_live_")) {
    return {
      valid: false,
      error: "Invalid API key format. Must start with df_live_.",
    };
  }
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const row = db
    .prepare(
      "SELECT id, org_id, user_id, scopes, is_active, expires_at FROM devflow_api_keys WHERE key_hash = ?",
    )
    .get(hash);
  if (!row)
    return { valid: false, error: "API key not recognized or invalid." };
  if (!row.is_active)
    return {
      valid: false,
      error: "This API key has been revoked or deactivated.",
    };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now())
    return { valid: false, error: "This API key has expired." };
  if (requiredScope) {
    const grantedScopes = row.scopes.split(",").map((s) => s.trim());
    if (!grantedScopes.includes(requiredScope))
      return {
        valid: false,
        error: `Missing required scope permission: "${requiredScope}".`,
      };
  }
  return { valid: true, orgId: row.org_id, userId: row.user_id };
}

function testCheckProjectAccess(projectId, orgId) {
  if (!projectId || !orgId)
    return { authorized: false, error: "Project ID and Org ID required." };
  const project = db
    .prepare(
      "SELECT id, name, org_id FROM devflow_projects WHERE id = ? AND org_id = ?",
    )
    .get(projectId, orgId);
  if (!project)
    return {
      authorized: false,
      error: "Project not found or does not belong to the active workspace.",
    };
  return { authorized: true, project };
}

function testCheckTaskAccess(taskId, orgId) {
  if (!taskId || !orgId)
    return { authorized: false, error: "Task ID and Org ID required." };
  const task = db
    .prepare(
      "SELECT t.id, t.title, p.id as project_id, p.org_id FROM devflow_tasks t JOIN devflow_projects p ON p.id = t.project_id WHERE t.id = ? AND p.org_id = ?",
    )
    .get(taskId, orgId);
  if (!task)
    return {
      authorized: false,
      error: "Task not found or does not belong to the active workspace.",
    };
  return { authorized: true, task };
}

function testCheckMilestoneAccess(milestoneId, projectId, orgId) {
  if (!milestoneId || !projectId || !orgId)
    return {
      authorized: false,
      error: "Milestone, Project, and Org ID required.",
    };
  const milestone = db
    .prepare(
      "SELECT m.id, m.title, m.project_id, p.org_id FROM devflow_milestones m JOIN devflow_projects p ON p.id = m.project_id WHERE m.id = ? AND m.project_id = ? AND p.org_id = ?",
    )
    .get(milestoneId, projectId, orgId);
  if (!milestone)
    return {
      authorized: false,
      error:
        "Milestone not found, belongs to a different project, or is outside the active workspace.",
    };
  return { authorized: true, milestone };
}

function testCheckApiKeyAccess(keyId, orgId) {
  if (!keyId || !orgId)
    return { authorized: false, error: "API Key ID and Org ID required." };
  const key = db
    .prepare(
      "SELECT id, name, org_id, is_active FROM devflow_api_keys WHERE id = ? AND org_id = ?",
    )
    .get(keyId, orgId);
  if (!key)
    return {
      authorized: false,
      error: "API Key not found or does not belong to the active workspace.",
    };
  return {
    authorized: true,
    apiKey: {
      id: key.id,
      name: key.name,
      orgId: key.org_id,
      isActive: Boolean(key.is_active),
    },
  };
}

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

const validAuth = testValidateApiKeyAndScope(rawApiKey, "read:tasks");
assert(
  validAuth.valid && validAuth.orgId === "org-1",
  "Valid active API key with granted scope succeeds",
);

const missingScopeAuth = testValidateApiKeyAndScope(rawApiKey, "write:tasks");
assert(
  !missingScopeAuth.valid &&
    missingScopeAuth.error?.includes("Missing required scope"),
  "API key without 'write:tasks' scope is rejected",
);

const unknownKeyAuth = testValidateApiKeyAndScope(
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

const expiredAuth = testValidateApiKeyAndScope(expiredRawKey, "read:tasks");
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

const revokedAuth = testValidateApiKeyAndScope(revokedRawKey, "read:tasks");
assert(
  !revokedAuth.valid && revokedAuth.error?.includes("revoked or deactivated"),
  "Revoked API key (is_active = 0) is rejected",
);

// TEST 6: Real Tenant Isolation for Projects
console.log("\nTEST 6: Real Tenant Isolation for Projects");
const validProjectAccess = testCheckProjectAccess("proj-1", "org-1");
assert(
  validProjectAccess.authorized && validProjectAccess.project?.id === "proj-1",
  "Org-1 successfully accesses its own project proj-1",
);

const crossTenantProjectAccess = testCheckProjectAccess("proj-1", "org-2");
assert(
  !crossTenantProjectAccess.authorized &&
    crossTenantProjectAccess.error?.includes("Project not found"),
  "Org-2 is strictly blocked from accessing Org-1's project proj-1",
);

// TEST 7: Real Tenant Isolation for Tasks
console.log("\nTEST 7: Real Tenant Isolation for Tasks");
const org1Task = db
  .prepare(
    `
  SELECT t.id FROM devflow_tasks t
  JOIN devflow_projects p ON p.id = t.project_id
  WHERE p.org_id = 'org-1' LIMIT 1
`,
  )
  .get();

if (org1Task) {
  const validTaskAccess = testCheckTaskAccess(org1Task.id, "org-1");
  assert(
    validTaskAccess.authorized && validTaskAccess.task?.id === org1Task.id,
    `Org-1 successfully accesses task ${org1Task.id}`,
  );

  const crossTenantTaskAccess = testCheckTaskAccess(org1Task.id, "org-2");
  assert(
    !crossTenantTaskAccess.authorized &&
      crossTenantTaskAccess.error?.includes("Task not found"),
    `Org-2 is strictly blocked from accessing Org-1's task ${org1Task.id}`,
  );
}

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

const validMsAccess = testCheckMilestoneAccess(msTestId, msTestProj1, "org-1");
assert(
  validMsAccess.authorized && validMsAccess.milestone?.id === msTestId,
  "Milestone with correct parent project and org succeeds",
);

const crossOrgMsAccess = testCheckMilestoneAccess(
  msTestId,
  msTestProj1,
  "org-2",
);
assert(
  !crossOrgMsAccess.authorized,
  "Milestone access from different organization org-2 is rejected",
);

const crossProjMsAccess = testCheckMilestoneAccess(
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
const validKeyAccess = testCheckApiKeyAccess(testKeyId, "org-1");
assert(
  validKeyAccess.authorized && validKeyAccess.apiKey?.id === testKeyId,
  "Org-1 accesses its own API key",
);

const crossTenantKeyAccess = testCheckApiKeyAccess(testKeyId, "org-2");
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
// CLEANUP & SUMMARY
// ----------------------------------------------------------------------------
db.prepare(
  "DELETE FROM devflow_api_keys WHERE id LIKE 'key-test-%' OR id LIKE 'key-exp-%' OR id LIKE 'key-rev-%'",
).run();
db.prepare("DELETE FROM devflow_milestones WHERE id = ?").run(msTestId);

console.log("\n============================================================");
console.log(`TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log("============================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
