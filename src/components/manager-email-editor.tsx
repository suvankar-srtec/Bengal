"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
export function ManagerEmailEditor({registrationId,email}:{registrationId:string;email:string}) {
  const router=useRouter();
  const [editing,setEditing]=useState(false);
  const [value,setValue]=useState(email);
  const [savedEmail,setSavedEmail]=useState(email);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [challenge,setChallenge]=useState("");
  const [code,setCode]=useState("");
  const [cooldown,setCooldown]=useState(0);
  const locked=useRef(false);
  const otpInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(n=>Math.max(0,n-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
  async function act(kind:"send"|"save"){
    if(locked.current)return;
    locked.current=true;setBusy(true);setError("");
    try{
      const response=await fetch(kind==="send"?"/api/manager/registration-email/send-code":"/api/manager/registration-email",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({registrationId,email:value,...(kind==="save"?{challengeId:challenge,code}:{})}),signal:AbortSignal.timeout(45000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not update the email address.");
      if(kind==="send") {setChallenge(data.challengeId);setCode("");setMessage(data.message);setCooldown(60);setTimeout(()=>otpInput.current?.focus(),0);}
      else {setValue(data.email);setSavedEmail(data.email);setEditing(false);setChallenge("");setCode("");setMessage("Email change authorized. Email address updated.");router.refresh();}
    }catch(reason){setError(reason instanceof Error&&reason.name!=="TimeoutError"?reason.message:"Connection interrupted. Please try again.");}
    finally{locked.current=false;setBusy(false);}
  }
  if(!editing)return <div className="manager-phone-display">
    <span>{savedEmail}</span>
    <button type="button" className="manager-phone-edit" onClick={()=>{setValue(savedEmail);setEditing(true);setError("");setMessage("");}} aria-label="Edit email address" title="Edit email address">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5V20h3.5L18.2 9.3l-3.5-3.5L4 16.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m13.9 6.6 3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>
    </button>
    {message&&<span className="sr-only" role="status">{message}</span>}
  </div>;
  return <div className="manager-phone-editor">
    <label className="sr-only" htmlFor={`manager-email-${registrationId}`}>New email address</label>
    <input id={`manager-email-${registrationId}`} value={value} disabled={busy} onChange={event=>{setValue(event.target.value);setChallenge("");setCode("");setMessage("");setError("");}} type="email" autoFocus maxLength={254}/>
    <div className="manager-phone-editor-actions"><button type="button" disabled={busy||cooldown>0||value.trim().toLowerCase()===savedEmail.toLowerCase()||!value.trim().includes("@")} onClick={()=>void act("send")}>{busy?"Please wait...":cooldown?`Resend in ${cooldown}s`:challenge?"Resend code":"Send Code"}</button></div>
    {challenge&&<>
      <label className="sr-only" htmlFor={`manager-email-code-${registrationId}`}>Verification code</label>
      <input ref={otpInput} id={`manager-email-code-${registrationId}`} value={code} disabled={busy} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6}/>
    </>}
    <div className="manager-phone-editor-actions">
      <button type="button" className="save" disabled={busy||!challenge||code.length!==6} onClick={()=>void act("save")}>{busy?"Please wait...":"Verify & save"}</button>
      <button type="button" className="cancel" disabled={busy} onClick={()=>{setValue(savedEmail);setEditing(false);setError("");setChallenge("");setCode("");setMessage("");}}>Cancel</button>
    </div>
    {message&&<small role="status">{message}</small>}{error&&<small role="alert">{error}</small>}
  </div>;
}
