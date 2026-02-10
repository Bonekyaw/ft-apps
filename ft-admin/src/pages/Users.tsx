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
import { MoreHorizontalIcon, Trash2Icon, LogOutIcon } from "lucide-react";

const APP_USER_ROLES = ["USER", "DRIVER"] as const;

type User = {
  id: string;
  name: string;
  email: string;
  role?: string;
  banned?: boolean;
  image?: string | null;
};

function usePermissions(role: string | undefined) {
  const r = (role ?? "") as "ADMIN" | "MANAGER" | "OPERATION" | "SUPERADMIN";
  return {
    canBan: authClient.admin.checkRolePermission({
      permissions: { user: ["ban"] },
      role: r,
    }),
    canDelete: authClient.admin.checkRolePermission({
      permissions: { user: ["delete"] },
      role: r,
    }),
    canRevokeSession: authClient.admin.checkRolePermission({
      permissions: { session: ["revoke"] },
      role: r,
    }),
  };
}

export default function UsersPage() {
  const { data: session } = useSession();
  const currentRole = (session?.user?.role as string | undefined) ?? "";
  const permissions = usePermissions(currentRole);

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<{ user: User; ban: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<User | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.admin.listUsers({ query: {} });
      const data = res && typeof res === "object" && "data" in res ? (res as { data: { users?: User[] } }).data : (res as { users?: User[] });
      const all = data?.users ?? [];
      const appUsers = all.filter(
        (u) => APP_USER_ROLES.includes((u.role ?? "USER").toUpperCase() as "USER" | "DRIVER")
      );
      setUsers(appUsers);
      setTotal(appUsers.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage riders and drivers. All admins can view this page.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riders &amp; drivers</CardTitle>
          <CardDescription>
            {total} user{total !== 1 ? "s" : ""} (User and Driver roles only)
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
                      <Badge variant="outline">
                        {ROLE_LABELS[(user.role ?? "USER").toUpperCase()] ?? user.role ?? "User"}
                      </Badge>
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
                            <DropdownMenuItem
                              onClick={() => setRevokeTarget(user)}
                            >
                              <LogOutIcon className="mr-2 size-4" />
                              Revoke all sessions
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
    </div>
  );
}
