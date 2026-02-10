import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient, isAdminRole } from "@/lib/auth-client";

export function OTPForm(props: React.ComponentProps<typeof Card>) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const email = searchParams.get("email") ?? "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Missing email. Please start from the login page.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const { data, error: err } = await authClient.signIn.emailOtp({
        email,
        otp: value,
      });
      if (err) {
        setError(err.message ?? "Invalid or expired code");
        return;
      }
      // Only allow admin users into the dashboard (session user may include role from DB)
      const user = data?.user as { role?: string } | undefined;
      if (!isAdminRole(user?.role)) {
        await authClient.signOut();
        setError("Only administrators can access this dashboard.");
        return;
      }
      // wait 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      navigate("/", { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (!email) {
    return (
      <Card {...props}>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            No email provided. Please{" "}
            <a href="/login" className="underline">
              log in
            </a>{" "}
            first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card {...props}>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Enter verification code</CardTitle>
        <CardDescription>
          We sent a 6-digit code to <strong>{email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="otp-form" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="otp" className="sr-only">
                Verification code
              </FieldLabel>
              <InputOTP
                maxLength={6}
                id="otp"
                pattern={REGEXP_ONLY_DIGITS}
                value={value}
                onChange={(v) => setValue(v)}
              >
                <InputOTPGroup className="mx-auto flex w-full max-w-[16rem] justify-center gap-2 sm:gap-3 [&_input]:text-center">
                  <InputOTPSlot
                    index={0}
                    className="h-12 w-10 rounded-lg border-2 border-input bg-background text-lg font-semibold shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:h-14 sm:w-12"
                  />
                  <InputOTPSlot
                    index={1}
                    className="h-12 w-10 rounded-lg border-2 border-input bg-background text-lg font-semibold shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:h-14 sm:w-12"
                  />
                  <InputOTPSlot
                    index={2}
                    className="h-12 w-10 rounded-lg border-2 border-input bg-background text-lg font-semibold shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:h-14 sm:w-12"
                  />
                  <InputOTPSlot
                    index={3}
                    className="h-12 w-10 rounded-lg border-2 border-input bg-background text-lg font-semibold shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:h-14 sm:w-12"
                  />
                  <InputOTPSlot
                    index={4}
                    className="h-12 w-10 rounded-lg border-2 border-input bg-background text-lg font-semibold shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:h-14 sm:w-12"
                  />
                  <InputOTPSlot
                    index={5}
                    className="h-12 w-10 rounded-lg border-2 border-input bg-background text-lg font-semibold shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:h-14 sm:w-12"
                  />
                </InputOTPGroup>
              </InputOTP>
              <FieldDescription className="text-center">
                Enter the 6-digit code sent to your email.
              </FieldDescription>
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              form="otp-form"
              disabled={pending || value.length !== 6}
            >
              {pending ? "Signing in..." : "Sign in"}
            </Button>
            <FieldDescription className="text-center">
              <a href="/login" className="underline">
                Use a different email
              </a>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
