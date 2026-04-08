import React, { ReactNode } from 'react';
import { Permission } from '../types';
import { useUser } from '../contexts/UserContext';

interface RequirePermissionProps {
  /** The exact permission string required to render the children. */
  permission: Permission;
  /** Optional custom fallback UI. If omitted, nothing is rendered on deny. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * A Deny-by-Default permission gate component.
 *
 * Renders `children` ONLY if the current user's JWT claims explicitly contain
 * the specified `permission`. If the permission is not found, renders the
 * optional `fallback` (or nothing at all).
 *
 * Usage:
 *   <RequirePermission permission="View_Salary">
 *     <SalaryDetails />
 *   </RequirePermission>
 *
 *   <RequirePermission permission="Edit_Tax_Info" fallback={<p>No access.</p>}>
 *     <TaxEditor />
 *   </RequirePermission>
 */
export function RequirePermission({
  permission,
  fallback = null,
  children,
}: RequirePermissionProps) {
  const { hasPermission } = useUser();

  // Deny-by-Default: only render children if permission is explicitly granted
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
