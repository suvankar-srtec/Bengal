import {z} from "zod";
import {getDatabase} from "@/lib/db";
import {requireManager} from "@/lib/manager-phone-verification";
import {normalizeEmail,verifyEmailChange} from "@/lib/manager-email-verification";
import {limitedJson,RequestError,requestErrorResponse} from "@/lib/request-security";
export const runtime="nodejs";
const schema=z.object({registrationId:z.uuid(),email:z.string().trim().max(254),challengeId:z.uuid().optional(),code:z.string().regex(/^\d{6}$/).optional()});
export async function POST(request:Request){
  try{
    const manager=await requireManager();
    const parsed=schema.safeParse(await limitedJson(request));
    if(!parsed.success)throw new RequestError("Enter a valid email address and six-digit verification code.");
    const input={...parsed.data,email:normalizeEmail(parsed.data.email)};
    const db=await getDatabase().connect();
    try{
      await db.query("BEGIN");
      const row=(await db.query("SELECT email,event_id FROM public.bbc_event_registrations WHERE id=$1 FOR UPDATE",[input.registrationId])).rows[0];
      if(!row)throw new RequestError("Registration not found.",404);
      if(row.event_id!==String(manager.eventId))throw new RequestError("You can edit emails only for your assigned event.",403);
      if(normalizeEmail(row.email)!==input.email){
        await verifyEmailChange(db,input,normalizeEmail(row.email),manager);
        // The current address authorizes the change; this does not verify the new inbox.
        // Keep corrections scoped to this registration, not other events.
        await db.query("UPDATE public.bbc_event_registrations SET email=$2,email_verified_at=NULL WHERE id=$1",[input.registrationId,input.email]);
      }
      await db.query("COMMIT");
      return Response.json({ok:true,email:input.email},{headers:{"Cache-Control":"no-store"}});
    }catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
  }catch(error){return requestErrorResponse(error);}
}
