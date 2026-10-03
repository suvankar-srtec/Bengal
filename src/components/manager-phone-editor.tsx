"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
export function ManagerPhoneEditor({registrationId,phone}:{registrationId:string;phone:string}) {
  const router=useRouter();
  const [editing,setEditing]=useState(false);
  const [value,setValue]=useState(phone);
  const [savedPhone,setSavedPhone]=useState(phone);
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
      const response=await fetch(kind==="send"?"/api/manager/registration-phone/send-code":"/api/manager/registration-phone",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({registrationId,phone:value,...(kind==="save"?{challengeId:challenge,code}:{})}),signal:AbortSignal.timeout(45000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not update the WhatsApp number.");
      if(kind==="send") {setChallenge(data.challengeId);setCode("");setMessage(data.message);setCooldown(60);setTimeout(()=>otpInput.current?.focus(),0);}
      else {setValue(data.phone);setSavedPhone(data.phone);setEditing(false);setChallenge("");setCode("");setMessage("WhatsApp number verified and updated.");router.refresh();}
    }catch(reason){setError(reason instanceof Error&&reason.name!=="TimeoutError"?reason.message:"Connection interrupted. Please try again.");}
    finally{locked.current=false;setBusy(false);}
  }
  if(!editing)return <div className="manager-phone-display">
    <span>{savedPhone}</span>
    <button type="button" className="manager-phone-edit" onClick={()=>{setValue(savedPhone);setEditing(true);setError("");setMessage("");}} aria-label="Edit WhatsApp number" title="Edit WhatsApp number">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5V20h3.5L18.2 9.3l-3.5-3.5L4 16.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m13.9 6.6 3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>
    </button>
    {message&&<span className="sr-only" role="status">{message}</span>}
  </div>;
  return <div className="manager-phone-editor">
    <label className="sr-only" htmlFor={`manager-phone-${registrationId}`}>New WhatsApp number</label>
    <input id={`manager-phone-${registrationId}`} value={value} disabled={busy} onChange={event=>{setValue(event.target.value);setChallenge("");setCode("");setMessage("");setError("");}} inputMode="tel" autoFocus maxLength={20}/>
    <small>A code will be sent to the new WhatsApp number before it is saved.</small>
    <div className="manager-phone-editor-actions"><button type="button" disabled={busy||cooldown>0||value.trim()===savedPhone||value.trim().length<8} onClick={()=>void act("send")}>{busy?"Please wait...":cooldown?`Resend in ${cooldown}s`:challenge?"Resend code":"Send code"}</button></div>
    {challenge&&<>
      <label className="sr-only" htmlFor={`manager-code-${registrationId}`}>Verification code</label>
      <input ref={otpInput} id={`manager-code-${registrationId}`} value={code} disabled={busy} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6}/>
    </>}
    <div className="manager-phone-editor-actions">
      <button type="button" className="save" disabled={busy||!challenge||code.length!==6} onClick={()=>void act("save")}>{busy?"Please wait...":"Verify & save"}</button>
      <button type="button" className="cancel" disabled={busy} onClick={()=>{setValue(savedPhone);setEditing(false);setError("");setChallenge("");setCode("");setMessage("");}}>Cancel</button>
    </div>
    {message&&<small role="status">{message}</small>}{error&&<small role="alert">{error}</small>}
  </div>;
}
