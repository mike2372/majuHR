import { Permission, UserRole } from '../types';

/**
 * The role-to-permissions mapping.
 * This is the single source of truth for what each role is granted.
 * Deny-by-Default: A permission must be explicitly listed here to be granted.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Admin: ['View_Salary', 'Edit_Tax_Info', 'Manage_Users', 'Approve_Leave'],
  'HR Admin': ['View_Salary', 'Edit_Tax_Info', 'Manage_Users', 'Approve_Leave'],
  Manager: ['View_Salary', 'Approve_Leave'],
  Finance: ['View_Salary', 'Edit_Tax_Info'],
  Employee: [],
};

/**
 * Checks whether a specific permission exists within the JWT claims object.
 * This is a strict Deny-by-Default check — it returns false unless the
 * permission is explicitly found in `claims.permissions`.
 *
 * @param claims - The decoded JWT `app_metadata` object from Supabase.
 * @param permission - The specific permission string to check for.
 * @returns true only if the permission is explicitly granted; false otherwise.
 */
export function hasPermission(
  claims: Record<string, unknown> | null | undefined,
  permission: Permission
): boolean {
  // Deny if no claims object is provided at all
  if (!claims) return false;

  const grantedPermissions = claims['permissions'];

  // Deny if the 'permissions' key is missing or is not an array
  if (!Array.isArray(grantedPermissions)) return false;

  // Deny unless the specific permission string is explicitly included
  return grantedPermissions.includes(permission);
}

/**
 * Checks whether a user has ALL of the specified permissions.
 * Deny-by-Default: Returns false if any single permission is not found.
 */
export function hasAllPermissions(
  claims: Record<string, unknown> | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(claims, p));
}

/**
 * Checks whether a user has AT LEAST ONE of the specified permissions.
 */
export function hasAnyPermission(
  claims: Record<string, unknown> | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(claims, p));
}
