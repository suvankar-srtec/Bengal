import { getDatabase } from "@/lib/db";
import { renderParticipantPass } from "@/lib/participant-pass";
import { loadPassRegistration } from "@/lib/whatsapp-delivery";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string; image: string }> }) {
  const { token, image } = await context.params;
  const participant = /^([1-9]|1\d|20)\.png$/.exec(image);
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
  if (!/^[a-f0-9]{64}$/.test(token) || !participant) return new Response(null, { status: 404, headers });
  try {
    const delivery = (await getDatabase().query<{ registration_id: string }>(`
      SELECT registration_id FROM public.bbc_whatsapp_pass_deliveries
      WHERE media_token = $1 AND media_expires_at > NOW()`, [token])).rows[0];
    const registration = delivery && await loadPassRegistration(delivery.registration_id);
    const index = Number(participant[1]) - 1;
    if (!registration || !registration.participant_names[index]) return new Response(null, { status: 404, headers });
    const png = await renderParticipantPass(registration, index);
    return new Response(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
