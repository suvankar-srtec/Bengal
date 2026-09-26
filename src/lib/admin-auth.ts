import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "bbc_admin_session";

const LEGACY_SESSION_PAYLOAD = "bbc-admin-session-v1";

export type AdminSession =
  | { role: "admin" }
  | { role: "manager"; managerId: string; eventId: number; userId: string };

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

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function adminSessionToken(session: AdminSession = { role: "admin" }) {
  const payload = Buffer.from(JSON.stringify({ v: 2, ...session }), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readAdminSession(token: string | undefined): AdminSession | null {
  if (!token) return null;

  // Keep existing admin sessions valid during the role-based session upgrade.
  const legacy = createHmac("sha256", secret()).update(LEGACY_SESSION_PAYLOAD).digest("hex");
  if (safeEqual(token, legacy)) return { role: "admin" };

  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (parsed.v !== 2) return null;
    if (parsed.role === "admin") return { role: "admin" };
    if (
      parsed.role === "manager" &&
      typeof parsed.managerId === "string" &&
      typeof parsed.userId === "string" &&
      typeof parsed.eventId === "number" &&
      Number.isInteger(parsed.eventId) &&
      parsed.eventId > 0
    ) {
      return {
        role: "manager",
        managerId: parsed.managerId,
        userId: parsed.userId,
        eventId: Number(parsed.eventId),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function validAdminSession(token: string | undefined) {
  return readAdminSession(token) !== null;
}

export function hashManagerPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function validManagerPassword(password: string, stored: string) {
  const [algorithm, salt, expected] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expected || !/^[a-f0-9]{64}$/i.test(expected)) return false;

  try {
    const actual = scryptSync(password, salt, 32).toString("hex");
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}
