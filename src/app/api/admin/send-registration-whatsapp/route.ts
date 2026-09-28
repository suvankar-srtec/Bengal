import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { queueWhatsAppPasses } from "@/lib/whatsapp-delivery";
import { whatsappConfiguration, WhatsAppError } from "@/lib/wapmonkey";
import { sendWhatsAppText } from "@/lib/wapmonkey-text";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({ registrationId: z.uuid() });

type RegistrationRow = {
  id: string;
  event_name: string;
  phone: string;
  participant_names: string[];
  media_token: string;
  status: string;
};

export async function POST(request: Request) {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Sign in as an administrator." }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Only administrators can send registration passes." }, { status: 403 });

  let registrationId: string;
  try {
    registrationId = requestSchema.parse(await request.json()).registrationId;
  } catch {
    return Response.json({ error: "Invalid registration." }, { status: 400 });
  }

  const database = getDatabase();
  await queueWhatsAppPasses(database, registrationId);

  const sql = "SELECT r.id, r.event_name, r.phone, r.participant_names, d.media_token, d.status " +
    "FROM public.bbc_event_registrations r " +
    "JOIN public.bbc_whatsapp_pass_deliveries d ON d.registration_id = r.id " +
    "WHERE r.id = $1 AND r.payment_status = 'paid' LIMIT 1";
  const registration = (await database.query<RegistrationRow>(sql, [registrationId])).rows[0];
  if (!registration) return Response.json({ error: "Paid registration or QR passes were not found." }, { status: 404 });
  if (registration.status === "accepted") return Response.json({ ok: true, status: "accepted", alreadySent: true });

  const claimed = await database.query(
    "UPDATE public.bbc_whatsapp_pass_deliveries SET status = 'sending', attempts = attempts + 1, error_code = NULL, updated_at = NOW() " +
    "WHERE registration_id = $1 AND status <> 'accepted'",
    [registrationId],
  );
  if (!claimed.rowCount) return Response.json({ ok: true, status: "accepted", alreadySent: true });

  const config = whatsappConfiguration();
  const participantCount = registration.participant_names.length;
  const primaryMember = registration.participant_names[0] ?? "Member";
  const passUrl = config.origin + "/passes/" + registration.media_token + "?v=2";

  try {
    const messageId = await sendWhatsAppText({
      phone: registration.phone,
      message: [
        "Hello " + primaryMember + ",",
        "",
        "Your registration for " + registration.event_name + " is confirmed.",
        "Your " + participantCount + " QR " + (participantCount === 1 ? "pass is" : "passes are") + " ready.",
        "",
        "View or download your passes here:",
        passUrl,
        "",
        "Please keep the QR pass ready at the venue entrance.",
        "Bengal Business Council",
      ].join("\n"),
    }, config);

    await database.query(
      "UPDATE public.bbc_whatsapp_pass_deliveries SET status = 'accepted', provider_message_id = $2, error_code = NULL, accepted_at = NOW(), updated_at = NOW() WHERE registration_id = $1",
      [registrationId, messageId],
    );
    return Response.json({ ok: true, status: "accepted" });
  } catch (error) {
    const uncertain = error instanceof WhatsAppError ? error.uncertain : true;
    const code = error instanceof WhatsAppError ? error.code : "delivery_failed";
    await database.query(
      "UPDATE public.bbc_whatsapp_pass_deliveries SET status = $2, error_code = $3, next_attempt_at = NOW() + INTERVAL '1 minute', updated_at = NOW() WHERE registration_id = $1",
      [registrationId, uncertain ? "unknown" : "failed", code],
    );
    console.error("Admin WhatsApp send failed.", { code });
    return Response.json({
      error: uncertain
        ? "WhatsApp provider response could not be confirmed. Check the provider message report before retrying."
        : "WhatsApp could not send the passes. Please retry.",
    }, { status: 502 });
  }
}