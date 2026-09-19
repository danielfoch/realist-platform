/**
 * Transactional email (sign-in links, lead notifications) through Resend's REST
 * API — no SDK. With RESEND_API_KEY unset, emailConfigured() is false and the
 * surfaces that depend on email hide themselves rather than half-working.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Overridable for tests against a local stand-in; production only ever talks to Resend. */
function endpoint(): string {
  const override = process.env.RESEND_ENDPOINT?.trim();
  return override && process.env.NODE_ENV !== "production" ? override : RESEND_ENDPOINT;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "Realist <hello@realist.ca>";
}

export async function sendEmail(input: {
  to: string | string[];
  cc?: string[];
  replyTo?: string;
  headers?: Record<string, string>;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email is not configured");
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress(),
      to: Array.isArray(input.to) ? input.to : [input.to],
      ...(input.cc?.length ? { cc: input.cc } : {}),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      ...(input.headers ? { headers: input.headers } : {}),
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });
  if (!response.ok) throw new Error(`Email send failed: HTTP ${response.status}`);
}
