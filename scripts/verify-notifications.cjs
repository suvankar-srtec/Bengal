const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {getDatabase}=require('../src/lib/db.ts');
const {adminSessionToken}=require('../src/lib/admin-auth.ts');
const base='http://127.0.0.1:3000';
const db=getDatabase(),registrations=[],reviews=[],emails=[];
const admin='bbc_admin_session='+adminSessionToken({role:'admin'});
const manager='bbc_admin_session='+adminSessionToken({role:'manager',managerId:randomUUID(),eventId:4,userId:'notification-test'});
async function post(path,body,cookie=admin,origin=base){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:origin},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
async function counts(){const response=await fetch(base+'/api/admin/notifications',{headers:{Cookie:admin}});assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);return response.json();}
(async()=>{try{
 assert.equal((await fetch(base+'/api/admin/notifications')).status,401);
 assert.equal((await fetch(base+'/api/admin/notifications',{headers:{Cookie:manager}})).status,403);
 const event=(await db.query('SELECT id FROM public.bbc_event_content ORDER BY id LIMIT 1')).rows[0];
 const before=await counts();
 for(let i=0;i<2;i++){
  const email='notification-test-'+randomUUID()+'@example.com';emails.push(email);const submissionId=randomUUID();
  const result=await post('/api/registrations',{submissionId,eventContentId:event.id,memberName:'Notification test '+i,email,phone:'9000000000',billingDetails:'',participationQuantity:1,standeeQuantity:0,mealChoice:null,presentationSelected:false,additionalParticipantNames:[]},'');
  assert.equal(result.status,201);const registrationId=result.body.registration.id;registrations.push(registrationId);
  const form=new FormData();Object.entries({registrationId,submissionId,requestId:randomUUID(),method:'cash'}).forEach(([key,value])=>form.set(key,value));
  const response=await fetch(base+'/api/registration-payments',{method:'POST',headers:{Origin:base},body:form});assert.equal(response.status,200);reviews.push((await response.json()).review.id);
 }
 const arrived=await counts();assert.equal(arrived.unread,before.unread+2);assert.equal(arrived.pending,before.pending+2);
 assert.equal((await post('/api/admin/notifications',{ids:[reviews[0]]},'')).status,401);
 assert.equal((await post('/api/admin/notifications',{ids:[reviews[0]]},manager)).status,403);
 assert.equal((await post('/api/admin/notifications',{ids:[reviews[0]]},admin,'https://other.example')).status,403);
 assert.equal((await post('/api/admin/notifications',{ids:[]})).status,400);
 assert.equal((await post('/api/admin/notifications',{ids:[reviews[0]]})).status,200);
 const firstRead=(await db.query('SELECT read_at,status FROM public.bbc_registration_payment_reviews WHERE id=$1',[reviews[0]])).rows[0];assert.ok(firstRead.read_at);assert.equal(firstRead.status,'pending');
 assert.equal((await db.query('SELECT read_at FROM public.bbc_registration_payment_reviews WHERE id=$1',[reviews[1]])).rows[0].read_at,null);
 const viewed=await counts();assert.equal(viewed.unread,before.unread+1);assert.equal(viewed.pending,before.pending+2);
 assert.equal((await post('/api/admin/notifications',{ids:[reviews[0]]})).status,200);
 assert.equal((await db.query('SELECT read_at FROM public.bbc_registration_payment_reviews WHERE id=$1',[reviews[0]])).rows[0].read_at.getTime(),firstRead.read_at.getTime());
 assert.equal((await post('/api/admin/payment-reviews/'+reviews[0],{decision:'rejected',note:'Dummy notification test'})).status,200);
 const reviewed=await counts();assert.equal(reviewed.unread,before.unread+1);assert.equal(reviewed.pending,before.pending+1);
 assert.equal((await post('/api/admin/payment-reviews/'+reviews[1],{decision:'rejected',note:'Dummy notification test'})).status,200);
 const done=await counts();assert.equal(done.unread,before.unread);assert.equal(done.pending,before.pending);
 const page=await fetch(base+'/report/payments?q=notification-test&status=all',{headers:{Cookie:admin}});const html=await page.text();
 assert.ok(page.url.includes('/notifications?')||html.includes('NEXT_REDIRECT;replace;/notifications?'));assert.ok(html.includes('notification-test'));
 console.log('PASS: admin-only counts, independent unread/pending states, persistent/idempotent read state, new arrivals stay unread, review clears pending, legacy URL redirect. No messages sent.');
}finally{
 await db.query('DELETE FROM public.bbc_event_registrations WHERE id=ANY($1::uuid[])',[registrations]);
 await db.query('DELETE FROM public.bbc_members WHERE email=ANY($1::text[])',[emails]);
 await db.end();
}})().catch(error=>{console.error(error);process.exitCode=1;});
