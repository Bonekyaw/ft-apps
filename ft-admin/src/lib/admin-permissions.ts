import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Must match ft-api admin-permissions (same statement and role definitions).
 * Roles: ADMIN, MANAGER, OPERATION, SUPERADMIN.
 */
const statement = { ...defaultStatements } as const;

const ac = createAccessControl(statement);

const adminRole = ac.newRole({
  user: ["list", "ban"],
  session: ["revoke"],
});

const managerRole = ac.newRole({
  user: ["list", "ban", "delete"],
  session: ["revoke"],
});

const operationRole = ac.newRole({
  user: ["list", "ban", "delete"],
  session: ["revoke"],
});

const superadminRole = ac.newRole({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
});

export const adminAccessControl = ac;
export const adminRoles = {
  ADMIN: adminRole,
  MANAGER: managerRole,
  OPERATION: operationRole,
  SUPERADMIN: superadminRole,
};

export const ROLE_LABELS: Record<string, string> = {
  USER: "User",
  DRIVER: "Driver",
  ADMIN: "Admin",
  MANAGER: "Manager",
  OPERATION: "Operation",
  SUPERADMIN: "Superadmin",
};
