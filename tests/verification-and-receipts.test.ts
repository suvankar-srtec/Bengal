import { normalizePhone } from "../src/lib/manager-phone-verification";
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {newVerificationCode, verificationHash, verificationCodeMatches} from "../src/lib/verification-security";
import {validateReceipt} from "../src/lib/payment-review";
import {sendEmail, EmailError} from "../src/lib/email";

test("OTP hashes bind the six-digit code to its challenge and secret",()=>{
  const secret="a".repeat(64), id="challenge-a", code="123456";
  const hash=verificationHash(secret,`${id}:${code}`);
  assert.equal(verificationCodeMatches(secret,id,code,hash),true);
  for(const [challenge,candidate] of [["challenge-b",code],[id,"123457"],[id,"12345"],[id,"1234567"]])assert.equal(verificationCodeMatches(secret,challenge,candidate,hash),false);
  assert.equal(verificationCodeMatches("b".repeat(64),id,code,hash),false);
  for(let i=0;i<100;i++)assert.match(newVerificationCode(),/^\d{6}$/);
});
test("receipts reject unsupported/oversized content and re-encode valid images",async()=>{
  await assert.rejects(validateReceipt(new File(["<script>alert(1)</script>"],"fake.png",{type:"image/png"})));
  await assert.rejects(validateReceipt(new File([new Uint8Array(3*1024*1024+1)],"large.pdf")));
  await assert.rejects(validateReceipt(new File(["%PDF-1.4 incomplete"],"invalid.pdf")));
  const png=await sharp({create:{width:100,height:60,channels:3,background:"white"}}).png().toBuffer();
  const image=await validateReceipt(new File([new Uint8Array(png)],"../../receipt.html",{type:"text/html"}));
  assert.equal(image.mime,"image/jpeg");assert.equal(image.name,"bank-receipt.jpg");assert.equal((await sharp(image.data).metadata()).format,"jpeg");
  const pdf=await validateReceipt(new File(["%PDF-1.4\n%%EOF"],"receipt.pdf"));assert.equal(pdf.mime,"application/pdf");
});
test("Resend transport passes idempotency key and classifies uncertain outcomes",async()=>{
  const previous={provider:process.env.EMAIL_PROVIDER,from:process.env.EMAIL_FROM,key:process.env.RESEND_API_KEY};
  process.env.EMAIL_PROVIDER="resend";process.env.EMAIL_FROM="BBC <no-reply@example.com>";process.env.RESEND_API_KEY="test-key";
  const input={to:"member@example.com",subject:"Your Event Pass",text:"Test",idempotencyKey:"pass-test"};
  try {
    let calls=0;
    const mock:typeof fetch=async(url,options)=>{calls++;assert.equal(String(url),"https://api.resend.com/emails");assert.equal(new Headers(options?.headers).get("Idempotency-Key"),"pass-test");assert.equal(JSON.parse(String(options?.body)).to[0],input.to);return Response.json({id:"test-message"});};
    assert.equal(await sendEmail(input,mock),"test-message");assert.equal(calls,1);
    await assert.rejects(sendEmail(input,async()=>{throw new Error("timeout");}),error=>error instanceof EmailError&&error.uncertain);
    await assert.rejects(sendEmail(input,async()=>new Response("",{status:400})),error=>error instanceof EmailError&&!error.uncertain);
  }finally{
    for(const [key,value] of Object.entries({EMAIL_PROVIDER:previous.provider,EMAIL_FROM:previous.from,RESEND_API_KEY:previous.key})){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});

test("manager phone verification uses one canonical destination",()=>{
  for(const input of ["9876543210","919876543210","+91 98765 43210"])assert.equal(normalizePhone(input),"+919876543210");
  assert.equal(normalizePhone("+44 7700 900123"),"+447700900123");
  for(const input of ["123","9876543210,9876543211","call9876543210","+00000000"])assert.throws(()=>normalizePhone(input));
});
