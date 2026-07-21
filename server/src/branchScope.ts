import { TokenPayload } from "./auth";

/**
 * The single place branch access is resolved for a request.
 *
 * SUPER_ADMIN: unrestricted — uses whatever branch was requested (query/body),
 * or "" (no filter / must be supplied) exactly as before.
 *
 * ADMIN: may work in multiple branches (see Admin.branches). If the request
 * asks for a specific branch, it's honored only when the admin is actually
 * assigned to it; otherwise falls back to their primary/home branch. A
 * single-branch admin behaves exactly as before this feature existed.
 */
export function resolveBranchId(user: TokenPayload, requested?: string | null): string {
  if (user.role !== "ADMIN") {
    return requested ?? "";
  }
  const allowed = user.branchIds && user.branchIds.length ? user.branchIds : user.branchId ? [user.branchId] : [];
  if (requested && allowed.includes(requested)) {
    return requested;
  }
  return user.branchId ?? allowed[0] ?? "";
}

/**
 * Every branch this admin may work in. Empty for SUPER_ADMIN, who is
 * unrestricted — callers must treat "empty" as "no branch filter".
 */
export function allowedBranchIds(user: TokenPayload): string[] {
  if (user.role !== "ADMIN") return [];
  return user.branchIds && user.branchIds.length ? user.branchIds : user.branchId ? [user.branchId] : [];
}

/** Does this admin have access to the given branch? SUPER_ADMIN always does. */
export function hasBranchAccess(user: TokenPayload, branchId: string): boolean {
  if (user.role !== "ADMIN") return true;
  return allowedBranchIds(user).includes(branchId);
}
