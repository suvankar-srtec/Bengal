import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { deliverRegistrationPasses, passDeliveryStatuses, queueRegistrationPasses } from "@/lib/pass-delivery";
import {
  allParticipantPhotosUploaded,
  deliverParticipantPhotoRequests,
  participantPhotoProgress,
  queueParticipantPhotoRequests,
} from "@/lib/participant-photo";
import { limitedJson, RequestError, requestErrorResponse } from "@/lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 60;

// Existing callers retain this endpoint. Until every participant has a photo,
// it retries the individual photo links; after that it sends the final passes.
export async function POST(request: Request) {
  try {
    const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
    if (!session) throw new RequestError("Sign in to send participant links or passes.", 401);

    const parsed = z.object({ registrationId: z.uuid() }).safeParse(await limitedJson(request));
    if (!parsed.success) throw new RequestError("Invalid registration.");

    const id = parsed.data.registrationId;
    const db = getDatabase();
    const row = (await db.query(
      "SELECT event_id FROM public.bbc_event_registrations WHERE id=$1 AND payment_status='paid'",
      [id],
    )).rows[0];
    if (!row) throw new RequestError("Paid registration not found.", 404);
    if (session.role === "manager" && row.event_id !== String(session.eventId)) {
      throw new RequestError("This registration is not in your assigned event.", 403);
    }

    await queueParticipantPhotoRequests(db, id);
    const ready = await allParticipantPhotosUploaded(id);

    if (!ready) {
      // This endpoint is an explicit admin retry. Photo-link duplicates are safe,
      // so retry failed and provider-unknown attempts instead of leaving members stuck.
      await db.query(`
        UPDATE public.bbc_participant_photos
        SET email_status = CASE WHEN email_status IN ('failed','unknown') THEN 'pending' ELSE email_status END,
            whatsapp_status = CASE WHEN whatsapp_status IN ('failed','unknown') THEN 'pending' ELSE whatsapp_status END,
            updated_at = NOW()
        WHERE registration_id = $1
      `, [id]);
      await deliverParticipantPhotoRequests(id);
      const progress = await participantPhotoProgress(id);
      return Response.json({
        ok: true,
        status: "awaiting_photos",
        progress,
        message: `Participant photos: ${progress.uploaded}/${progress.total}. Photo links — WhatsApp: ${progress.whatsapp_sent}/${progress.total}, Email: ${progress.email_sent}/${progress.total}.`,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    await queueRegistrationPasses(db, id);
    await db.query("UPDATE public.bbc_whatsapp_pass_deliveries SET status='pending' WHERE registration_id=$1 AND status='manual'", [id]);
    await deliverRegistrationPasses(id);

    const delivery = await passDeliveryStatuses(id);
    const sent = delivery?.whatsapp === "accepted" && delivery?.email === "accepted";
    const labels: Record<string, string> = {
      accepted: "sent to provider",
      pending: "queued",
      sending: "sending",
      failed: "failed (retry after a minute)",
      unknown: "unconfirmed; check provider before retrying",
    };
    return Response.json({
      ok: true,
      status: sent ? "accepted" : "partial",
      delivery,
      message: `WhatsApp: ${labels[delivery?.whatsapp] || "not sent"}. Email: ${labels[delivery?.email] || "not sent"}.`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
