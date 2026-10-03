const assert=require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const {getDatabase}=require('../src/lib/db.ts');
const {verificationHash}=require('../src/lib/verification-security.ts');
const {adminSessionToken}=require('../src/lib/admin-auth.ts');
const base='http://127.0.0.1:3000';
const db=getDatabase(); const session=randomBytes(32).toString('hex');
const hash=verificationHash(process.env.CONTACT_VERIFICATION_SECRET,session);
const cookie='bbc_contact_session='+session;
const admin='bbc_admin_session='+adminSessionToken({role:'admin'});
const manager='bbc_admin_session='+adminSessionToken({role:'manager',managerId:randomUUID(),eventId:2,userId:'test-review'});
const challengeIds=[];const submissions=[];
const email=`payment-check-${randomUUID()}@example.com`;
const code='246810';let registrationId;const managerId=randomUUID();let assignedManager;
async function post(path,body,auth=cookie){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:auth},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
async function challenge(destination,extra=''){
 const id=randomUUID();challengeIds.push(id);
 await db.query(`INSERT INTO public.bbc_contact_verifications(id,session_hash,ip_hash,channel,destination,code_hash,status,expires_at,registration_id,actor_id,previous_destination) VALUES($1,$2,$2,'phone',$3,$4,'sent',NOW()+INTERVAL '10 minutes',$5,$6,'+919000000000')`,[id,hash,destination,verificationHash(process.env.CONTACT_VERIFICATION_SECRET,`${id}:${code}`),registrationId,managerId]);
 if(extra)await db.query(extra,[id]);return id;
}
async function payment(method,file,requestId=randomUUID()){
 const form=new FormData();for(const [k,v]of Object.entries({registrationId,submissionId:submissions[0],requestId,method}))form.set(k,v);if(file)form.set('receipt',file);
 const r=await fetch(base+'/api/registration-payments',{method:'POST',headers:{Origin:base},body:form});return {status:r.status,data:await r.json(),requestId};
}
(async()=>{try{
 const event=(await db.query('SELECT id FROM public.bbc_event_content ORDER BY id LIMIT 1')).rows[0];
 const values={submissionId:randomUUID(),eventContentId:event.id,memberName:'Payment flow test',email,phone:'9000000000',billingDetails:'',participationQuantity:1,standeeQuantity:0,mealChoice:null,presentationSelected:false,additionalParticipantNames:[]};submissions.push(values.submissionId);
 // Public spot registration deliberately does not require OTP.
 const saved=await post('/api/registrations',values);assert.equal(saved.status,201,JSON.stringify(saved.data));registrationId=saved.data.registration.id;
 assert.equal(saved.data.registration.paymentStatus,'unpaid');
 assert.equal((await post('/api/registrations',values)).status,200);
 const token=adminSessionToken({role:'manager',managerId,eventId:event.id,userId:'otp-test'});
 assignedManager='bbc_admin_session='+token+'; '+cookie;
 const otherManager='bbc_admin_session='+adminSessionToken({role:'manager',managerId:randomUUID(),eventId:event.id,userId:'other-test'})+'; '+cookie;
 const wrongEvent='bbc_admin_session='+adminSessionToken({role:'manager',managerId,eventId:event.id+100000,userId:'wrong-event'})+'; '+cookie;
 const phoneRoute='/api/manager/registration-phone';
 const change={registrationId,phone:'+919000000001'};
 assert.equal((await post(phoneRoute+'/send-code',change,'')).status,401);
 assert.equal((await post(phoneRoute+'/send-code',change,admin)).status,403);
 assert.equal((await post(phoneRoute+'/send-code',change,wrongEvent)).status,403);
 assert.equal((await post(phoneRoute,change,assignedManager)).status,403);
 const expired=await challenge(change.phone,"UPDATE public.bbc_contact_verifications SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1");
 assert.equal((await post(phoneRoute,{...change,challengeId:expired,code},assignedManager)).status,403);
 const locked=await challenge(change.phone);
 for(let i=0;i<5;i++)assert.equal((await post(phoneRoute,{...change,challengeId:locked,code:'000000'},assignedManager)).status,400);
 assert.equal((await post(phoneRoute,{...change,challengeId:locked,code},assignedManager)).status,403);
 const valid=await challenge(change.phone);
 assert.equal((await post(phoneRoute,{...change,challengeId:valid,code},otherManager)).status,403);
 assert.equal((await post(phoneRoute,{...change,challengeId:valid,code},'bbc_admin_session='+token+'; bbc_contact_session='+randomBytes(32).toString('hex'))).status,403);
 assert.equal((await post(phoneRoute,{...change,phone:'+919000000002',challengeId:valid,code},assignedManager)).status,403);
 assert.equal((await db.query('SELECT phone FROM public.bbc_event_registrations WHERE id=$1',[registrationId])).rows[0].phone,'+919000000000');
 assert.equal((await post(phoneRoute,{...change,challengeId:valid,code},assignedManager)).status,200);
 assert.equal((await post(phoneRoute,{...change,challengeId:valid,code},assignedManager)).status,200);
 assert.equal((await db.query('SELECT phone FROM public.bbc_event_registrations WHERE id=$1',[registrationId])).rows[0].phone,change.phone);
 assert.equal((await db.query('SELECT phone FROM public.bbc_members WHERE email=$1',[email])).rows[0].phone,change.phone);
 assert.equal((await post(phoneRoute,{...change,phone:'+919000000000',challengeId:valid,code},assignedManager)).status,403);
 assert.equal((await post('/api/passes',{registrationId,submissionId:values.submissionId})).status,404);
 assert.equal((await post('/api/payments/order',{})).status,410);
 assert.equal((await payment('bank')).status,400);
 assert.equal((await payment('bank',new File(['<script>fake</script>'],'receipt.png'))).status,400);
 const cash=await payment('cash');assert.equal(cash.status,200,JSON.stringify(cash.data));
 assert.equal((await payment('cash',null,cash.requestId)).data.review.id,cash.data.review.id);
 assert.equal((await payment('cash')).status,409);
 const route='/api/admin/payment-reviews/'+cash.data.review.id;
 assert.equal((await post(route,{decision:'approved'},'')).status,401);
 assert.equal((await post(route,{decision:'approved'},manager)).status,403);
 assert.equal((await post(route,{decision:'rejected',note:'Use a bank receipt for this test'},admin)).status,200);
 const pdf=new File(['%PDF-1.4\n%%EOF'],'receipt.pdf',{type:'application/pdf'});
 const bank=await payment('bank',pdf);assert.equal(bank.status,200,JSON.stringify(bank.data));
 const receiptPath='/api/admin/payment-reviews/'+bank.data.review.id+'/receipt';
 assert.equal((await fetch(base+receiptPath)).status,401);
 assert.equal((await fetch(base+receiptPath,{headers:{Cookie:manager}})).status,403);
 const download=await fetch(base+receiptPath,{headers:{Cookie:admin}});assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment/);
 // Suppress external delivery for this dummy registration before exercising approval HTTP route.
 await db.query(`INSERT INTO public.bbc_whatsapp_pass_deliveries(registration_id,media_token,status,attempts) VALUES($1,$2,'failed',3)`,[registrationId,randomBytes(32).toString('hex')]);
 await db.query(`INSERT INTO public.bbc_email_pass_deliveries(registration_id,status,attempts) VALUES($1,'failed',3)`,[registrationId]);
 const approval='/api/admin/payment-reviews/'+bank.data.review.id;
 const decisions=await Promise.all([post(approval,{decision:'approved'},admin),post(approval,{decision:'approved'},admin)]);decisions.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.data)));
 const row=(await db.query('SELECT payment_status,amount_paid_paise,total_paise,payment_approved_at,email_verified_at,phone_verified_at FROM public.bbc_event_registrations WHERE id=$1',[registrationId])).rows[0];
 assert.equal(row.payment_status,'paid');assert.equal(row.amount_paid_paise,row.total_paise);assert.ok(row.payment_approved_at&&row.phone_verified_at);
 assert.equal((await post(approval,{decision:'rejected',note:'late rejection'},admin)).status,409);
 const passes=await post('/api/passes',{registrationId,submissionId:values.submissionId});assert.equal(passes.status,200);assert.equal(passes.data.passes.length,1);assert.match(passes.data.bundleUrl,/^\/passes\//);
 assert.equal((await post('/api/admin/send-registration-whatsapp',{registrationId},wrongEvent)).status,403);
 assert.equal((await post('/api/registration-payments/status',{registrationId,submissionId:values.submissionId})).data.review.status,'approved');
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM public.bbc_email_pass_deliveries WHERE registration_id=$1',[registrationId])).rows[0].n,1);
 // Exercise independent deliveries with an in-process HTTP mock; no provider request leaves this process.
 const {deliverRegistrationPasses}=require('../src/lib/pass-delivery.ts');
 const previousFetch=global.fetch;
 const keys=['EMAIL_PROVIDER','EMAIL_FROM','RESEND_API_KEY','WAPMONKEY_API_KEY','WAPMONKEY_DEVICE_TOKEN','APP_PUBLIC_URL'];
 const previousEnv=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 Object.assign(process.env,{EMAIL_PROVIDER:'resend',EMAIL_FROM:'BBC <sender@example.com>',RESEND_API_KEY:'test',WAPMONKEY_API_KEY:'test',WAPMONKEY_DEVICE_TOKEN:'test',APP_PUBLIC_URL:'https://example.com'});
 const calls={whatsapp:0,email:0};let emailShouldFail=true;
 global.fetch=async(url)=>{
  if(String(url)==='https://api.wapmonkey.com/v1/sendmessage'){calls.whatsapp++;return Response.json({status:1,data:{messageId:'mock-whatsapp'}});}
  if(String(url)==='https://api.resend.com/emails'){calls.email++;return emailShouldFail?new Response('',{status:400}):Response.json({id:'mock-email'});}
  throw new Error('Unexpected external request blocked');
 };
 try{
  await db.query("UPDATE public.bbc_whatsapp_pass_deliveries SET status='pending',attempts=0,next_attempt_at=NOW() WHERE registration_id=$1",[registrationId]);
  await db.query("UPDATE public.bbc_email_pass_deliveries SET status='pending',attempts=0,next_attempt_at=NOW() WHERE registration_id=$1",[registrationId]);
  await deliverRegistrationPasses(registrationId);
  assert.deepEqual(calls,{whatsapp:1,email:1});
  assert.equal((await db.query('SELECT status FROM public.bbc_whatsapp_pass_deliveries WHERE registration_id=$1',[registrationId])).rows[0].status,'accepted');
  assert.equal((await db.query('SELECT status FROM public.bbc_email_pass_deliveries WHERE registration_id=$1',[registrationId])).rows[0].status,'failed');
  emailShouldFail=false;await db.query('UPDATE public.bbc_email_pass_deliveries SET next_attempt_at=NOW() WHERE registration_id=$1',[registrationId]);
  await Promise.all([deliverRegistrationPasses(registrationId),deliverRegistrationPasses(registrationId)]);
  assert.deepEqual(calls,{whatsapp:1,email:2});
  assert.equal((await db.query('SELECT status FROM public.bbc_email_pass_deliveries WHERE registration_id=$1',[registrationId])).rows[0].status,'accepted');
 }finally{global.fetch=previousFetch;for(const key of keys){if(previousEnv[key]===undefined)delete process.env[key];else process.env[key]=previousEnv[key];}}
 console.log('PASS: OTP-free spot registration; manager code expiry, attempt limits, manager/session/number binding and one-time consumption; unpaid registration; cash/bank receipt validation; admin-only review; private download; idempotent approval; paid-only QR access; independent delivery retry without duplicate WhatsApp sends. No messages sent.');
}finally{
 if(registrationId)await db.query('DELETE FROM public.bbc_event_registrations WHERE id=$1 AND email=$2',[registrationId,email]);
 await db.query('DELETE FROM public.bbc_members WHERE email=$1',[email]);
 await db.query('DELETE FROM public.bbc_contact_verifications WHERE id=ANY($1::uuid[])',[challengeIds]);
 await db.end();
}})().catch(error=>{console.error(error);process.exitCode=1;});
