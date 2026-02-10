import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ROLE_LABELS } from "@/lib/admin-permissions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  UserIcon,
  MailIcon,
  LockIcon,
  ShieldIcon,
  AlertCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CREATE_USER_ROLES = [
  "USER",
  "DRIVER",
  "ADMIN",
  "MANAGER",
  "OPERATION",
  "SUPERADMIN",
] as const;

const ADMIN_ROLES = ["ADMIN", "MANAGER", "OPERATION", "SUPERADMIN"] as const;

type CreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("USER");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: err } = await authClient.admin.createUser({
        name,
        email,
        password,
        role: role as "ADMIN" | "MANAGER" | "OPERATION" | "SUPERADMIN",
      });
      if (err) {
        setError(err.message ?? "Failed to create user");
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setRole("USER");
      onOpenChange(false);
      onSuccess();
    } catch {
      setError("Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l bg-card sm:max-w-lg"
      >
        <SheetHeader className="space-y-1.5 pb-2">
          <SheetTitle className="text-xl font-semibold tracking-tight">
            Create user
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm leading-relaxed">
            Add a new user to the platform. They can sign in with email OTP or
            the password you set.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-auto px-2"
        >
          <div className="flex flex-1 flex-col gap-6 px-1 py-2">
            {error && (
              <div
                role="alert"
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
                  "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                <p className="leading-snug">{error}</p>
              </div>
            )}

            <section className="space-y-4">
              <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Account details
              </h3>
              <FieldGroup className="gap-4">
                <Field className="gap-2">
                  <FieldLabel
                    htmlFor="create-name"
                    className="text-muted-foreground flex items-center gap-2 text-sm font-medium"
                  >
                    <UserIcon className="size-3.5" />
                    Name
                  </FieldLabel>
                  <Input
                    id="create-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={pending}
                    placeholder="Full name"
                    className="h-9"
                  />
                </Field>
                <Field className="gap-2">
                  <FieldLabel
                    htmlFor="create-email"
                    className="text-muted-foreground flex items-center gap-2 text-sm font-medium"
                  >
                    <MailIcon className="size-3.5" />
                    Email
                  </FieldLabel>
                  <Input
                    id="create-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={pending}
                    placeholder="user@example.com"
                    className="h-9"
                  />
                </Field>
                <Field className="gap-2">
                  <FieldLabel
                    htmlFor="create-password"
                    className="text-muted-foreground flex items-center gap-2 text-sm font-medium"
                  >
                    <LockIcon className="size-3.5" />
                    Password
                  </FieldLabel>
                  <Input
                    id="create-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={pending}
                    placeholder="••••••••"
                    className="h-9"
                  />
                  <p className="text-muted-foreground text-xs">
                    At least 8 characters
                  </p>
                </Field>
              </FieldGroup>
            </section>

            <Separator className="my-1" />

            <section className="space-y-4">
              <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Role
              </h3>
              <Field className="gap-2">
                <FieldLabel className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <ShieldIcon className="size-3.5" />
                  Assign role
                </FieldLabel>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as string)}
                  disabled={pending}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>App roles</SelectLabel>
                      {(
                        CREATE_USER_ROLES.filter(
                          (r) =>
                            !(ADMIN_ROLES as readonly string[]).includes(r),
                        ) as string[]
                      ).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r] ?? r}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Admin roles</SelectLabel>
                      {ADMIN_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r] ?? r}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </section>
          </div>

          <Separator className="mt-auto shrink-0" />

          <SheetFooter className="flex-row gap-2 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="min-w-24"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="min-w-28">
              {pending ? "Creating…" : "Create user"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
