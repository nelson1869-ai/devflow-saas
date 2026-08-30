/**
 * ============================================================================
 * PURE SECURITY CORE & RUNTIME VALIDATORS
 * ============================================================================
 * 100% Pure validation and allowlist logic.
 * NO database connection, NO cookies, NO filesystem, NO external side-effects.
 * ============================================================================
 */

// ============================================================================
// 1. RUNTIME ROLES ALLOWLIST & VALIDATION
// ============================================================================
export const USER_ROLES = ["Admin", "Member", "Viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Runtime Type Guard: Validates if an arbitrary input is a valid UserRole.
 */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

/**
 * Runtime Role Validator returning structured result with descriptive error.
 */
export function validateUserRole(value: unknown): {
  valid: boolean;
  role?: UserRole;
  error?: string;
} {
  if (!isUserRole(value)) {
    return {
      valid: false,
      error: `Invalid role "${String(value)}". Supported roles: ${USER_ROLES.join(", ")}`,
    };
  }
  return { valid: true, role: value };
}

// ============================================================================
// 2. API KEY SCOPES ALLOWLIST & VALIDATION
// ============================================================================
export const SUPPORTED_API_SCOPES = [
  "read:tasks",
  "write:tasks",
  "read:projects",
] as const;

export type ApiScope = (typeof SUPPORTED_API_SCOPES)[number];

/**
 * Validate requested API scopes array against the strict allowlist.
 */
export function validateApiScopes(requestedScopes: readonly string[]): {
  valid: boolean;
  validatedScopes: ApiScope[];
  error?: string;
} {
  const validatedScopes: ApiScope[] = [];

  for (const s of requestedScopes) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (!SUPPORTED_API_SCOPES.includes(trimmed as ApiScope)) {
      return {
        valid: false,
        validatedScopes: [],
        error: `Unsupported API scope: "${trimmed}". Allowed scopes: ${SUPPORTED_API_SCOPES.join(", ")}`,
      };
    }
    if (!validatedScopes.includes(trimmed as ApiScope)) {
      validatedScopes.push(trimmed as ApiScope);
    }
  }

  if (validatedScopes.length === 0) {
    return {
      valid: false,
      validatedScopes: [],
      error: "At least one valid API scope is required.",
    };
  }

  return { valid: true, validatedScopes };
}

// ============================================================================
// 3. PURE AUTHORIZATION ROLE CHECKS
// ============================================================================
/**
 * Pure authorization check for Admin role.
 */
export function checkDemoAdmin(userRole: string): {
  authorized: boolean;
  error?: string;
} {
  if (userRole !== "Admin") {
    return {
      authorized: false,
      error: "Administrative privileges are required for this action.",
    };
  }
  return { authorized: true };
}
