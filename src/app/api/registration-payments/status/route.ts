import { getDatabase } from "@/lib/db";
import { paymentAccessSchema } from "@/lib/payment-review";
import { limitedJson, RequestError, requestErrorResponse } from "@/lib/request-security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const parsed = paymentAccessSchema.safeParse(await limitedJson(request));
    if (!parsed.success) throw new RequestError("Invalid registration.");
    const row = (await getDatabase().query(`SELECT r.payment_status, p.id,p.method,p.status,p.note,w.status AS whatsapp,e.status AS email
      FROM public.bbc_event_registrations r
      LEFT JOIN LATERAL (SELECT id,method,status,note FROM public.bbc_registration_payment_reviews WHERE registration_id=r.id ORDER BY created_at DESC LIMIT 1) p ON TRUE
      LEFT JOIN public.bbc_whatsapp_pass_deliveries w ON w.registration_id=r.id
      LEFT JOIN public.bbc_email_pass_deliveries e ON e.registration_id=r.id
      WHERE r.id=$1 AND r.submission_id=$2`,[parsed.data.registrationId,parsed.data.submissionId])).rows[0];
    if (!row) throw new RequestError("Registration not found.",404);
    return Response.json({review:row.id ? {id:row.id,method:row.method,status:row.status,note:row.note}:null,paymentStatus:row.payment_status,delivery:{whatsapp:row.whatsapp,email:row.email}}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) {return requestErrorResponse(error);}
}
