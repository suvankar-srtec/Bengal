import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { requirePaymentAdmin } from "@/lib/payment-review";
import { limitedJson, RequestError, requestErrorResponse } from "@/lib/request-security";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    await requirePaymentAdmin();
    const counts = (await getDatabase().query<{unread:number;pending:number}>(`
      SELECT COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread, COUNT(*)::int AS pending
      FROM public.bbc_registration_payment_reviews WHERE status='pending'`)).rows[0];
    return Response.json(counts, { headers });
  } catch (error) { return requestErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requirePaymentAdmin();
    const parsed = z.object({ ids:z.array(z.uuid()).min(1).max(50) }).safeParse(await limitedJson(request));
    if (!parsed.success) throw new RequestError("Invalid notification list.");
    // Mark only the items actually displayed. New arrivals and other pages remain unread.
    await getDatabase().query(`UPDATE public.bbc_registration_payment_reviews SET read_at=NOW()
      WHERE id=ANY($1::uuid[]) AND read_at IS NULL`, [parsed.data.ids]);
    return Response.json({ok:true}, {headers});
  } catch (error) { return requestErrorResponse(error); }
}
