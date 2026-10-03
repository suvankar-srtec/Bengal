import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { deliverRegistrationPasses, passDeliveryStatuses, queueRegistrationPasses } from "@/lib/pass-delivery";
import { limitedJson, RequestError, requestErrorResponse } from "@/lib/request-security";
export const runtime = "nodejs";
export const maxDuration = 60;
// Existing callers retain their endpoint; sending now handles both channels independently.
export async function POST(request: Request) {
  try {
    const session=readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
    if(!session)throw new RequestError("Sign in to send passes.",401);
    const parsed=z.object({registrationId:z.uuid()}).safeParse(await limitedJson(request));
    if(!parsed.success)throw new RequestError("Invalid registration.");
    const id=parsed.data.registrationId;
    const db=getDatabase();
    const row=(await db.query("SELECT event_id FROM public.bbc_event_registrations WHERE id=$1 AND payment_status='paid'",[id])).rows[0];
    if(!row)throw new RequestError("Paid registration not found.",404);
    if(session.role==="manager"&&row.event_id!==String(session.eventId))throw new RequestError("This registration is not in your assigned event.",403);
    await queueRegistrationPasses(db,id);
    await db.query("UPDATE public.bbc_whatsapp_pass_deliveries SET status='pending' WHERE registration_id=$1 AND status='manual'",[id]);
    await deliverRegistrationPasses(id);
    const delivery=await passDeliveryStatuses(id);
    const sent=delivery?.whatsapp==="accepted"&&delivery?.email==="accepted";
    const labels:Record<string,string>={accepted:"sent to provider",pending:"queued",sending:"sending",failed:"failed (retry after a minute)",unknown:"unconfirmed; check provider before retrying"};
    return Response.json({ok:true,status:sent?"accepted":"partial",delivery,message:`WhatsApp: ${labels[delivery?.whatsapp]||"not sent"}. Email: ${labels[delivery?.email]||"not sent"}.`},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return requestErrorResponse(error);}
}
