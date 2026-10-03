import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import { ADMIN_SESSION_COOKIE, readAdminSession, type AdminSession } from "./admin-auth";
import { getDatabase } from "./db";
import { RequestError } from "./request-security";
import { newVerificationCode, verificationHash, verificationCodeMatches } from "./verification-security";
import { whatsappConfiguration, WhatsAppError } from "./wapmonkey";
import { sendWhatsAppText } from "./wapmonkey-text";

export type ManagerSession = Extract<AdminSession, {role:"manager"}>;
export const VERIFICATION_COOKIE = "bbc_contact_session";
export function verificationSecret() {
  const value = process.env.CONTACT_VERIFICATION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new RequestError("Phone verification is not configured. Please contact the admin.", 503);
  return value;
}
export async function requireManager() {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) throw new RequestError("Sign in to update the WhatsApp number.", 401);
  if (session.role !== "manager") throw new RequestError("Only the assigned manager can update this number here.", 403);
  return session;
}
export function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!/^[+\d\s()-]+$/.test(trimmed)) throw new RequestError("Enter a valid WhatsApp number, for example +919876543210.");
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  throw new RequestError("Enter a valid WhatsApp number, for example +919876543210.");
}
export async function verificationSession(create = false) {
  const jar = await cookies();
  let token = jar.get(VERIFICATION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) throw new RequestError("Request a new verification code.", 403);
    token = randomBytes(32).toString("hex");
    jar.set(VERIFICATION_COOKIE, token, { httpOnly:true, sameSite:"strict", secure:process.env.NODE_ENV === "production", path:"/", maxAge:3600 });
  }
  return verificationHash(verificationSecret(), token);
}
export async function requestPhoneChangeCode(input:{registrationId:string;phone:string}, request:Request, manager:ManagerSession) {
  const destination = normalizePhone(input.phone);
  const registration = (await getDatabase().query("SELECT event_id,phone FROM public.bbc_event_registrations WHERE id=$1", [input.registrationId])).rows[0];
  if (!registration) throw new RequestError("Registration not found.",404);
  if (registration.event_id !== String(manager.eventId)) throw new RequestError("You can edit numbers only for your assigned event.",403);
  if (registration.phone === destination) throw new RequestError("Enter the new WhatsApp number first.");
  try { whatsappConfiguration(); } catch { throw new RequestError("WhatsApp verification is not configured. Please contact the admin.",503); }
  const secret = verificationSecret();
  const sessionHash = await verificationSession(true);
  // A trusted reverse proxy must overwrite these headers. Destination and manager limits apply independently.
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unavailable";
  const ipHash = verificationHash(secret, ip);
  const id = randomUUID();
  const code = newVerificationCode();
  const db = await getDatabase().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(8731264)");
    const counts = (await db.query<{recent:string;destination_count:string;actor_count:string;ip_count:string}>(`
      SELECT COUNT(*) FILTER (WHERE channel='phone' AND destination=$1 AND created_at>NOW()-INTERVAL '60 seconds') AS recent,
        COUNT(*) FILTER (WHERE channel='phone' AND destination=$1) AS destination_count,
        COUNT(*) FILTER (WHERE actor_id=$2) AS actor_count,
        COUNT(*) FILTER (WHERE ip_hash=$3) AS ip_count
      FROM public.bbc_contact_verifications WHERE created_at>NOW()-INTERVAL '1 hour'`,[destination,manager.managerId,ipHash])).rows[0];
    if (Number(counts.recent)>0) throw new RequestError("Please wait 60 seconds before requesting another code.",429);
    if (Number(counts.destination_count)>=5 || Number(counts.actor_count)>=20 || (ip!=="unavailable"&&Number(counts.ip_count)>=60)) throw new RequestError("Too many code requests. Please try again in an hour.",429);
    await db.query(`INSERT INTO public.bbc_contact_verifications(id,session_hash,ip_hash,channel,destination,code_hash,registration_id,actor_id,previous_destination)
      VALUES($1,$2,$3,'phone',$4,$5,$6,$7,$8)`,[id,sessionHash,ipHash,destination,verificationHash(secret,`${id}:${code}`),input.registrationId,manager.managerId,registration.phone]);
    await db.query("COMMIT");
  } catch(error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
  try {
    await sendWhatsAppText({phone:destination,message:`Your Bengal Business Council code to confirm this new WhatsApp number is ${code}. Share it only with the event manager who requested this change. It expires in 10 minutes.`});
    await getDatabase().query("UPDATE public.bbc_contact_verifications SET status='sent' WHERE id=$1",[id]);
  } catch(error) {
    const uncertain = error instanceof WhatsAppError ? error.uncertain : true;
    await getDatabase().query("UPDATE public.bbc_contact_verifications SET status=$2 WHERE id=$1",[id,uncertain?"unknown":"failed"]);
    if (!uncertain) throw new RequestError("The code could not be sent. Please wait a minute and try again.",502);
    return {challengeId:id,message:"Delivery could not be confirmed. If the code arrives on the new number, enter it below. Otherwise resend after 60 seconds."};
  }
  return {challengeId:id,message:"A six-digit code was sent to the new WhatsApp number. Enter it to confirm the change."};
}
export async function verifyPhoneChange(db:PoolClient, input:{registrationId:string;phone:string;challengeId?:string;code?:string}, previousPhone:string, manager:ManagerSession) {
  if (!input.challengeId || !input.code) throw new RequestError("Verify the new WhatsApp number before saving.",403);
  const sessionHash = await verificationSession();
  const row = (await db.query(`SELECT *,expires_at>NOW() AS valid FROM public.bbc_contact_verifications
    WHERE id=$1 AND session_hash=$2 AND registration_id=$3 AND actor_id=$4 AND destination=$5 AND channel='phone' FOR UPDATE`,
    [input.challengeId,sessionHash,input.registrationId,manager.managerId,input.phone])).rows[0];
  if (!row || !row.valid || row.consumed_at || row.previous_destination!==previousPhone || !["sent","unknown"].includes(row.status) || row.attempts>=5) throw new RequestError("This verification code expired or is no longer valid. Request a new code.",403);
  if (!verificationCodeMatches(verificationSecret(),input.challengeId,input.code,row.code_hash)) {
    await db.query("UPDATE public.bbc_contact_verifications SET attempts=attempts+1 WHERE id=$1",[input.challengeId]);
    // Persist the failed attempt, without any phone updates. Caller rolls back a completed transaction safely.
    await db.query("COMMIT");
    throw new RequestError("Incorrect verification code. Please try again.");
  }
  await db.query("UPDATE public.bbc_contact_verifications SET verified_at=NOW(),consumed_at=NOW() WHERE id=$1",[input.challengeId]);
}
