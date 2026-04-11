import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { UserRole, Permission } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** 
   * Specific permission required to access this route. 
   * Deny-by-Default: Access is denied unless this permission is explicitly found in JWT claims.
   */
  requiredPermission?: Permission;
  /** 
   * Roles allowed to access this route (legacy/fallback). 
   */
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, requiredPermission, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, hasPermission } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Deny-by-Default Check
  let isAuthorized = false;

  if (requiredPermission) {
    // Priority 1: Check for specific permission in JWT claims
    isAuthorized = hasPermission(requiredPermission);
  } else if (allowedRoles && allowedRoles.length > 0) {
    // Priority 2: Fallback to role check if no specific permission is required
    isAuthorized = allowedRoles.includes(user.role);
  } else {
    // If neither is provided, assume it's just an authenticated route
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 max-w-md">
          <h2 className="text-xl font-bold text-red-900 mb-2">Access Denied</h2>
          <p className="text-red-700 mb-4">
            You do not have the required permissions to view this page. 
          </p>
          
          <div className="bg-white/50 rounded-xl p-4 mb-6 text-left border border-red-200">
            <p className="text-xs font-bold text-red-800 uppercase mb-2 tracking-wider">Session Diagnostics</p>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-gray-700">
                <span className="text-gray-400">Current Role:</span> {user?.role || 'None'}
              </p>
              <p className="text-sm font-medium text-gray-700">
                <span className="text-gray-400">Required:</span> {requiredPermission || 'None (Role Check)'}
              </p>
              <p className="text-xs text-gray-500 break-all">
                <span className="font-bold">Active Permissions:</span> {JSON.stringify(user?.permissions || [])}
              </p>
            </div>
          </div>

          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
