import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "bbc_admin_session";

const SESSION_PAYLOAD = "bbc-admin-session-v1";

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "bengal-admin-session-2026";
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validAdminCredentials(username: string, password: string) {
  const expectedUsername = process.env.ADMIN_USERNAME || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD || "admin";
  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

export function adminSessionToken() {
  return createHmac("sha256", secret()).update(SESSION_PAYLOAD).digest("hex");
}

export function validAdminSession(token: string | undefined) {
  if (!token) return false;
  return safeEqual(token, adminSessionToken());
}
