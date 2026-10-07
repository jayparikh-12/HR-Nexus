import type { UserRole } from '../types';

export type CanonicalRole =
  | 'EMPLOYEE'
  | 'HR_MANAGER'
  | 'ADMIN';

export type Permission =
  // Employee self-service
  | 'dashboard:own'
  | 'attendance:own'
  | 'time_off:own'
  | 'payslip:own'
  // HR Management
  | 'employees:view'
  | 'employees:manage'
  | 'contracts:view'
  | 'contracts:manage'
  | 'attendance:manage'
  | 'attendance:review'
  | 'time_off:approve'
  // Payroll Operations
  | 'payrun:draft'
  | 'payrun:validate'
  | 'payrun:mark_paid'
  | 'payslip:generate'
  // Full admin
  | 'admin:unrestricted';

/**
 * Normalizes any role representation into a CanonicalRole
 */
export function normalizeRole(role: string | null | undefined): CanonicalRole {
  if (!role) return 'EMPLOYEE';
  const clean = role.trim().toUpperCase().replace(/\s+/g, '_');

  if (clean.includes('ADMIN')) return 'ADMIN';
  if (clean.includes('HR') || clean.includes('MANAGER') || clean.includes('PAYROLL')) return 'HR_MANAGER';
  if (clean.includes('EMPLOYEE')) return 'EMPLOYEE';
  return 'EMPLOYEE';
}

/**
 * Converts any role to the UI display UserRole type
 */
export function toDisplayRole(role: string | null | undefined): UserRole {
  const canonical = normalizeRole(role);
  switch (canonical) {
    case 'HR_MANAGER':
      return 'HR Manager';
    case 'ADMIN':
      return 'Admin';
    case 'EMPLOYEE':
    default:
      return 'Employee';
  }
}

/**
 * Static permission definitions per role
 */
export const ROLE_PERMISSIONS: Record<CanonicalRole, readonly Permission[]> = {
  EMPLOYEE: [
    'dashboard:own',
    'attendance:own',
    'time_off:own',
    'payslip:own',
  ],

  HR_MANAGER: [
    // Own self-service
    'dashboard:own',
    'attendance:own',
    'time_off:own',
    'payslip:own',
    // HR Management
    'employees:view',
    'employees:manage',
    'contracts:view',
    'contracts:manage',
    'attendance:manage',
    'attendance:review',
    'time_off:approve',
    // Full Payroll operational access
    'payrun:draft',
    'payrun:validate',
    'payrun:mark_paid',
    'payslip:generate',
  ],

  ADMIN: [
    // Unrestricted
    'admin:unrestricted',
    'dashboard:own',
    'attendance:own',
    'time_off:own',
    'payslip:own',
    'employees:view',
    'employees:manage',
    'contracts:view',
    'contracts:manage',
    'attendance:manage',
    'attendance:review',
    'time_off:approve',
    'payrun:draft',
    'payrun:validate',
    'payrun:mark_paid',
    'payslip:generate',
  ],
} as const;

/**
 * Checks if a given role has a specific fine-grained permission
 */
export function hasPermission(
  userRole: string | null | undefined,
  permission: Permission
): boolean {
  const canonical = normalizeRole(userRole);
  if (canonical === 'ADMIN') return true;
  const permissions = ROLE_PERMISSIONS[canonical] || [];
  return permissions.includes(permission);
}

/**
 * Checks whether a given role can access a feature or application module
 */
export function canAccess(
  userRole: string | null | undefined,
  feature: string
): boolean {
  const canonical = normalizeRole(userRole);
  if (canonical === 'ADMIN') return true;

  const normalizedFeature = feature.toLowerCase().trim();

  switch (normalizedFeature) {
    case 'dashboard':
      return true; // All roles have dashboard access (scoped or global)

    case 'employees':
    case 'contracts':
      return hasPermission(canonical, 'employees:view') || hasPermission(canonical, 'contracts:view');

    case 'attendance':
      return true;

    case 'attendance:manage':
      return hasPermission(canonical, 'attendance:manage');

    case 'time-off':
    case 'timeoff':
      return true;

    case 'time-off:approve':
    case 'timeoff:approve':
      return hasPermission(canonical, 'time_off:approve');

    case 'payruns':
    case 'payroll':
      return hasPermission(canonical, 'payrun:draft') || hasPermission(canonical, 'payrun:validate');

    case 'payrun:validate':
      return hasPermission(canonical, 'payrun:validate');

    case 'payrun:mark_paid':
      return hasPermission(canonical, 'payrun:mark_paid');

    case 'payslips':
      return true;

    default:
      return false;
  }
}
