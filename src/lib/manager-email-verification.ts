import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { getDatabase } from "./db";
import { RequestError } from "./request-security";
import { newVerificationCode, verificationHash, verificationCodeMatches } from "./verification-security";
import { verificationSecret, verificationSession, type ManagerSession } from "./manager-phone-verification";
import { emailConfiguration, EmailError, sendEmail } from "./email";

export function normalizeEmail(value: string) {
  const parsed = z.email().max(254).safeParse(value.trim().toLowerCase());
  if (!parsed.success) throw new RequestError("Enter a valid email address.");
  return parsed.data;
}
export async function requestEmailChangeCode(input:{registrationId:string;email:string}, request:Request, manager:ManagerSession) {
  const newEmail = normalizeEmail(input.email);
  const registration = (await getDatabase().query("SELECT event_id,email FROM public.bbc_event_registrations WHERE id=$1", [input.registrationId])).rows[0];
  if (!registration) throw new RequestError("Registration not found.",404);
  if (registration.event_id !== String(manager.eventId)) throw new RequestError("You can edit emails only for your assigned event.",403);
  const currentEmail = normalizeEmail(String(registration.email || ""));
  if (currentEmail === newEmail) throw new RequestError("Enter the new email address first.");
  try { emailConfiguration(); } catch { throw new RequestError("Email verification is not configured. Please contact the admin.",503); }
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
      SELECT COUNT(*) FILTER (WHERE channel='email' AND COALESCE(previous_destination,destination)=$1 AND created_at>NOW()-INTERVAL '60 seconds') AS recent,
        COUNT(*) FILTER (WHERE channel='email' AND COALESCE(previous_destination,destination)=$1) AS destination_count,
        COUNT(*) FILTER (WHERE actor_id=$2) AS actor_count,
        COUNT(*) FILTER (WHERE ip_hash=$3) AS ip_count
      FROM public.bbc_contact_verifications WHERE created_at>NOW()-INTERVAL '1 hour'`,[currentEmail,manager.managerId,ipHash])).rows[0];
    if (Number(counts.recent)>0) throw new RequestError("Please wait 60 seconds before requesting another code.",429);
    if (Number(counts.destination_count)>=5 || Number(counts.actor_count)>=20 || (ip!=="unavailable"&&Number(counts.ip_count)>=60)) throw new RequestError("Too many code requests. Please try again in an hour.",429);
    await db.query(`INSERT INTO public.bbc_contact_verifications(id,session_hash,ip_hash,channel,destination,code_hash,registration_id,actor_id,previous_destination)
      VALUES($1,$2,$3,'email',$4,$5,$6,$7,$8)`,[id,sessionHash,ipHash,newEmail,verificationHash(secret,`${id}:${code}`),input.registrationId,manager.managerId,currentEmail]);
    await db.query("COMMIT");
  } catch(error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
  try {
    await sendEmail({to:currentEmail,subject:"Authorize your Bengal Business Council email change",
      text:`Your Bengal Business Council verification code is ${code}. Use it to authorize changing the registered email address to ${newEmail}. Share it only with the event manager handling your registration. It expires in 10 minutes. If you did not request this change, do not share the code.`,
      idempotencyKey:`manager-email-change-${id}`});
    await getDatabase().query("UPDATE public.bbc_contact_verifications SET status='sent' WHERE id=$1",[id]);
  } catch(error) {
    const uncertain = error instanceof EmailError ? error.uncertain : true;
    await getDatabase().query("UPDATE public.bbc_contact_verifications SET status=$2 WHERE id=$1",[id,uncertain?"unknown":"failed"]);
    if (!uncertain) throw new RequestError("The code could not be sent to the current email address. Please wait a minute and try again.",502);
    return {challengeId:id,message:"Delivery could not be confirmed. If the code arrives on the current email address, enter it below. Otherwise resend after 60 seconds."};
  }
  return {challengeId:id,message:`A six-digit code was sent to the current email address on this registration. Enter it to authorize the change.`};
}
export async function verifyEmailChange(db:PoolClient, input:{registrationId:string;email:string;challengeId?:string;code?:string}, previousEmail:string, manager:ManagerSession) {
  if (!input.challengeId || !input.code) throw new RequestError("Authorize the email change using the code sent to the current email address.",403);
  const sessionHash = await verificationSession();
  const row = (await db.query(`SELECT *,expires_at>NOW() AS valid FROM public.bbc_contact_verifications
    WHERE id=$1 AND session_hash=$2 AND registration_id=$3 AND actor_id=$4 AND destination=$5 AND channel='email' FOR UPDATE`,
    [input.challengeId,sessionHash,input.registrationId,manager.managerId,input.email])).rows[0];
  if (!row || !row.valid || row.consumed_at || row.previous_destination!==previousEmail || !["sent","unknown"].includes(row.status) || row.attempts>=5) throw new RequestError("This verification code expired or is no longer valid. Request a new code.",403);
  if (!verificationCodeMatches(verificationSecret(),input.challengeId,input.code,row.code_hash)) {
    await db.query("UPDATE public.bbc_contact_verifications SET attempts=attempts+1 WHERE id=$1",[input.challengeId]);
    // Persist the failed attempt, without any email updates. Caller rolls back a completed transaction safely.
    await db.query("COMMIT");
    throw new RequestError("Incorrect verification code. Please try again.");
  }
  await db.query("UPDATE public.bbc_contact_verifications SET verified_at=NOW(),consumed_at=NOW() WHERE id=$1",[input.challengeId]);
}
