import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api';
import { emailOTP, admin, bearer } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import dotenv from 'dotenv';

dotenv.config();
import { adminAccessControl, adminRoles } from './admin-permissions.js';
import { prisma } from './db.js';
import { sendOTPEmail, sendResetPasswordEmail } from './email.js';
import { passwordSchema } from './validation.js';

const DASHBOARD_ADMIN_ROLES = ['ADMIN', 'MANAGER', 'OPERATION', 'SUPERADMIN'];

/** Rider app sends this origin; only USER role is allowed. */
const RIDER_APP_ORIGIN_PREFIX = 'ftuser://';
/** Driver app sends this origin; only DRIVER role is allowed. */
const DRIVER_APP_ORIGIN_PREFIX = 'ftdriver://';

type AuthCtx = {
  request?: Request;
  headers?: Headers | Record<string, string>;
};

function getHeaders(ctx: AuthCtx): Headers | null {
  const raw = ctx.request?.headers ?? ctx.headers;
  if (!raw) return null;
  return raw instanceof Headers ? raw : new Headers(raw as HeadersInit);
}

function getExpoOrigin(ctx: AuthCtx): string | null {
  const h = getHeaders(ctx);
  return h?.get('expo-origin') ?? null;
}

/** True when request is from Expo rider/driver app (expo-origin or x-skip-oauth-proxy set by Expo client). */
function isMobileAppRequest(ctx: AuthCtx): boolean {
  const h = getHeaders(ctx);
  if (!h) return false;
  const origin = h.get('expo-origin') ?? '';
  if (
    origin.startsWith(RIDER_APP_ORIGIN_PREFIX) ||
    origin.startsWith(DRIVER_APP_ORIGIN_PREFIX)
  )
    return true;
  if (h.get('x-skip-oauth-proxy') === 'true') return true;
  return false;
}

function normalizeRole(role: unknown): string {
  if (typeof role === 'string') return role.toUpperCase();
  if (role == null || typeof role === 'object') return '';
  if (typeof role === 'number' || typeof role === 'boolean')
    return String(role);
  return '';
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql', // or "mysql", "postgresql", ...etc
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
      ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',').map((o) => o.trim())
      : []),
    'ftdriver://',
    'ftuser://',
    // Development mode - Expo's exp:// scheme with local IP ranges
    ...(process.env.NODE_ENV === 'development'
      ? [
          'exp://*/*',
          'exp://10.0.0.*:*/*',
          'exp://192.168.*.*:*/*',
          'exp://172.*.*.*:*/*',
          'exp://localhost:*/*',
        ]
      : []),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: 'select_account', // Always show Google account selection UI
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      await sendResetPasswordEmail({
        to: user.email,
        userName: user.name,
        resetUrl: url,
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        input: false,
        defaultValue: 'USER',
        // Prisma UserRole enum expects uppercase (USER, DRIVER, etc.); normalize for social login and any lowercase source
        transform: {
          input: (v: unknown) =>
            typeof v === 'string' ? v.toUpperCase() : 'USER',
        },
      },
      phone: {
        type: 'string',
        required: false,
      },
    },
  },
  // session: {
  //   cookieCache: {
  //     enabled: true,
  //     maxAge: 5 * 60, // 5 minutes
  //   },
  // },
  account: {
    storeStateStrategy: 'database',
    skipStateCookieCheck: true, // Required for proxy plugin
  },
  plugins: [
    bearer(), // Accept Authorization: Bearer <session_token> so mobile app can send token on API calls
    admin({
      ac: adminAccessControl,
      roles: adminRoles,
      adminRoles: DASHBOARD_ADMIN_ROLES,
    }),
    expo(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const trimmedEmail = email.trim().toLowerCase();

        // ── Universal safety: block unapproved drivers from receiving sign-in OTPs ──
        if (type === 'sign-in') {
          const user = await prisma.user.findUnique({
            where: { email: trimmedEmail },
            select: { id: true, role: true },
          });
          const role = normalizeRole(user?.role);

          if (role === 'DRIVER' && user) {
            const driver = await prisma.driver.findUnique({
              where: { userId: user.id },
              select: { approvalStatus: true },
            });
            if (!driver || driver.approvalStatus !== 'APPROVED') {
              const msg =
                driver?.approvalStatus === 'PENDING'
                  ? 'Your account is pending verification. Please wait for admin approval.'
                  : driver?.approvalStatus === 'REJECTED'
                    ? 'Your account has been rejected. Please contact support.'
                    : driver?.approvalStatus === 'SUSPENDED'
                      ? 'Your driver account has been suspended. Please contact support.'
                      : 'Your driver profile is not active.';
              throw new APIError('FORBIDDEN', { message: msg });
            }
          }
        }

        // ── Block forgot-password OTP for driver accounts (drivers use OTP login, not passwords) ──
        if (type === 'forget-password') {
          const user = await prisma.user.findUnique({
            where: { email: trimmedEmail },
            select: { role: true },
          });
          const role = normalizeRole(user?.role);

          if (role === 'DRIVER') {
            throw new APIError('FORBIDDEN', {
              message:
                'Password reset is not available for driver accounts. Drivers sign in using email code only.',
            });
          }
        }

        await sendOTPEmail({
          to: email,
          otp,
          type,
        });
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Mobile apps: block admins entirely; only USER in rider app, only DRIVER in driver app
      const expoOrigin = getExpoOrigin(ctx);
      const isMobile = isMobileAppRequest(ctx);

      if (ctx.path === '/get-session' && isMobile) {
        const session = await getSessionFromCtx(ctx);
        if (session) {
          const role = normalizeRole(session.user?.role);
          if (DASHBOARD_ADMIN_ROLES.includes(role)) {
            throw new APIError('FORBIDDEN', {
              message:
                'Admins cannot use the mobile app. Sign in on the admin dashboard.',
            });
          }
          if (
            expoOrigin?.startsWith(RIDER_APP_ORIGIN_PREFIX) &&
            role !== 'USER'
          ) {
            throw new APIError('FORBIDDEN', {
              message:
                'This app is for riders only. Use the rider app with a rider account.',
            });
          }
          if (
            expoOrigin?.startsWith(DRIVER_APP_ORIGIN_PREFIX) &&
            role !== 'DRIVER'
          ) {
            throw new APIError('FORBIDDEN', {
              message:
                'This app is for drivers only. Use the driver app with a driver account.',
            });
          }
        }
      }

      // All /admin/* routes (including has-permission) require a session with an admin role
      if (ctx.path.startsWith('/admin')) {
        const session = await getSessionFromCtx(ctx);
        if (!session) throw new APIError('UNAUTHORIZED');
        const rawRole = session.user?.role as string | undefined;
        const role =
          typeof rawRole === 'string'
            ? rawRole.toUpperCase()
            : String(rawRole ?? '').toUpperCase();
        if (!role || !DASHBOARD_ADMIN_ROLES.includes(role)) {
          throw new APIError('FORBIDDEN', {
            message: 'Admin access required.',
          });
        }
      }
      // ── Helper: enforce mobile role + driver approval ──
      async function enforceMobileRoleAndApproval(
        email: string,
        mobile: boolean,
        origin: string | null,
      ) {
        const trimmedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email: trimmedEmail },
          select: { id: true, role: true },
        });
        const role = normalizeRole(user?.role);

        if (mobile) {
          // Block admin roles on any mobile app
          if (DASHBOARD_ADMIN_ROLES.includes(role)) {
            throw new APIError('FORBIDDEN', {
              message:
                'Admins cannot use the mobile app. Sign in on the admin dashboard.',
            });
          }
          // Rider app: only USER role
          if (origin?.startsWith(RIDER_APP_ORIGIN_PREFIX) && role !== 'USER') {
            throw new APIError('FORBIDDEN', {
              message: 'This app is for riders only. Use a rider account.',
            });
          }
          // Driver app: only DRIVER role
          if (
            origin?.startsWith(DRIVER_APP_ORIGIN_PREFIX) &&
            role !== 'DRIVER'
          ) {
            throw new APIError('FORBIDDEN', {
              message: 'This app is for drivers only. Use a driver account.',
            });
          }
          // Driver app: must be approved
          if (
            origin?.startsWith(DRIVER_APP_ORIGIN_PREFIX) &&
            role === 'DRIVER' &&
            user
          ) {
            const driver = await prisma.driver.findUnique({
              where: { userId: user.id },
              select: { approvalStatus: true },
            });
            if (!driver || driver.approvalStatus !== 'APPROVED') {
              throw new APIError('FORBIDDEN', {
                message:
                  driver?.approvalStatus === 'PENDING'
                    ? 'Your account is pending verification. Please wait for admin approval.'
                    : driver?.approvalStatus === 'REJECTED'
                      ? 'Your account has been rejected. Please contact support.'
                      : 'Your driver profile is not active.',
              });
            }
          }
        } else {
          // Web (admin dashboard): only admin roles
          if (!role || !DASHBOARD_ADMIN_ROLES.includes(role)) {
            throw new APIError('FORBIDDEN', {
              message: 'Only administrators can sign in here.',
            });
          }
        }
      }

      // ── Block: send-verification-otp (before OTP is sent) ──
      const isSendOtpPath =
        ctx.path === '/email-otp/send-verification-otp' ||
        ctx.path.endsWith('send-verification-otp');
      if (isSendOtpPath) {
        const body = ctx.body as { email?: string; type?: string };
        if (body.type === 'sign-in' && body.email) {
          await enforceMobileRoleAndApproval(body.email, isMobile, expoOrigin);
        }
      }

      // ── Block: sign-in/email-otp (before session is created) ──
      if (
        ctx.path === '/sign-in/email-otp' ||
        ctx.path.endsWith('/email-otp')
      ) {
        const body = ctx.body as { email?: string };
        if (body.email && isMobile) {
          await enforceMobileRoleAndApproval(body.email, true, expoOrigin);
        }
      }

      // ── Block: sign-in/email (email+password, before session is created) ──
      if (ctx.path === '/sign-in/email') {
        const body = ctx.body as { email?: string };
        if (body.email && isMobile) {
          await enforceMobileRoleAndApproval(body.email, true, expoOrigin);
        }
      }
      // Password strength validation
      if (
        ctx.path === '/sign-up/email' ||
        ctx.path === '/reset-password' ||
        ctx.path === '/email-otp/reset-password' ||
        ctx.path === '/change-password'
      ) {
        const body = ctx.body as { password?: string; newPassword?: string };
        const password = body.password || body.newPassword;
        const { error } = passwordSchema.safeParse(password);
        if (error) {
          throw new APIError('BAD_REQUEST', {
            message: 'Password not strong enough',
          });
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Safety-net: after any sign-in from a mobile app, enforce role + approval
      if (!isMobileAppRequest(ctx)) return;

      // Try multiple structures better-auth may use for the response
      const raw = ctx.context?.returned as Record<string, unknown> | undefined;
      if (!raw) return;

      // Extract user — may be at top-level or nested in body/json
      const user = (raw.user ??
        (raw.body as Record<string, unknown> | undefined)?.user ??
        (raw.json as Record<string, unknown> | undefined)?.user) as
        | { id?: string; role?: unknown }
        | undefined;
      if (!user) return;

      // Extract session token
      const session = (raw.session ??
        (raw.body as Record<string, unknown> | undefined)?.session) as
        | { token?: string }
        | undefined;
      const token = (raw.token as string | undefined) ?? session?.token;
      if (!token) return;

      const role = normalizeRole(user.role);
      const adapter = ctx.context?.internalAdapter as
        | { deleteSession?: (t: string) => Promise<unknown> }
        | undefined;

      async function revokeAndBlock(message: string): Promise<never> {
        await adapter?.deleteSession?.(token!);
        throw new APIError('FORBIDDEN', { message });
      }

      if (DASHBOARD_ADMIN_ROLES.includes(role)) {
        await revokeAndBlock(
          'Admins cannot use the mobile app. Sign in on the admin dashboard.',
        );
      }

      const expoOrigin = getExpoOrigin(ctx);

      if (expoOrigin?.startsWith(RIDER_APP_ORIGIN_PREFIX) && role !== 'USER') {
        await revokeAndBlock(
          'This app is for riders only. Use the rider app with a rider account.',
        );
      }

      if (
        expoOrigin?.startsWith(DRIVER_APP_ORIGIN_PREFIX) &&
        role !== 'DRIVER'
      ) {
        await revokeAndBlock(
          'This app is for drivers only. Use the driver app with a driver account.',
        );
      }

      // Block unapproved drivers after sign-in
      if (
        expoOrigin?.startsWith(DRIVER_APP_ORIGIN_PREFIX) &&
        role === 'DRIVER' &&
        user.id
      ) {
        const driver = await prisma.driver.findUnique({
          where: { userId: user.id },
          select: { approvalStatus: true },
        });
        if (!driver || driver.approvalStatus !== 'APPROVED') {
          await revokeAndBlock(
            driver?.approvalStatus === 'PENDING'
              ? 'Your account is pending verification. Please wait for admin approval.'
              : driver?.approvalStatus === 'REJECTED'
                ? 'Your account has been rejected. Please contact support.'
                : 'Your driver profile is not active.',
          );
        }
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
