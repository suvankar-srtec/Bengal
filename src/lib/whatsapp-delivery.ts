import "server-only";
import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getDatabase } from "./db";
import { participantPass, type PassRegistration } from "./participant-pass";
import { whatsappConfiguration, WhatsAppError } from "./wapmonkey";
import { sendWhatsAppText } from "./wapmonkey-text";

export type DeliveryStatus = "pending" | "sending" | "accepted" | "failed" | "unknown";
type DeliveryRow = {
  registration_id: string; media_token: string; status: DeliveryStatus;
  attempts: number; error_code: string | null; next_attempt_at: Date;
};

export async function queueWhatsAppPasses(database: Pool | PoolClient, registrationId: string) {
  await database.query(`INSERT INTO public.bbc_whatsapp_pass_deliveries (registration_id, media_token)
    SELECT id, $2 FROM public.bbc_event_registrations WHERE id = $1 AND payment_status = 'paid'
    ON CONFLICT (registration_id) DO NOTHING`, [registrationId, randomBytes(32).toString("hex")]);
}

export function passImagePath(token: string, participantNumber: number) {
  return `/api/passes/${token}/${participantNumber}.png`;
}

export function passBundlePath(token: string) {
  return `/passes/${token}`;
}

export async function loadPassRegistration(registrationId: string) {
  return (await getDatabase().query<PassRegistration & { phone: string }>(`
    SELECT id, reference, event_id, event_name, event_date::text,
      participant_names, email, billing_details,
      participation_quantity, standee_quantity, meal_choice, presentation_selected,
      participation_unit_paise, standee_unit_paise, presentation_unit_paise, meal_unit_paise,
      phone
    FROM public.bbc_event_registrations WHERE id = $1 AND payment_status = 'paid'`, [registrationId])).rows[0];
}

export async function deliveryDetails(registrationId: string) {
  return (await getDatabase().query<DeliveryRow>(`SELECT registration_id, media_token, status, attempts, error_code, next_attempt_at
    FROM public.bbc_whatsapp_pass_deliveries WHERE registration_id = $1`, [registrationId])).rows[0];
}

export async function deliverWhatsAppPasses(registrationId: string) {
  const database = getDatabase();
  // An interrupted send might already be accepted. Never blindly resend it.
  await database.query(`UPDATE public.bbc_whatsapp_pass_deliveries
    SET status = 'unknown', error_code = 'provider_response_unknown', updated_at = NOW()
    WHERE registration_id = $1 AND status = 'sending' AND updated_at < NOW() - INTERVAL '2 minutes'`, [registrationId]);
  const row = (await database.query<DeliveryRow>(`
    UPDATE public.bbc_whatsapp_pass_deliveries d SET status = 'sending', updated_at = NOW(), attempts = attempts + 1
    WHERE registration_id = $1 AND status IN ('pending', 'failed') AND attempts < 3
      AND next_attempt_at <= NOW() AND media_expires_at > NOW()
      AND EXISTS (SELECT 1 FROM public.bbc_event_registrations r WHERE r.id = d.registration_id AND r.payment_status = 'paid')
    RETURNING registration_id, media_token, status, attempts, error_code`, [registrationId])).rows[0];
  if (!row) return;
  let submitted = false;
  try {
    const config = whatsappConfiguration();
    const registration = await loadPassRegistration(registrationId);
    if (!registration) throw new WhatsAppError("registration_not_paid");
    if (!registration.participant_names.length) throw new WhatsAppError("passes_missing");

    const passUrl = `${config.origin}${passBundlePath(row.media_token)}?v=2`;
    const primaryMember = registration.participant_names[0] ?? "Member";
    const participantCount = registration.participant_names.length;

    submitted = true;
    const messageId = await sendWhatsAppText({
      phone: registration.phone,
      message: [
        `Hello ${primaryMember},`,
        "",
        `Your payment for ${registration.event_name} has been received successfully.`,
        `Your ${participantCount} QR ${participantCount === 1 ? "pass is" : "passes are"} ready.`,
        "",
        "View or download your passes here:",
        passUrl,
        "",
        "Please keep the QR pass ready at the venue entrance.",
        "Bengal Business Council",
      ].join("\n"),
    }, config);
    await database.query(`UPDATE public.bbc_whatsapp_pass_deliveries
      SET status = 'accepted', provider_message_id = $2, error_code = NULL, accepted_at = NOW(), updated_at = NOW()
      WHERE registration_id = $1 AND status = 'sending'`, [registrationId, messageId]);
  } catch (error) {
    const uncertain = error instanceof WhatsAppError ? error.uncertain : submitted;
    const code = error instanceof WhatsAppError ? error.code : "delivery_failed";
    await database.query(`UPDATE public.bbc_whatsapp_pass_deliveries
      SET status = $2, error_code = $3, next_attempt_at = NOW() + INTERVAL '1 minute', updated_at = NOW()
      WHERE registration_id = $1 AND status = 'sending'`, [registrationId, uncertain ? "unknown" : "failed", code]);
    console.error("WhatsApp pass delivery:", code);
  }
}

export async function deliverWhatsAppPassesSafely(registrationId: string) {
  try { await deliverWhatsAppPasses(registrationId); }
  catch { console.error("WhatsApp delivery could not update its status."); }
}
