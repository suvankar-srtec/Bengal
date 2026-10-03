import {z} from "zod";
import {requireManager,requestPhoneChangeCode} from "@/lib/manager-phone-verification";
import {limitedJson,RequestError,requestErrorResponse} from "@/lib/request-security";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){
  try{
    const manager=await requireManager();
    const parsed=z.object({registrationId:z.uuid(),phone:z.string().trim().min(8).max(20)}).safeParse(await limitedJson(request));
    if(!parsed.success)throw new RequestError("Enter a valid WhatsApp number.");
    return Response.json(await requestPhoneChangeCode(parsed.data,request,manager),{headers:{"Cache-Control":"no-store"}});
  }catch(error){return requestErrorResponse(error);}
}
