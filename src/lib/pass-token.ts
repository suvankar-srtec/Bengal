import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type PassTokenPayload = {
  registrationId: string;
  eventId: number;
  participantNumber: number;
  reference: string;
};

function secret() {
  return process.env.QR_PASS_SECRET || process.env.ADMIN_SESSION_SECRET || "bengal-pass-verification-2026";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createPassToken(data: PassTokenPayload) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    registrationId: data.registrationId,
    eventId: data.eventId,
    participantNumber: data.participantNumber,
    reference: data.reference,
  }), "utf8").toString("base64url");

  return `${payload}.${signature(payload)}`;
}

export function readPassToken(token: string): PassTokenPayload | null {
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;

  const payload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  if (!safeEqual(suppliedSignature, signature(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;

    if (
      parsed.v !== 1 ||
      typeof parsed.registrationId !== "string" ||
      typeof parsed.reference !== "string" ||
      typeof parsed.eventId !== "number" ||
      !Number.isInteger(parsed.eventId) ||
      parsed.eventId < 1 ||
      typeof parsed.participantNumber !== "number" ||
      !Number.isInteger(parsed.participantNumber) ||
      parsed.participantNumber < 1
    ) {
      return null;
    }

    return {
      registrationId: parsed.registrationId,
      eventId: parsed.eventId,
      participantNumber: parsed.participantNumber,
      reference: parsed.reference,
    };
  } catch {
    return null;
  }
}

export function passVerificationUrl(data: PassTokenPayload) {
  const origin = (process.env.APP_PUBLIC_URL || "https://bengal-bbc.vercel.app").replace(/\/+$/, "");
  const token = createPassToken(data);
  return `${origin}/verify-pass?token=${encodeURIComponent(token)}`;
}

export function tokenFromScannedValue(raw: string) {
  const value = raw.trim();

  try {
    const url = new URL(value);
    const token = url.searchParams.get("token");
    if (token) return token;
  } catch {
    // A scanner may return the signed token directly.
  }

  return value;
}
