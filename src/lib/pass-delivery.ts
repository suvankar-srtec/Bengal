import "server-only";
import type { Pool, PoolClient } from "pg";
import { getDatabase } from "./db";
import { EmailError, sendEmail } from "./email";
import { deliveryDetails, deliverWhatsAppPassesSafely, loadPassRegistration, passBundlePath, queueWhatsAppPasses } from "./whatsapp-delivery";
import { whatsappPassMessage } from "./whatsapp-pass-message";

export async function queueRegistrationPasses(db: Pool | PoolClient, id: string) {
  await queueWhatsAppPasses(db, id);
  await db.query(`INSERT INTO public.bbc_email_pass_deliveries(registration_id)
    SELECT id FROM public.bbc_event_registrations WHERE id=$1 AND payment_status='paid'
    ON CONFLICT DO NOTHING`, [id]);
}
export async function passDeliveryStatuses(id: string) {
  return (await getDatabase().query(`SELECT w.status AS whatsapp, e.status AS email, w.error_code AS whatsapp_error, e.error_code AS email_error
    FROM public.bbc_event_registrations r LEFT JOIN public.bbc_whatsapp_pass_deliveries w ON w.registration_id=r.id
    LEFT JOIN public.bbc_email_pass_deliveries e ON e.registration_id=r.id WHERE r.id=$1`, [id])).rows[0];
}
export async function deliverEmailPasses(id: string) {
  const db = getDatabase();
  await db.query(`UPDATE public.bbc_email_pass_deliveries SET status='unknown', error_code='email_response_unknown', updated_at=NOW()
    WHERE registration_id=$1 AND status='sending' AND updated_at<NOW()-INTERVAL '2 minutes'`, [id]);
  const claimed = await db.query(`UPDATE public.bbc_email_pass_deliveries d SET status='sending',attempts=attempts+1,updated_at=NOW()
    WHERE registration_id=$1 AND status IN ('pending','failed') AND attempts<3 AND next_attempt_at<=NOW()
    AND EXISTS(SELECT 1 FROM public.bbc_event_registrations r JOIN public.bbc_whatsapp_pass_deliveries w ON w.registration_id=r.id
      WHERE r.id=d.registration_id AND r.payment_status='paid' AND w.media_expires_at>NOW()) RETURNING registration_id`, [id]);
  if (!claimed.rowCount) return;
  let submitted = false;
  try {
    const registration = await loadPassRegistration(id);
    const delivery = await deliveryDetails(id);
    if (!registration || !delivery) throw new EmailError("passes_unavailable");
    let origin: URL;
    try { origin = new URL(process.env.APP_PUBLIC_URL || ""); } catch { throw new EmailError("public_url_missing"); }
    if (origin.protocol !== "https:" || origin.username || origin.password) throw new EmailError("public_url_invalid");
    const text = whatsappPassMessage({ memberName: registration.participant_names[0] || "Member", eventName: registration.event_name,
      participantCount: registration.participant_names.length, passUrl: `${origin.origin}${passBundlePath(delivery.media_token)}`,
      venue: registration.venue, googleMapsUrl: registration.google_maps_url, eventDate: registration.event_date,
      eventTime: registration.event_time, eventEndTime: registration.event_end_time }).replaceAll("*", "");
    submitted = true;
    const messageId = await sendEmail({ to: registration.email, subject: "Your Event Pass | Bengal Business Council", text, idempotencyKey: `pass-${id}` });
    await db.query(`UPDATE public.bbc_email_pass_deliveries SET status='accepted',provider_message_id=$2,error_code=NULL,accepted_at=NOW(),updated_at=NOW()
      WHERE registration_id=$1 AND status='sending'`, [id, messageId]);
  } catch (error) {
    const uncertain = error instanceof EmailError ? error.uncertain : submitted;
    const code = error instanceof EmailError ? error.code : "email_delivery_failed";
    await db.query(`UPDATE public.bbc_email_pass_deliveries SET status=$2,error_code=$3,next_attempt_at=NOW()+INTERVAL '1 minute',updated_at=NOW()
      WHERE registration_id=$1 AND status='sending'`, [id, uncertain ? "unknown" : "failed", code]);
  }
}
export async function deliverRegistrationPasses(id: string) {
  // A failure in one channel must not stop the other channel.
  const results = await Promise.allSettled([deliverWhatsAppPassesSafely(id), deliverEmailPasses(id)]);
  if (results.some((result) => result.status === "rejected")) console.error("A pass delivery status could not be updated.");
}
