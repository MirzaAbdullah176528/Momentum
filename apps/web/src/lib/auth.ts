import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { BetterAuthOptions } from "better-auth";

const baseURL =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8787";

type ServerOptions = BetterAuthOptions & {
  user: {
    additionalFields: {
      username: { type: "string"; required: boolean; input: boolean };
      timezone: { type: "string"; required: boolean; input: boolean };
    };
  };
};

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: "include"
  },
  plugins: [inferAdditionalFields<ServerOptions>()]
});

export interface AuthSession {
  session: {
    id: string;
    token: string;
    expiresAt: string;
    userId: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    username: string;
    timezone: string;
    createdAt: string;
    updatedAt: string;
  };
}
