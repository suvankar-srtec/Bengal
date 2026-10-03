"use client";
import { useSyncExternalStore } from "react";
type Counts = {unread:number;pending:number};
const initial: Counts = {unread:0,pending:0};
let snapshot = initial;
const listeners = new Set<()=>void>();
let timer: ReturnType<typeof setInterval> | undefined;
let fetching = false;
let refreshAgain = false;
export async function refreshNotificationStatus() {
  if (fetching) {refreshAgain=true;return;}
  fetching=true;
  try {
    const response=await fetch("/api/admin/notifications",{cache:"no-store",signal:AbortSignal.timeout(15000)});
    if (!response.ok) return;
    const data=await response.json();
    if (!Number.isInteger(data.unread)||!Number.isInteger(data.pending)||data.unread<0||data.pending<0) return;
    if (snapshot.unread!==data.unread||snapshot.pending!==data.pending) {
      snapshot={unread:data.unread,pending:data.pending};listeners.forEach(listener=>listener());
    }
  } catch { /* Preserve the last known state during temporary connection failures. */ }
  finally {fetching=false;if(refreshAgain){refreshAgain=false;void refreshNotificationStatus();}}
}
function refreshWhenVisible() {if(document.visibilityState==="visible")void refreshNotificationStatus();}
function subscribe(listener:()=>void) {
  listeners.add(listener);
  if(listeners.size===1) {
    refreshWhenVisible();
    timer=setInterval(refreshWhenVisible,20000);
    window.addEventListener("focus",refreshWhenVisible);
    document.addEventListener("visibilitychange",refreshWhenVisible);
  }
  return ()=>{
    listeners.delete(listener);
    if(!listeners.size){clearInterval(timer);window.removeEventListener("focus",refreshWhenVisible);document.removeEventListener("visibilitychange",refreshWhenVisible);}
  };
}
export function useNotificationStatus() {return useSyncExternalStore(subscribe,()=>snapshot,()=>initial);}
