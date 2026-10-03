import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "./admin-auth";
import { getDatabase } from "./db";
import { RequestError } from "./request-security";
import { queueParticipantPhotoRequests } from "./participant-photo";

export const paymentAccessSchema = z.object({ registrationId: z.uuid(), submissionId: z.uuid() });
export async function requirePaymentAdmin() {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) throw new RequestError("Sign in to review payments.", 401);
  if (session.role !== "admin") throw new RequestError("Only an admin can review payments.", 403);
}
export async function validateReceipt(file: File) {
  if (!file.size || file.size > 3 * 1024 * 1024) throw new RequestError("Upload a JPG, PNG or PDF receipt up to 3 MB.");
  const original = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(original).digest("hex");
  if (original.subarray(0,5).toString() === "%PDF-") {
    if (!original.subarray(-1024).includes(Buffer.from("%%EOF"))) throw new RequestError("This PDF appears incomplete.");
    return { data: original, mime: "application/pdf", name: "bank-receipt.pdf", hash };
  }
  try {
    const source = sharp(original, { limitInputPixels: 16000000, failOn: "warning" });
    const metadata = await source.metadata();
    if (!["jpeg","png"].includes(metadata.format || "") || (metadata.pages || 1)>1) throw new Error("unsupported");
    const data = await source.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    return { data, mime: "image/jpeg", name: "bank-receipt.jpg", hash };
  } catch { throw new RequestError("The receipt must be a readable JPG, PNG or PDF file."); }
}
export async function submitPayment(input: { registrationId: string; submissionId: string; requestId: string; method: "cash" | "bank"; transactionId: string }, receipt: Awaited<ReturnType<typeof validateReceipt>> | null) {
  if (input.method === "bank" && !receipt) throw new RequestError("Upload your bank transfer receipt.");
  if (input.method === "cash" && receipt) throw new RequestError("Cash payments do not need a bank receipt.");
  const confirmationSuffix = input.transactionId.replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase();
  if (confirmationSuffix.length !== 4) throw new RequestError("Enter a valid transaction ID.");
  const db = await getDatabase().connect();
  try {
    await db.query("BEGIN");
    const registration = (await db.query(`SELECT id,total_paise,payment_status FROM public.bbc_event_registrations
      WHERE id=$1 AND submission_id=$2 AND admin_import_key IS NULL FOR UPDATE`, [input.registrationId,input.submissionId])).rows[0];
    if (!registration) throw new RequestError("Registration not found.",404);
    const existing = (await db.query(`SELECT id,status,method,receipt_hash,note,confirmation_suffix FROM public.bbc_registration_payment_reviews
      WHERE registration_id=$1 AND (id=$2 OR status IN ('pending','approved')) ORDER BY created_at DESC LIMIT 1`,[input.registrationId,input.requestId])).rows[0];
    if (existing) {
      if (existing.id !== input.requestId || existing.method !== input.method || existing.receipt_hash !== (receipt?.hash || null) || existing.confirmation_suffix !== confirmationSuffix) throw new RequestError("A payment request already exists. Refresh its status before submitting again.",409);
      await db.query("COMMIT");
      return existing;
    }
    if (registration.payment_status === "paid") throw new RequestError("This registration is already paid.",409);
    const count = (await db.query("SELECT COUNT(*)::int AS count FROM public.bbc_registration_payment_reviews WHERE registration_id=$1",[input.registrationId])).rows[0].count;
    if (count>=5) throw new RequestError("Please contact the organizer to review further payment changes.",429);
    const review = (await db.query(`INSERT INTO public.bbc_registration_payment_reviews(id,registration_id,method,amount_paise,receipt_data,receipt_mime,receipt_name,receipt_hash,confirmation_suffix)\n      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,status,method,note`, [input.requestId,input.registrationId,input.method,registration.total_paise,receipt?.data || null,receipt?.mime || null,receipt?.name || null,receipt?.hash || null,confirmationSuffix])).rows[0];
    await db.query("COMMIT");
    return review;
  } catch(error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
}
export async function reviewPayment(id: string, decision: "approved" | "rejected", note: string, confirmationSuffix = "") {
  const db = await getDatabase().connect();
  try {
    await db.query("BEGIN");
    const found = (await db.query("SELECT registration_id FROM public.bbc_registration_payment_reviews WHERE id=$1",[id])).rows[0];
    if (!found) throw new RequestError("Payment request not found.",404);
    await db.query("SELECT id FROM public.bbc_event_registrations WHERE id=$1 FOR UPDATE",[found.registration_id]);
    const review = (await db.query("SELECT * FROM public.bbc_registration_payment_reviews WHERE id=$1 FOR UPDATE",[id])).rows[0];
    if (review.status !== "pending" && review.status !== decision) throw new RequestError("This request has already been reviewed.",409);
    if (decision === "approved" && review.status === "pending") {
      if (!review.confirmation_suffix) throw new RequestError("This older payment request has no transaction confirmation code. Reject it and ask the participant to submit the payment request again.",409);
      if (confirmationSuffix.toUpperCase() !== review.confirmation_suffix) throw new RequestError("The last 4 characters of the transaction ID do not match.",400);
    }
    if (review.status === "pending") {
      await db.query("UPDATE public.bbc_registration_payment_reviews SET status=$2,note=$3,reviewed_at=NOW(),read_at=COALESCE(read_at,NOW()) WHERE id=$1",[id,decision,note]);
      if (decision === "approved") {
        await db.query(`UPDATE public.bbc_event_registrations SET payment_status='paid',amount_paid_paise=total_paise,payment_approved_at=NOW() WHERE id=$1`,[found.registration_id]);
        await queueParticipantPhotoRequests(db, found.registration_id);
      }
    }
    await db.query("COMMIT");
    return { registrationId: found.registration_id as string, status: decision };
  } catch(error) { await db.query("ROLLBACK"); throw error; } finally { db.release(); }
}
