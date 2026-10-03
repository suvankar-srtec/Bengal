import { z } from "zod";
import { limitedBody, RequestError, requestErrorResponse } from "@/lib/request-security";
import { paymentAccessSchema, submitPayment, validateReceipt } from "@/lib/payment-review";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") || "";
    if (!type.startsWith("multipart/form-data")) throw new RequestError("Upload the payment form.",415);
    const bytes = await limitedBody(request, 3*1024*1024+16384);
    let form: FormData;
    try { form = await new Response(new Uint8Array(bytes),{headers:{"Content-Type":type}}).formData(); }
    catch { throw new RequestError("The payment form could not be read."); }
    const parsed = paymentAccessSchema.extend({
      requestId:z.uuid(),
      method:z.enum(["cash","bank"]),
      transactionId:z.string().trim().regex(/^[A-Za-z0-9._\\/-]{4,100}$/).optional(),
    }).safeParse(Object.fromEntries(form));
    if (!parsed.success) throw new RequestError("Choose a valid payment method.");
    if (parsed.data.method === "bank" && !parsed.data.transactionId) throw new RequestError("Enter the bank transaction ID.");
    const file = form.get("receipt");
    const receipt = file instanceof File && file.size ? await validateReceipt(file) : null;
    return Response.json({review:await submitPayment(parsed.data,receipt)}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) { return requestErrorResponse(error); }
}
