import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useSession } from "@/lib/auth-client";
import { canAccessUserManagement } from "@/lib/auth-client";

/**
 * Renders children only for superadmin. Otherwise redirects to dashboard.
 * Use for routes that only superadmin may access (e.g. user management).
 */
export function SuperadminGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      navigate("/login", { replace: true });
      return;
    }
    const role = session.user.role as string | undefined;
    if (!canAccessUserManagement(role)) {
      navigate("/", { replace: true });
    }
  }, [session, isPending, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!session?.user || !canAccessUserManagement(session.user.role as string | undefined)) {
    return null;
  }
  return <>{children}</>;
}
