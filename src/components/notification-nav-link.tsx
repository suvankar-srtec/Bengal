"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotificationStatus } from "./notification-status";
export function NotificationNavLink({onClick}:{onClick?:()=>void}) {
  const active=usePathname()==="/notifications";
  const {unread,pending}=useNotificationStatus();
  const description=[unread?`${unread} new unread ${unread===1?"notification":"notifications"}`:"",pending?`${pending} awaiting approval`:""].filter(Boolean).join("; ");
  return <Link prefetch={false} href="/notifications" className={`notification-nav-link${active?" active":""}`} aria-current={active?"page":undefined} aria-label={`Notification${description?`. ${description}`:""}`} onClick={onClick}>
    <span>Notification</span><span className="notification-dots" aria-hidden="true">
      {unread>0&&<span className="notification-dot notification-dot-new" title={`${unread} new unread notifications`}/>}
      {pending>0&&<span className="notification-dot notification-dot-pending" title={`${pending} awaiting approval`}/>}
    </span>
  </Link>;
}
