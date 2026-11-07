const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const headers = require('next/headers');
const originalCookies = headers.cookies;
const jar = new Map();
headers.cookies = async () => ({ get: k => jar.has(k) ? { value: jar.get(k) } : undefined, set: (k,v) => jar.set(k,v) });
const { adminSessionToken } = require('../src/lib/admin-auth.ts');
const { POST: send } = require('../src/app/api/manager/registration-email/send-code/route.ts');
const { POST: save } = require('../src/app/api/manager/registration-email/route.ts');
const { normalizeEmail } = require('../src/lib/manager-email-verification.ts');
const { verificationHash } = require('../src/lib/verification-security.ts');

test('manager email changes require a code sent to the current inbox and enforce challenge boundaries', async () => {
  const beforePool = globalThis.registrationPool, beforeFetch = global.fetch;
  const envKeys = ['RESEND_API_KEY','CONTACT_VERIFICATION_SECRET'];
  const beforeEnv = Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
  process.env.RESEND_API_KEY = 'test-only'; process.env.CONTACT_VERIFICATION_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  const registrationId = randomUUID(), managerId = randomUUID();
  let registration = { event_id: '4', email: 'current@example.com' };
  let challenges = new Map(), snapshot = null, sentMail = null, deliveryFailure = false;
  let counts = { recent:'0', destination_count:'0', actor_count:'0', ip_count:'0' };
  async function query(sql, v=[]) {
    if(sql==='BEGIN') snapshot = { registration:{...registration}, challenges:structuredClone(challenges) };
    else if(sql==='COMMIT') snapshot=null;
    else if(sql==='ROLLBACK' && snapshot) { registration=snapshot.registration;challenges=snapshot.challenges;snapshot=null; }
    else if(sql.startsWith('SELECT event_id,email') || sql.startsWith('SELECT email,event_id')) return {rows: registration ? [registration] : []};
    else if(sql.includes('COUNT(*) FILTER')) return {rows:[counts]};
    else if(sql.startsWith('INSERT INTO public.bbc_contact_verifications')) { assert.ok(sql.includes("'email'"));challenges.set(v[0], {id:v[0],session_hash:v[1],destination:v[3],code_hash:v[4],registration_id:v[5],actor_id:v[6],previous_destination:v[7],status:'pending',valid:true,attempts:0,channel:'email'}); }
    else if(sql.startsWith('SELECT *,expires_at')) {
      const c=challenges.get(v[0]); assert.ok(sql.includes("channel='email'"));
      return {rows:c&&c.session_hash===v[1]&&c.registration_id===v[2]&&c.actor_id===v[3]&&c.destination===v[4]&&c.channel==='email'?[c]:[]};
    } else if(sql.includes("SET status='sent'")) challenges.get(v[0]).status='sent';
    else if(sql.includes('SET status=$2')) challenges.get(v[0]).status=v[1];
    else if(sql.includes('SET attempts=attempts+1')) challenges.get(v[0]).attempts++;
    else if(sql.includes('SET verified_at=NOW()')) challenges.get(v[0]).consumed_at=true;
    else if(sql.startsWith('UPDATE public.bbc_event_registrations')) { assert.ok(sql.includes('email_verified_at=NULL')); registration.email=v[1]; }
    else if(!['BEGIN','COMMIT','ROLLBACK'].includes(sql)&&!sql.includes('pg_advisory_xact_lock')) throw new Error('Unexpected query: '+sql);
    return {rows:[]};
  }
  globalThis.registrationPool={query,connect:async()=>({query,release(){}})};
  global.fetch=async (url, options)=>{assert.equal(url,'https://api.resend.com/emails');sentMail=JSON.parse(options.body);return deliveryFailure?Response.json({name:'validation_error'},{status:400}):Response.json({id:'test-email'});};
  const manager = (id=managerId,eventId=4)=>adminSessionToken({role:'manager',managerId:id,eventId,userId:'test'});
  const input={registrationId,email:' New@Example.COM '};
  const request=(body,origin='http://localhost')=>new Request('http://localhost/api/manager/registration-email',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Host:'localhost'},body:JSON.stringify(body)});
  const invoke=async(fn,body=input,origin)=>{const r=await fn(request(body,origin));return {status:r.status,data:await r.json()};};
  try {
    assert.equal(normalizeEmail(' User@Example.COM '),'user@example.com');
    assert.throws(()=>normalizeEmail('invalid'));
    assert.equal((await invoke(send)).status,401);
    jar.set('bbc_admin_session',adminSessionToken({role:'admin'}));assert.equal((await invoke(send)).status,403);
    jar.set('bbc_admin_session',manager(managerId,5));assert.equal((await invoke(send)).status,403);
    jar.set('bbc_admin_session',manager());
    assert.equal((await invoke(send,input,'https://wrong.example')).status,403);
    assert.equal((await invoke(send,{...input,email:'invalid'})).status,400);
    assert.equal((await invoke(save)).status,403);
    counts.recent='1';assert.equal((await invoke(send)).status,429);counts.recent='0';
    counts.actor_count='20';assert.equal((await invoke(send)).status,429);counts.actor_count='0';
    const issued=await invoke(send);assert.equal(issued.status,200);
    assert.deepEqual(sentMail.to,['current@example.com']);assert.ok(sentMail.text.includes('new@example.com'));
    const code=sentMail.text.match(/code is (\d{6})/)[1];const challengeId=issued.data.challengeId;
    const c=()=>challenges.get(challengeId);
    assert.notEqual(c().code_hash,code);assert.equal(c().code_hash,verificationHash(process.env.CONTACT_VERIFICATION_SECRET,`${challengeId}:${code}`));
    const proof={...input,challengeId,code};
    assert.equal((await invoke(save,{...proof,email:'another@example.com'})).status,403);
    jar.set('bbc_admin_session',manager(randomUUID()));assert.equal((await invoke(save,proof)).status,403);jar.set('bbc_admin_session',manager());
    const cookie=jar.get('bbc_contact_session');jar.set('bbc_contact_session','a'.repeat(64));assert.equal((await invoke(save,proof)).status,403);jar.set('bbc_contact_session',cookie);
    c().valid=false;assert.equal((await invoke(save,proof)).status,403);c().valid=true;
    c().channel='phone';assert.equal((await invoke(save,proof)).status,403);c().channel='email';
    c().previous_destination='stale@example.com';assert.equal((await invoke(save,proof)).status,403);c().previous_destination='current@example.com';
    const wrong=code==='000000'?'111111':'000000';
    for(let i=0;i<5;i++)assert.equal((await invoke(save,{...proof,code:wrong})).status,400);
    assert.equal(c().attempts,5);assert.equal((await invoke(save,proof)).status,403);assert.equal(registration.email,'current@example.com');
    c().attempts=0;
    const saved=await invoke(save,proof);assert.equal(saved.status,200);assert.equal(saved.data.email,'new@example.com');assert.ok(c().consumed_at);
    assert.equal((await invoke(save,proof)).status,200); // Lost-response retry.
    registration.email='current@example.com';assert.equal((await invoke(save,proof)).status,403); // Consumed code cannot be replayed.
    deliveryFailure=true;assert.equal((await invoke(send,{...input,email:'other@example.com'})).status,502);
    assert.equal(registration.email,'current@example.com');
  } finally {
    headers.cookies=originalCookies;global.fetch=beforeFetch;globalThis.registrationPool=beforePool;
    for(const k of envKeys){if(beforeEnv[k]===undefined)delete process.env[k];else process.env[k]=beforeEnv[k];}
  }
});
