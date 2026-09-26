import { after } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { participantPass } from "@/lib/participant-pass";
import { deliveryDetails, deliverWhatsAppPassesSafely, loadPassRegistration, passImagePath, queueWhatsAppPasses } from "@/lib/whatsapp-delivery";

export const runtime = "nodejs";
export const maxDuration = 60;
const access = z.object({ registrationId: z.uuid(), submissionId: z.uuid(), retry: z.boolean().optional() });
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "Use this website to view your passes." }, { status: 403, headers });
    if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Use JSON." }, { status: 415, headers });
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 2048) { await reader.cancel(); return Response.json({ error: "Request too large." }, { status: 413, headers }); }
      chunks.push(part.value);
    }
    const data = access.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const authorized = (await getDatabase().query(`SELECT id FROM public.bbc_event_registrations
      WHERE id = $1 AND submission_id = $2 AND payment_status = 'paid'`, [data.registrationId, data.submissionId])).rowCount;
    if (!authorized) return Response.json({ error: "Paid registration not found." }, { status: 404, headers });
    await queueWhatsAppPasses(getDatabase(), data.registrationId);
    const [registration, delivery] = await Promise.all([loadPassRegistration(data.registrationId), deliveryDetails(data.registrationId)]);
    if (!registration || !delivery) throw new Error("Passes unavailable");
    if (delivery.status === "pending" || delivery.status === "sending" || (data.retry && delivery.status === "failed")) {
      after(() => deliverWhatsAppPassesSafely(data.registrationId));
    }
    return Response.json({
      passes: registration.participant_names.map((_, index) => {
        const { payload: _payload, ...pass } = participantPass(registration, index);
        return { ...pass, passUrl: passImagePath(delivery.media_token, index + 1) };
      }),
      whatsapp: { status: delivery.status, canRetry: delivery.status === "failed" && delivery.attempts < 3,
        retryAfterSeconds: Math.max(0, Math.ceil((delivery.next_attempt_at.getTime() - Date.now()) / 1000)) },
    }, { headers });
  } catch (error) {
    const badRequest = error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError;
    return Response.json({ error: badRequest ? "Invalid pass request." : "Passes are temporarily unavailable. Please retry." }, { status: badRequest ? 400 : 503, headers });
  }
}
