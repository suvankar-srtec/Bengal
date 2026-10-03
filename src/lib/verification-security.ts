import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
export function verificationHash(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function newVerificationCode() { return String(randomInt(0, 1000000)).padStart(6,"0"); }
export function verificationCodeMatches(secret: string, id: string, code: string, expected: string) {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  return timingSafeEqual(Buffer.from(verificationHash(secret, `${id}:${code}`),"hex"), Buffer.from(expected,"hex"));
}
