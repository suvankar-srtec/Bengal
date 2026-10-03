import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { requirePaymentAdmin } from "@/lib/payment-review";
import { RequestError, requestErrorResponse } from "@/lib/request-security";
export const runtime = "nodejs";
export async function GET(_request: Request, {params}: {params:Promise<{id:string}>}) {
  try {
    await requirePaymentAdmin();
    const {id} = await params;
    if (!z.uuid().safeParse(id).success) throw new RequestError("Invalid receipt.");
    const row = (await getDatabase().query("SELECT receipt_data,receipt_mime,receipt_name FROM public.bbc_registration_payment_reviews WHERE id=$1 AND method='bank'",[id])).rows[0];
    if (!row?.receipt_data) throw new RequestError("Receipt not found.",404);
    return new Response(new Uint8Array(row.receipt_data),{headers:{"Content-Type":row.receipt_mime,"Content-Disposition":`attachment; filename="${row.receipt_name}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox"}});
  } catch(error) {return requestErrorResponse(error);}
}
