import { useLocation } from "react-router";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message;

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Family Taxi Admin
      </h1>
      {message && (
        <div className="bg-destructive/10 text-destructive w-full max-w-sm rounded-md border border-destructive/20 px-4 py-3 text-sm">
          {message}
        </div>
      )}
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
