import {z} from "zod";
import {getDatabase} from "@/lib/db";
import {requireManager,normalizePhone,verifyPhoneChange} from "@/lib/manager-phone-verification";
import {limitedJson,RequestError,requestErrorResponse} from "@/lib/request-security";
export const runtime="nodejs";
const schema=z.object({registrationId:z.uuid(),phone:z.string().trim().min(8).max(20),challengeId:z.uuid().optional(),code:z.string().regex(/^\d{6}$/).optional()});
export async function POST(request:Request){
  try{
    const manager=await requireManager();
    const parsed=schema.safeParse(await limitedJson(request));
    if(!parsed.success)throw new RequestError("Enter a valid number and six-digit verification code.");
    const input={...parsed.data,phone:normalizePhone(parsed.data.phone)};
    const db=await getDatabase().connect();
    try{
      await db.query("BEGIN");
      const row=(await db.query("SELECT email,event_id,phone FROM public.bbc_event_registrations WHERE id=$1 FOR UPDATE",[input.registrationId])).rows[0];
      if(!row)throw new RequestError("Registration not found.",404);
      if(row.event_id!==String(manager.eventId))throw new RequestError("You can edit numbers only for your assigned event.",403);
      if(row.phone!==input.phone){
        await verifyPhoneChange(db,input,row.phone,manager);
        await db.query("UPDATE public.bbc_event_registrations SET phone=$2,phone_verified_at=NOW() WHERE id=$1",[input.registrationId,input.phone]);
        await db.query("UPDATE public.bbc_members SET phone=$2,updated_at=NOW() WHERE email=$1",[row.email,input.phone]);
      }
      await db.query("COMMIT");
      return Response.json({ok:true,phone:input.phone},{headers:{"Cache-Control":"no-store"}});
    }catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
  }catch(error){return requestErrorResponse(error);}
}
