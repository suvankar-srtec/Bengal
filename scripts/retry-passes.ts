import {getDatabase} from "../src/lib/db";
import {deliverRegistrationPasses} from "../src/lib/pass-delivery";
async function main(){
 const db=getDatabase();
 try{
  const rows=await db.query<{registration_id:string}>(`SELECT DISTINCT registration_id FROM (
    SELECT registration_id,updated_at FROM public.bbc_whatsapp_pass_deliveries WHERE media_expires_at>NOW() AND
      ((status IN ('pending','failed') AND attempts<3 AND next_attempt_at<=NOW()) OR (status='sending' AND updated_at<NOW()-INTERVAL '2 minutes'))
    UNION ALL SELECT registration_id,updated_at FROM public.bbc_email_pass_deliveries WHERE
      ((status IN ('pending','failed') AND attempts<3 AND next_attempt_at<=NOW()) OR (status='sending' AND updated_at<NOW()-INTERVAL '2 minutes'))
   ) due LIMIT 25`);
  for(const row of rows.rows)await deliverRegistrationPasses(row.registration_id);
  console.log(`Checked ${rows.rowCount} queued pass deliveries.`);
 }finally{await db.end();}
}
void main().catch(()=>{console.error("Pass delivery worker failed.");process.exitCode=1;});
