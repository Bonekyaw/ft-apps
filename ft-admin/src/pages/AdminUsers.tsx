import { useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { ROLE_LABELS } from "@/lib/admin-permissions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontalIcon, UserPlusIcon, Trash2Icon, LogOutIcon, KeyIcon } from "lucide-react";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

const ADMIN_ROLES = ["ADMIN", "MANAGER", "OPERATION", "SUPERADMIN"] as const;
const ALL_ROLES = ["USER", "DRIVER", "ADMIN", "MANAGER", "OPERATION", "SUPERADMIN"] as const;

type User = {
  id: string;
  name: string;
  email: string;
  role?: string;
  banned?: boolean;
  image?: string | null;
};

function usePermissions(role: string | undefined) {
  const r = (role ?? "") as (typeof ADMIN_ROLES)[number];
  return {
    canCreate: authClient.admin.checkRolePermission({
      permissions: { user: ["create"] },
      role: r,
    }),
    canSetRole: authClient.admin.checkRolePermission({
      permissions: { user: ["set-role"] },
      role: r,
    }),
    canBan: authClient.admin.checkRolePermission({
      permissions: { user: ["ban"] },
      role: r,
    }),
    canDelete: authClient.admin.checkRolePermission({
      permissions: { user: ["delete"] },
      role: r,
    }),
    canSetPassword: authClient.admin.checkRolePermission({
      permissions: { user: ["set-password"] },
      role: r,
    }),
    canRevokeSession: authClient.admin.checkRolePermission({
      permissions: { session: ["revoke"] },
      role: r,
    }),
  };
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const currentRole = (session?.user?.role as string | undefined) ?? "";
  const permissions = usePermissions(currentRole);

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<{ user: User; ban: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<User | null>(null);
  const [setRoleTarget, setSetRoleTarget] = useState<{ user: User; newRole: string } | null>(null);
  const [setPasswordTarget, setSetPasswordTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [setPasswordPending, setSetPasswordPending] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.admin.listUsers({ query: {} });
      const data = res && typeof res === "object" && "data" in res ? (res as { data: { users?: User[] } }).data : (res as { users?: User[] });
      const all = data?.users ?? [];
      const currentUserId = session?.user?.id;
      const adminUsers = all.filter((u) => {
        const r = (u.role ?? "").toUpperCase();
        if (!(ADMIN_ROLES as readonly string[]).includes(r)) return false;
        // Superadmin sees all admins except their own account
        if (currentUserId && u.id === currentUserId) return false;
        return true;
      });
      setUsers(adminUsers);
      setTotal(adminUsers.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [session?.user?.id]);

  async function handleSetRole(userId: string, role: string) {
    try {
      await authClient.admin.setRole({
        userId,
        role: role as (typeof ADMIN_ROLES)[number],
      });
      setSetRoleTarget(null);
      await loadUsers();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleBan(userId: string, ban: boolean) {
    try {
      if (ban) {
        await authClient.admin.banUser({ userId });
      } else {
        await authClient.admin.unbanUser({ userId });
      }
      setBanTarget(null);
      await loadUsers();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(userId: string) {
    try {
      await authClient.admin.removeUser({ userId });
      setDeleteTarget(null);
      await loadUsers();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRevokeSessions(userId: string) {
    try {
      await authClient.admin.revokeUserSessions({ userId });
      setRevokeTarget(null);
      await loadUsers();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSetPassword(userId: string, password: string) {
    setSetPasswordPending(true);
    try {
      const { error: err } = await authClient.admin.setUserPassword({
        userId,
        newPassword: password,
      });
      if (err) throw new Error(err.message);
      setSetPasswordTarget(null);
      setNewPassword("");
    } catch (e) {
      console.error(e);
    } finally {
      setSetPasswordPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Management</h1>
          <p className="text-muted-foreground">
            Manage admin users (Admin, Manager, Operation, Superadmin). Only superadmins can access this page.
          </p>
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlusIcon className="mr-2 size-4" />
            Create admin user
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin users</CardTitle>
          <CardDescription>
            {total} user{total !== 1 ? "s" : ""} (Admin, Manager, Operation, Superadmin)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={(user.role ?? "ADMIN").toUpperCase()}
                        onValueChange={(value) => setSetRoleTarget({ user, newRole: value })}
                        disabled={!permissions.canSetRole}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role] ?? role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.banned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {permissions.canBan && (
                            <DropdownMenuItem
                              onClick={() => setBanTarget({ user, ban: !user.banned })}
                            >
                              {user.banned ? "Unban user" : "Ban user"}
                            </DropdownMenuItem>
                          )}
                          {permissions.canRevokeSession && (
                            <DropdownMenuItem onClick={() => setRevokeTarget(user)}>
                              <LogOutIcon className="mr-2 size-4" />
                              Revoke all sessions
                            </DropdownMenuItem>
                          )}
                          {permissions.canSetPassword && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSetPasswordTarget(user);
                                setNewPassword("");
                              }}
                            >
                              <KeyIcon className="mr-2 size-4" />
                              Set password
                            </DropdownMenuItem>
                          )}
                          {permissions.canDelete && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(user)}
                            >
                              <Trash2Icon className="mr-2 size-4" />
                              Delete user
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={loadUsers}
      />

      <AlertDialog open={!!setRoleTarget} onOpenChange={() => setSetRoleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change role?</AlertDialogTitle>
            <AlertDialogDescription>
              Change {setRoleTarget?.user.name}&apos;s role to{" "}
              <strong>{setRoleTarget ? ROLE_LABELS[setRoleTarget.newRole] ?? setRoleTarget.newRole : ""}</strong>?
              This will update their permissions immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                setRoleTarget && handleSetRole(setRoleTarget.user.id, setRoleTarget.newRole)
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!banTarget} onOpenChange={() => setBanTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {banTarget?.ban ? "Ban user?" : "Unban user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {banTarget?.ban
                ? `${banTarget.user.name} will be unable to sign in. You can unban them later.`
                : `${banTarget?.user.name} will be able to sign in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => banTarget && handleBan(banTarget.user.id, banTarget.ban)}
              className={banTarget?.ban ? "bg-destructive text-destructive-foreground" : ""}
            >
              {banTarget?.ban ? "Ban" : "Unban"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke all sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.name} will be signed out from all devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTarget && handleRevokeSessions(revokeTarget.id)}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!setPasswordTarget}
        onOpenChange={(open) => !open && setSetPasswordTarget(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Set password</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span>
                Set a new password for {setPasswordTarget?.name}. They can use it to sign in with
                email/password.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (setPasswordTarget && newPassword.trim().length >= 8) {
                handleSetPassword(setPasswordTarget.id, newPassword.trim());
              }
            }}
            className="space-y-4"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="admin-new-password">New password</FieldLabel>
                <Input
                  id="admin-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={setPasswordPending}
                />
              </Field>
            </FieldGroup>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" onClick={() => setSetPasswordTarget(null)}>
                Cancel
              </AlertDialogCancel>
              <Button
                type="submit"
                disabled={setPasswordPending || newPassword.trim().length < 8}
              >
                {setPasswordPending ? "Saving..." : "Set password"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
