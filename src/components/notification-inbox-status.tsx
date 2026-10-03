"use client";
import {useEffect,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {refreshNotificationStatus,useNotificationStatus} from "./notification-status";
export function NotificationInboxStatus({visibleIds}:{visibleIds:string[]}) {
  const {unread,pending}=useNotificationStatus();
  const router=useRouter();
  const [refreshing,startTransition]=useTransition();
  const [readError,setReadError]=useState(false);
  const idsKey=JSON.stringify(visibleIds);
  useEffect(()=>{
    const ids:string[]=JSON.parse(idsKey);
    if(!ids.length)return;
    let disposed=false,done=false,busy=false;
    async function markRead(){
      if(disposed||done||busy||document.visibilityState!=="visible")return;
      busy=true;
      try{
        const response=await fetch("/api/admin/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids}),signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error("Read state unavailable");
        done=true;if(!disposed)setReadError(false);void refreshNotificationStatus();
      }catch{if(!disposed)setReadError(true);}finally{busy=false;}
    }
    void markRead();
    const timer=setInterval(()=>void markRead(),20000);
    document.addEventListener("visibilitychange",markRead);
    return()=>{disposed=true;clearInterval(timer);document.removeEventListener("visibilitychange",markRead);};
  },[idsKey]);
  return <div className="notification-inbox-status">
    <div className="notification-legend" aria-live="polite">
      <span><i className="notification-dot notification-dot-new" aria-hidden="true"/>{unread} new unread</span>
      <span><i className="notification-dot notification-dot-pending" aria-hidden="true"/>{pending} awaiting approval</span>
    </div>
    <button type="button" disabled={refreshing} onClick={()=>{void refreshNotificationStatus();startTransition(()=>router.refresh());}}>{refreshing?"Refreshing...":"Refresh notifications"}</button>
    {readError&&<small role="status">Could not mark these notifications as read. Retrying automatically.</small>}
  </div>;
}
