import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';

import { prisma } from './db.js';
import { sendOTPEmail, sendResetPasswordEmail } from './email.js';
import { passwordSchema } from './validation.js';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql', // or "mysql", "postgresql", ...etc
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    process.env.BETTER_AUTH_TRUSTED_ORIGINS || 'http://localhost:5173',
    'familytaxidriver://',
    'familytaxiuser://',
    // Development mode - Expo's exp:// scheme with local IP ranges
    ...(process.env.NODE_ENV === 'development'
      ? [
          'exp://', // Trust all Expo URLs (prefix matching)
          'exp://**', // Trust all Expo URLs (wildcard matching)
          'exp://192.168.*.*:*/**', // Trust 192.168.x.x IP range with any port and path
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
      },
      phone: {
        type: 'string',
        required: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  plugins: [
    expo(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendOTPEmail({
          to: email,
          otp,
          type,
        });
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(
      // eslint-disable-next-line @typescript-eslint/require-await
      async (ctx) => {
        if (
          ctx.path === '/sign-up/email' ||
          ctx.path === '/reset-password' ||
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
      },
    ),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
