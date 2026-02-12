import { z } from "zod";

type Translate = (key: string) => string;

/**
 * Sign-in form schema. Pass translation function for localized error messages.
 */
export function createSignInSchema(t: Translate) {
  return z.object({
    email: z.email(t("auth.errors.emailInvalid")),
    password: z
      .string()
      .min(1, t("auth.errors.passwordRequired"))
      .min(8, t("auth.errors.passwordMinLength")),
  });
}

export type SignInFormValues = z.infer<ReturnType<typeof createSignInSchema>>;

/**
 * Sign-up form schema. Pass translation function for localized error messages.
 */
export function createSignUpSchema(t: Translate) {
  return z
    .object({
      name: z
        .string()
        .min(1, t("auth.errors.nameRequired"))
        .min(2, t("auth.errors.nameMinLength")),
      email: z.email(t("auth.errors.emailInvalid")),
      password: z
        .string()
        .min(1, t("auth.errors.passwordRequired"))
        .min(8, t("auth.errors.passwordMinLength"))
        .regex(
          /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          t("auth.errors.passwordStrength"),
        ),
      confirmPassword: z
        .string()
        .min(1, t("auth.errors.confirmPasswordRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.errors.passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });
}

export type SignUpFormValues = z.infer<ReturnType<typeof createSignUpSchema>>;

/**
 * Forgot password form schema (email only).
 */
export function createForgotPasswordSchema(t: Translate) {
  return z.object({
    email: z.email(t("auth.errors.emailInvalid")),
  });
}

export type ForgotPasswordFormValues = z.infer<
  ReturnType<typeof createForgotPasswordSchema>
>;

/**
 * Reset password form schema (new password + confirm).
 */
export function createResetPasswordSchema(t: Translate) {
  return z
    .object({
      newPassword: z
        .string()
        .min(1, t("auth.errors.passwordRequired"))
        .min(8, t("auth.errors.passwordMinLength"))
        .regex(
          /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          t("auth.errors.passwordStrength"),
        ),
      confirmPassword: z
        .string()
        .min(1, t("auth.errors.confirmPasswordRequired")),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("auth.errors.passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });
}

export type ResetPasswordFormValues = z.infer<
  ReturnType<typeof createResetPasswordSchema>
>;
