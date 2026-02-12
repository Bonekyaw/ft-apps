import { createAuthClient } from "better-auth/react";
import { emailOTPClient, adminClient } from "better-auth/client/plugins";

import { adminAccessControl, adminRoles } from "./admin-permissions";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    emailOTPClient(),
    adminClient({ ac: adminAccessControl, roles: adminRoles }),
  ],
});

export const { signIn, signOut, useSession, emailOtp } = authClient;

const DASHBOARD_ADMIN_ROLES = ["ADMIN", "MANAGER", "OPERATION", "SUPERADMIN"];

/** Can access the admin dashboard (any of admin, manager, operation, superadmin). */
export function isAdminRole(role: string | null | undefined): boolean {
  if (role == null) return false;
  return DASHBOARD_ADMIN_ROLES.includes(role.toUpperCase());
}

/** Only superadmin can view user management. */
export function isSuperadminRole(role: string | null | undefined): boolean {
  return role?.toUpperCase() === "SUPERADMIN";
}

/** Only superadmin can view the admin management (Users) page. */
export function canAccessUserManagement(
  role: string | null | undefined,
): boolean {
  return isSuperadminRole(role);
}
