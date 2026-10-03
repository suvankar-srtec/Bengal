import { z } from "zod";
import { after } from "next/server";
import { requirePaymentAdmin, reviewPayment } from "@/lib/payment-review";
import { deliverRegistrationPasses } from "@/lib/pass-delivery";
import { limitedJson, RequestError, requestErrorResponse } from "@/lib/request-security";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, {params}: {params:Promise<{id:string}>}) {
  try {
    await requirePaymentAdmin();
    const {id} = await params;
    const parsed = z.object({decision:z.enum(["approved","rejected"]),note:z.string().trim().max(500).default("")}).safeParse(await limitedJson(request));
    if (!z.uuid().safeParse(id).success || !parsed.success) throw new RequestError("Invalid payment review.");
    if (parsed.data.decision === "rejected" && !parsed.data.note) throw new RequestError("Enter a reason so the member can correct the payment request.");
    const result = await reviewPayment(id,parsed.data.decision,parsed.data.note);
    if (result.status === "approved") after(() => deliverRegistrationPasses(result.registrationId));
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return requestErrorResponse(error);}
}
