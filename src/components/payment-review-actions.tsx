"use client";
import { useRef, useState } from "react";
import { refreshNotificationStatus } from "./notification-status";
import { useRouter } from "next/navigation";
export function PaymentReviewActions({id,registrationId,status,method}:{id:string;registrationId:string;status:string;method:string}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");
  const [message,setMessage]=useState("");
  const locked=useRef(false);
  async function act(decision:"approved"|"rejected"|"retry") {
    if(locked.current)return;
    if(decision==="rejected"&&!note.trim()){setMessage("Enter a reason for rejecting this payment.");return;}
    locked.current=true;setBusy(true);setMessage("");
    try {
      const response=await fetch(decision==="retry"?"/api/admin/send-registration-whatsapp":`/api/admin/payment-reviews/${id}`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(decision==="retry"?{registrationId}:{decision,note}),signal:AbortSignal.timeout(55000)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"The request failed.");
      setMessage(decision==="retry"?result.message:decision==="approved"?"Payment approved. Pass delivery is queued.":"Payment rejected; registration remains unpaid.");
      void refreshNotificationStatus();
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Please retry.");}
    finally{locked.current=false;setBusy(false);}
  }
  return <div className="payment-review-actions">
    {status==="pending"&&<>
      <label className="sr-only" htmlFor={`review-note-${id}`}>Review note or rejection reason</label>
      <input id={`review-note-${id}`} value={note} onChange={event=>setNote(event.target.value)} placeholder="Note / rejection reason" maxLength={500} disabled={busy}/>
      <button type="button" className="payment-approve" disabled={busy} onClick={()=>void act("approved")}>{busy?"Please wait...":method==="cash"?"Confirm cash & issue passes":"Approve & issue passes"}</button>
      <button type="button" disabled={busy} onClick={()=>void act("rejected")}>Reject</button>
    </>}
    {status==="approved"&&<button type="button" disabled={busy} onClick={()=>void act("retry")}>{busy?"Sending...":"Retry pending / failed delivery"}</button>}
    {message&&<p role="status">{message}</p>}
  </div>;
}
