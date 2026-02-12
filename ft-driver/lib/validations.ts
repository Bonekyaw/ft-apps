import { z } from "zod";

type Translate = (key: string) => string;

/**
 * Sign-in form schema. Pass translation function for localized error messages.
 */
export function createSignInSchema(t: Translate) {
  return z.object({
    email: z.email(t("auth.errors.emailInvalid")),
  });
}

export type SignInFormValues = z.infer<ReturnType<typeof createSignInSchema>>;
