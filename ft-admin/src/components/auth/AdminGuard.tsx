import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { useSession } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/auth-client";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      navigate("/login", { state: { from: location.pathname }, replace: true });
      return;
    }
    const role = session.user.role as string | undefined;
    if (!isAdminRole(role)) {
      navigate("/login", {
        state: { from: location.pathname, message: "Only administrators can access this dashboard." },
        replace: true,
      });
    }
  }, [session, isPending, navigate, location.pathname]);

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!session?.user || !isAdminRole(session.user.role as string | undefined)) {
    return null;
  }
  return <>{children}</>;
}
