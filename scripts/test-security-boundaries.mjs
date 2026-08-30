/**
 * ============================================================================
 * DEVFLOW SAAS — SECURITY & TENANT BOUNDARY AUTOMATED TEST SUITE
 * ============================================================================
 * Exercises the REAL production security functions from security-core.ts:
 * 1. Runtime role validator & allowlist
 * 2. Admin authorization guards
 * 3. API key scope allowlist & format check
 * 4. Real SHA-256 API key authentication & scope enforcement
 * 5. Real expired & revoked API key rejection
 * 6. Tenant project access isolation
 * 7. Tenant task access isolation
 * 8. Milestone relational ownership (cross-project / cross-org defense)
 * 9. Tenant API key management isolation
 * 10. Database multi-tenant B-Tree performance indexes
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
  validateApiKeyAndScope,
  checkDemoAdmin,
  checkDemoProjectAccess,
  checkDemoTaskAccess,
  checkDemoMilestoneAccess,
  checkDemoApiKeyAccess,
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
// TEST 1: Runtime Role Validation & Strict Allowlist
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// TEST 2: Real Admin Authorization Guard
// ----------------------------------------------------------------------------
console.log("\nTEST 2: Real Admin Authorization Guard");
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

// ----------------------------------------------------------------------------
// TEST 3: API Key Scope Strict Allowlist
// ----------------------------------------------------------------------------
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
// TEST 4: Real SHA-256 API Key Authentication & Scope Enforcement
// ----------------------------------------------------------------------------
console.log(
  "\nTEST 4: Real SHA-256 API Key Authentication & Scope Enforcement",
);
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

// ----------------------------------------------------------------------------
// TEST 5: Real Expired & Revoked API Key Validation
// ----------------------------------------------------------------------------
console.log("\nTEST 5: Real Expired & Revoked API Key Validation");
// Expired Key: Set expires_at to yesterday
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

// Revoked Key: is_active = 0
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

// ----------------------------------------------------------------------------
// TEST 6: Real Tenant Isolation for Projects
// ----------------------------------------------------------------------------
console.log("\nTEST 6: Real Tenant Isolation for Projects");
// Proj-1 belongs to org-1
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

// ----------------------------------------------------------------------------
// TEST 7: Real Tenant Isolation for Tasks
// ----------------------------------------------------------------------------
console.log("\nTEST 7: Real Tenant Isolation for Tasks");
// Find a task in org-1
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
  const validTaskAccess = checkDemoTaskAccess(org1Task.id, "org-1");
  assert(
    validTaskAccess.authorized && validTaskAccess.task?.id === org1Task.id,
    `Org-1 successfully accesses task ${org1Task.id}`,
  );

  const crossTenantTaskAccess = checkDemoTaskAccess(org1Task.id, "org-2");
  assert(
    !crossTenantTaskAccess.authorized &&
      crossTenantTaskAccess.error?.includes("Task not found"),
    `Org-2 is strictly blocked from accessing Org-1's task ${org1Task.id}`,
  );
}

// ----------------------------------------------------------------------------
// TEST 8: Real Milestone Ownership & Cross-Project / Cross-Org Defense
// ----------------------------------------------------------------------------
console.log("\nTEST 8: Real Milestone Relational Ownership Guard");
// Setup test project and milestone in org-1
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

// ----------------------------------------------------------------------------
// TEST 9: Real Tenant Isolation for API Keys
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// TEST 10: Database Multi-Tenant B-Tree Performance Indexes
// ----------------------------------------------------------------------------
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
