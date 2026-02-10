import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';

/**
 * Access control for admin dashboard.
 * Roles: admin, manager, operation, superadmin (stored in DB as ADMIN, MANAGER, OPERATION, SUPERADMIN).
 */
const statement = {
  ...defaultStatements,
} as const;

const ac = createAccessControl(statement);

/** admin: list, ban (user); revoke (session) */
const adminRole = ac.newRole({
  user: ['list', 'ban'],
  session: ['revoke'],
});

/** manager: list, ban, delete (user); revoke (session) */
const managerRole = ac.newRole({
  user: ['list', 'ban', 'delete'],
  session: ['revoke'],
});

/** operation: same as manager */
const operationRole = ac.newRole({
  user: ['list', 'ban', 'delete'],
  session: ['revoke'],
});

/** superadmin: all user + session permissions */
const superadminRole = ac.newRole({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'delete',
    'set-password',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
});

export const adminAccessControl = ac;
/** Role keys: uppercase for DB/setRole; include lowercase so hasPermission matches session.user.role from any source */
export const adminRoles = {
  ADMIN: adminRole,
  MANAGER: managerRole,
  OPERATION: operationRole,
  SUPERADMIN: superadminRole,
  admin: adminRole,
  manager: managerRole,
  operation: operationRole,
  superadmin: superadminRole,
};
