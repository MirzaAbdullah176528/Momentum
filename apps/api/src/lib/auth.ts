import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDb, schema } from "@momentum/db";
import { createEmailSender } from "./email.js";
import { getAllowedOrigins } from "./origins.js";
import type { Env } from "../types.js";

const APP_NAME = "Momentum";

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;
const SESSION_COOKIE_CACHE_MAX_AGE_SECONDS = 5 * 60;

const RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS = 60 * 30;
const VERIFICATION_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24;

const EMAIL_VERIFICATION_CALLBACK_PATH = "/auth/verify-email";
const RESET_PASSWORD_CALLBACK_PATH = "/auth/reset-password";

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 10 characters long and contain lowercase, uppercase, a digit, and a symbol.";

export function validatePasswordPolicy(password: string): {
  ok: boolean;
  reason?: string;
} {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`
    };
  }
  if (!PASSWORD_POLICY_REGEX.test(password)) {
    return {
      ok: false,
      reason: PASSWORD_POLICY_MESSAGE
    };
  }
  return { ok: true };
}

export function buildAuthOptions(env: Env) {
  const sender = createEmailSender(env);
  const db = createDb(env.DB);
  const baseUrl = env.BETTER_AUTH_URL;
  // Single source of truth for trusted browser origins, shared with CORS and
  // CSRF so all three agree. In production this includes WEB_ORIGINS (set per
  // deployment, e.g. the Vercel frontend URL) so auth works without code changes.
  const trustedOrigins = getAllowedOrigins(env);

  return betterAuth({
    appName: APP_NAME,
    baseURL: baseUrl,
    trustedOrigins,
    secret: env.BETTER_AUTH_SECRET,
    useSecureCookies: env.APP_ENV === "production",

    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      usePlural: false,
      transaction: false
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
      revokeSessionsOnPasswordReset: true,

      sendResetPassword: async ({ user, url, token }) => {
        const redirectUrl = buildCallbackUrl(
          baseUrl,
          RESET_PASSWORD_CALLBACK_PATH,
          { token }
        );
        await sender.send({
          to: user.email,
          subject: `Reset your ${APP_NAME} password`,
          text: `Hi ${user.name},\n\nWe received a request to reset your ${APP_NAME} password.\n\nReset it here: ${redirectUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can safely ignore this email.\n\n— ${APP_NAME}`,
          html: renderPasswordResetEmail({
            name: user.name,
            resetUrl: redirectUrl,
            rawToken: token,
            rawUrl: url
          })
        });
      }
    },

    emailVerification: {
      sendVerificationEmail: async ({ user, url, token }) => {
        const redirectUrl = buildCallbackUrl(
          baseUrl,
          EMAIL_VERIFICATION_CALLBACK_PATH,
          { token }
        );
        await sender.send({
          to: user.email,
          subject: `Verify your ${APP_NAME} email`,
          text: `Hi ${user.name},\n\nVerify your email address: ${redirectUrl}\n\nThis link expires in 24 hours.\n\n— ${APP_NAME}`,
          html: renderVerificationEmail({
            name: user.name,
            verifyUrl: redirectUrl,
            rawToken: token,
            rawUrl: url
          })
        });
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: VERIFICATION_TOKEN_EXPIRES_IN_SECONDS
    },

    user: {
      additionalFields: {
        username: {
          type: "string",
          required: true,
          unique: true,
          input: true,
          validator: (value) => {
            if (typeof value !== "string") return false;
            return /^[a-zA-Z0-9_-]{3,30}$/.test(value);
          }
        },
        timezone: {
          type: "string",
          required: false,
          input: true,
          defaultValue: "Asia/Karachi"
        }
      }
    },

    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      cookieCache: {
        enabled: true,
        maxAge: SESSION_COOKIE_CACHE_MAX_AGE_SECONDS
      }
    },

    rateLimit: {
      enabled: true,
      storage: "memory",
      rules: {
        signUp: {
          max: 5,
          window: 60,
          pathMatcher: (path) => path === "/api/auth/sign-up/email"
        },
        signIn: {
          max: 10,
          window: 60,
          pathMatcher: (path) => path === "/api/auth/sign-in/email"
        },
        passwordReset: {
          max: 3,
          window: 60,
          pathMatcher: (path) =>
            path === "/api/auth/request-password-reset" ||
            path === "/api/auth/reset-password"
        }
      }
    },

    advanced: {
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.APP_ENV === "production",
        path: "/"
      },
      ipAddress: {
        ipAddressHeaders: [
          "cf-connecting-ip",
          "x-forwarded-for",
          "x-real-ip",
          "x-client-ip"
        ]
      }
    }
  });
}

export type AuthInstance = ReturnType<typeof buildAuthOptions>;

export function createAuth(env: Env): AuthInstance {
  return buildAuthOptions(env);
}

function buildCallbackUrl(
  baseUrl: string | undefined,
  path: string,
  params: Record<string, string>
): string {
  const origin = baseUrl ?? "http://localhost:3000";
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

interface EmailContentInput {
  name: string;
  verifyUrl?: string;
  resetUrl?: string;
  rawToken: string;
  rawUrl: string;
}

function renderVerificationEmail(input: EmailContentInput): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #0f172a;">
    <h1 style="font-size: 22px; margin: 0 0 16px;">Verify your email</h1>
    <p style="margin: 0 0 16px; line-height: 1.5;">Hi ${escapeHtml(input.name)},</p>
    <p style="margin: 0 0 24px; line-height: 1.5;">Confirm your email address to finish setting up your ${APP_NAME} account.</p>
    <p style="margin: 0 0 8px;">
      <a href="${escapeAttr(input.verifyUrl ?? input.rawUrl)}" style="display: inline-block; background: #7c5cff; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Verify email</a>
    </p>
    <p style="margin: 16px 0 0; color: #64748b; font-size: 13px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
  </body>
</html>`;
}

function renderPasswordResetEmail(input: EmailContentInput): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #0f172a;">
    <h1 style="font-size: 22px; margin: 0 0 16px;">Reset your password</h1>
    <p style="margin: 0 0 16px; line-height: 1.5;">Hi ${escapeHtml(input.name)},</p>
    <p style="margin: 0 0 24px; line-height: 1.5;">We received a request to reset your ${APP_NAME} password. Click below to choose a new one.</p>
    <p style="margin: 0 0 8px;">
      <a href="${escapeAttr(input.resetUrl ?? input.rawUrl)}" style="display: inline-block; background: #7c5cff; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset password</a>
    </p>
    <p style="margin: 16px 0 0; color: #64748b; font-size: 13px;">This link expires in 30 minutes. If you didn't request a reset, your password is still safe — you can ignore this email.</p>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
