import "server-only";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Pool, PoolClient } from "pg";
import { getDatabase } from "./db";
import { EmailError, sendEmail } from "./email";
import { RequestError } from "./request-security";
import { sendWhatsAppText } from "./wapmonkey-text";
import { WhatsAppError } from "./wapmonkey";

type ParticipantContact = { email?: string; phone?: string };

type PhotoRow = {
  id: string;
  registration_id: string;
  participant_number: number;
  token_nonce: string;
  token_hash: string;
  photo_data?: Buffer | null;
  photo_mime?: string | null;
  photo_uploaded_at?: Date | null;
  expires_at: Date;
  email_status: string;
  whatsapp_status: string;
  email_error: string | null;
  whatsapp_error: string | null;
};

type RegistrationPhotoContext = {
  id: string;
  event_name: string;
  event_date: string;
  participant_names: string[];
  additional_participant_contacts: ParticipantContact[];
  email: string;
  phone: string;
  payment_status: string;
};

function secret() {
  const value = process.env.PARTICIPANT_PHOTO_SECRET || process.env.QR_PASS_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("PARTICIPANT_PHOTO_SECRET is not configured.");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function rawToken(id: string, nonce: string) {
  const payload = Buffer.from(JSON.stringify({ v: 1, id, nonce }), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicOrigin() {
  const value = process.env.APP_PUBLIC_URL?.trim();
  let url: URL;
  try { url = new URL(value || ""); } catch { throw new Error("APP_PUBLIC_URL is not configured."); }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("APP_PUBLIC_URL must be a public HTTPS origin.");
  return url.origin;
}

export function participantPhotoLink(row: Pick<PhotoRow, "id" | "token_nonce">) {
  return `${publicOrigin()}/participant-photo/${encodeURIComponent(rawToken(row.id, row.token_nonce))}`;
}

export async function queueParticipantPhotoRequests(database: Pool | PoolClient, registrationId: string) {
  const registration = (await database.query<RegistrationPhotoContext>(`
    SELECT id,event_name,event_date::text,participant_names,additional_participant_contacts,email,phone,payment_status
    FROM public.bbc_event_registrations WHERE id=$1 FOR UPDATE`, [registrationId])).rows[0];
  if (!registration || registration.payment_status !== "paid") throw new RequestError("Paid registration not found.", 404);

  for (let index = 0; index < registration.participant_names.length; index += 1) {
    const id = randomUUID();
    const nonce = randomBytes(32).toString("hex");
    const token = rawToken(id, nonce);
    await database.query(`
      INSERT INTO public.bbc_participant_photos(
        id,registration_id,participant_number,token_nonce,token_hash,expires_at
      ) VALUES(
        $1,$2,$3,$4,$5,
        GREATEST(($6::date + INTERVAL '2 days')::timestamptz, NOW() + INTERVAL '7 days')
      )
      ON CONFLICT (registration_id,participant_number) DO NOTHING`,
      [id, registrationId, index + 1, nonce, tokenHash(token), registration.event_date]);
  }
}

function contactFor(registration: RegistrationPhotoContext, participantNumber: number) {
  if (participantNumber === 1) return { email: registration.email, phone: registration.phone };
  const extra = registration.additional_participant_contacts?.[participantNumber - 2] || {};
  return {
    email: extra.email || registration.email,
    phone: extra.phone || registration.phone,
  };
}

function messageText(name: string, eventName: string, link: string) {
  return [
    `Hello *${name}*,`,
    "",
    `Your payment for *${eventName}* has been confirmed.`,
    "",
    "Please add your photograph to complete your event pass.",
    "",
    "*Add your photo*",
    link,
    "",
    "You can take a photo using your phone camera or upload an existing photo.",
    "",
    "Bengal Business Council",
  ].join("\n");
}

export async function deliverParticipantPhotoRequests(registrationId: string) {
  const db = getDatabase();
  const registration = (await db.query<RegistrationPhotoContext>(`
    SELECT id,event_name,event_date::text,participant_names,additional_participant_contacts,email,phone,payment_status
    FROM public.bbc_event_registrations WHERE id=$1`, [registrationId])).rows[0];
  if (!registration || registration.payment_status !== "paid") return;

  const rows = (await db.query<PhotoRow>(`
    SELECT id,registration_id,participant_number,token_nonce,token_hash,expires_at,
      email_status,whatsapp_status,email_error,whatsapp_error
    FROM public.bbc_participant_photos
    WHERE registration_id=$1 AND expires_at>NOW()
    ORDER BY participant_number`, [registrationId])).rows;

  for (const row of rows) {
    const name = registration.participant_names[row.participant_number - 1];
    if (!name) continue;
    const contact = contactFor(registration, row.participant_number);
    const link = participantPhotoLink(row);
    const whatsappMessage = messageText(name, registration.event_name, link);
    const emailText = whatsappMessage.replaceAll("*", "");

    if (!["accepted", "unknown"].includes(row.email_status)) {
      await db.query(`UPDATE public.bbc_participant_photos SET email_status='sending',email_error=NULL,updated_at=NOW()
        WHERE id=$1 AND email_status NOT IN ('accepted','unknown')`, [row.id]);
      try {
        const messageId = await sendEmail({
          to: contact.email,
          subject: "Complete Your Event Pass | Bengal Business Council",
          text: emailText,
          idempotencyKey: `participant-photo-${row.id}`,
        });
        await db.query(`UPDATE public.bbc_participant_photos SET email_status='accepted',email_message_id=$2,email_error=NULL,updated_at=NOW()
          WHERE id=$1`, [row.id, messageId]);
      } catch (error) {
        const uncertain = error instanceof EmailError ? error.uncertain : true;
        const code = error instanceof EmailError ? error.code : "email_delivery_failed";
        await db.query(`UPDATE public.bbc_participant_photos SET email_status=$2,email_error=$3,updated_at=NOW() WHERE id=$1`,
          [row.id, uncertain ? "unknown" : "failed", code]);
      }
    }

    if (!["accepted", "unknown"].includes(row.whatsapp_status)) {
      await db.query(`UPDATE public.bbc_participant_photos SET whatsapp_status='sending',whatsapp_error=NULL,updated_at=NOW()
        WHERE id=$1 AND whatsapp_status NOT IN ('accepted','unknown')`, [row.id]);
      try {
        const messageId = await sendWhatsAppText({ phone: contact.phone, message: whatsappMessage });
        await db.query(`UPDATE public.bbc_participant_photos SET whatsapp_status='accepted',whatsapp_message_id=$2,whatsapp_error=NULL,updated_at=NOW()
          WHERE id=$1`, [row.id, messageId]);
      } catch (error) {
        const uncertain = error instanceof WhatsAppError ? error.uncertain : true;
        const code = error instanceof WhatsAppError ? error.code : "whatsapp_delivery_failed";
        await db.query(`UPDATE public.bbc_participant_photos SET whatsapp_status=$2,whatsapp_error=$3,updated_at=NOW() WHERE id=$1`,
          [row.id, uncertain ? "unknown" : "failed", code]);
      }
    }
  }
}

export async function deliverParticipantPhotoRequestsSafely(registrationId: string) {
  try { await deliverParticipantPhotoRequests(registrationId); }
  catch (error) { console.error("Participant photo-link delivery failed.", error instanceof Error ? error.message : "delivery_failed"); }
}

export async function participantPhotoRequest(token: string, includePhoto = false) {
  if (!token || token.length > 512) return null;
  const hash = tokenHash(token);
  const photoColumn = includePhoto ? ",p.photo_data,p.photo_mime" : "";
  const row = (await getDatabase().query<PhotoRow & {
    participant_name: string;
    event_name: string;
    event_date: string;
    payment_status: string;
  }>(`
    SELECT p.id,p.registration_id,p.participant_number,p.token_nonce,p.token_hash,p.photo_uploaded_at,p.expires_at,
      p.email_status,p.whatsapp_status,p.email_error,p.whatsapp_error
      ${photoColumn},
      r.participant_names[p.participant_number] AS participant_name,
      r.event_name,r.event_date::text,r.payment_status
    FROM public.bbc_participant_photos p
    JOIN public.bbc_event_registrations r ON r.id=p.registration_id
    WHERE p.token_hash=$1 AND p.expires_at>NOW() AND r.payment_status='paid'`, [hash])).rows[0];
  return row || null;
}

export async function validateAndProcessParticipantPhoto(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new RequestError("Choose a JPG, PNG or WebP photo up to 5 MB.");
  const original = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(original, { limitInputPixels: 20000000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages || 1) > 1) throw new Error("unsupported");
    const data = await image.rotate().resize(480, 480, { fit: "cover", position: "attention", withoutEnlargement: false })
      .jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return { data, mime: "image/jpeg" };
  } catch {
    throw new RequestError("The photo must be a readable JPG, PNG or WebP image.");
  }
}

export async function saveParticipantPhoto(token: string, file: File) {
  const request = await participantPhotoRequest(token);
  if (!request) throw new RequestError("This photo link is invalid or has expired.", 404);
  const processed = await validateAndProcessParticipantPhoto(file);
  await getDatabase().query(`
    UPDATE public.bbc_participant_photos
    SET photo_data=$2,photo_mime=$3,photo_uploaded_at=NOW(),updated_at=NOW()
    WHERE id=$1`, [request.id, processed.data, processed.mime]);
  return { registrationId: request.registration_id, participantNumber: request.participant_number };
}

export async function participantPhoto(registrationId: string, participantNumber: number) {
  return (await getDatabase().query<{ photo_data: Buffer; photo_mime: string }>(`
    SELECT photo_data,photo_mime FROM public.bbc_participant_photos
    WHERE registration_id=$1 AND participant_number=$2 AND photo_data IS NOT NULL`,
    [registrationId, participantNumber])).rows[0] || null;
}

export async function participantPhotoProgress(registrationId: string) {
  return (await getDatabase().query<{ total: number; uploaded: number; email_sent: number; whatsapp_sent: number }>(`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE photo_data IS NOT NULL)::int AS uploaded,
      COUNT(*) FILTER (WHERE email_status='accepted')::int AS email_sent,
      COUNT(*) FILTER (WHERE whatsapp_status='accepted')::int AS whatsapp_sent
    FROM public.bbc_participant_photos WHERE registration_id=$1`, [registrationId])).rows[0];
}

export async function allParticipantPhotosUploaded(registrationId: string) {
  const result = await getDatabase().query<{ ready: boolean }>(`
    SELECT (
      COALESCE(array_length(r.participant_names,1),0) > 0
      AND COALESCE(array_length(r.participant_names,1),0) =
        (SELECT COUNT(*) FROM public.bbc_participant_photos p WHERE p.registration_id=r.id AND p.photo_data IS NOT NULL)
    ) AS ready
    FROM public.bbc_event_registrations r WHERE r.id=$1 AND r.payment_status='paid'`, [registrationId]);
  return Boolean(result.rows[0]?.ready);
}
