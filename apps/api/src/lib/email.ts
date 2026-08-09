import { Resend } from "resend";
import type { Env } from "../types.js";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSender {
  send(input: SendEmailInput): Promise<void>;
}

export function createEmailSender(env: Env): EmailSender {
  const fromDomain = env.FROM_EMAIL.split("@")[1] ?? "momentum.local";
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY is not set — emails will be logged but not delivered. ` +
        `Set RESEND_API_KEY (and FROM_EMAIL) in .dev.vars / wrangler secrets to enable delivery. ` +
        `Sender domain "${fromDomain}" must be verified in your Resend account.`
    );
    return {
      async send(input: SendEmailInput): Promise<void> {
        console.warn("[email:dev-noop]", {
          from: env.FROM_EMAIL,
          to: input.to,
          subject: input.subject,
          text: input.text.slice(0, 200)
        });
      }
    };
  }

  const client = new Resend(apiKey);

  return {
    async send(input: SendEmailInput): Promise<void> {
      const result = await client.emails.send({
        from: env.FROM_EMAIL,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text
      });

      if (result.error) {
        console.error("[email:send-failed]", {
          to: input.to,
          subject: input.subject,
          error: result.error.message
        });
        throw new Error(`Email send failed: ${result.error.message}`);
      }
    }
  };
}
