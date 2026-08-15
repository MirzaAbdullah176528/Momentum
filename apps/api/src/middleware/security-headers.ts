import type { MiddlewareHandler } from "hono";
import { getAllowedOrigins } from "../lib/origins.js";
import type { Env } from "../types.js";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
  "X-DNS-Prefetch-Control": "off",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin"
};

function buildCsp(env: Env): string {
  // Same allow-list as CORS/CSRF/better-auth so the browser is permitted to
  // make the same cross-origin calls the API trusts.
  const allowedOrigins = getAllowedOrigins(env);

  return [
    "default-src 'none'",
    `connect-src 'self' ${allowedOrigins.join(" ")}`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    "img-src 'self' data:",
    "style-src 'unsafe-inline'",
    "object-src 'none'",
    "upgrade-insecure-requests"
  ].join("; ");
}

export const securityHeaders = (): MiddlewareHandler => {
  return async (c, next) => {
    await next();

    const env = (c.env as Env) ?? ({} as Partial<Env> as Env);

    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      c.header(key, value);
    }

    c.header("Content-Security-Policy", buildCsp(env));

    if (env.APP_ENV === "production") {
      c.header(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload"
      );
    }
  };
};
