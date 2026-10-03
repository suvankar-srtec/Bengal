import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";

export class EmailError extends Error {
  constructor(public code: string, public uncertain = false) { super(code); }
}
export function emailConfiguration() {
  const from = process.env.EMAIL_FROM?.trim();
  const provider = process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "smtp");
  if (!from || /[\r\n]/.test(from)) throw new EmailError("email_not_configured");
  if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) throw new EmailError("email_not_configured");
    return { provider, from, apiKey: process.env.RESEND_API_KEY } as const;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  if (provider !== "smtp" || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || ![465,587].includes(port)) throw new EmailError("email_not_configured");
  return { provider: "smtp", from, host: process.env.SMTP_HOST, port, user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD } as const;
}
export async function sendEmail(input: { to: string; subject: string; text: string; html?: string; idempotencyKey: string }, request: typeof fetch = fetch) {
  if (!z.email().safeParse(input.to).success || /[\r\n]/.test(input.subject)) throw new EmailError("invalid_email");
  const config = emailConfiguration();
  if (config.provider === "resend") {
    let response: Response;
    try { response = await request("https://api.resend.com/emails", {
      method: "POST", redirect: "error", headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({ from: config.from, to: [input.to], subject: input.subject, text: input.text, ...(input.html ? { html: input.html } : {}) }), signal: AbortSignal.timeout(20000),
    }); } catch { throw new EmailError("email_response_unknown", true); }
    if (!response.ok) throw new EmailError(`email_http_${response.status}`, response.status >= 500);
    const result = await response.json().catch(() => null);
    if (typeof result?.id !== "string") throw new EmailError("email_response_unknown", true);
    return result.id as string;
  }
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465,
    requireTLS: true, auth: { user: config.user, pass: config.password }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({ from: config.from, to: input.to, subject: input.subject, text: input.text, html: input.html });
    if (!result.accepted.length) throw new EmailError("email_rejected");
    return result.messageId;
  } catch (error) {
    if (error instanceof EmailError) throw error;
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    throw new EmailError("email_send_failed", !["EAUTH","EENVELOPE","ECONNECTION","EDNS"].includes(code));
  } finally { transport.close(); }
}
