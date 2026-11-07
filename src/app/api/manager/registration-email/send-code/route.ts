import {z} from "zod";
import {requireManager} from "@/lib/manager-phone-verification";
import {requestEmailChangeCode} from "@/lib/manager-email-verification";
import {limitedJson,RequestError,requestErrorResponse} from "@/lib/request-security";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){
  try{
    const manager=await requireManager();
    const parsed=z.object({registrationId:z.uuid(),email:z.string().trim().max(254)}).safeParse(await limitedJson(request));
    if(!parsed.success)throw new RequestError("Enter a valid email address.");
    return Response.json(await requestEmailChangeCode(parsed.data,request,manager),{headers:{"Cache-Control":"no-store"}});
  }catch(error){return requestErrorResponse(error);}
}
