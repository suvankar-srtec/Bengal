"use client";

import Link from "next/link";
import { NotificationNavLink } from "./notification-nav-link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

export function MobileAdminNav({
  role,
  eventId,
}: {
  role: "admin" | "manager";
  eventId?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href: string) => pathname === href ? "active" : "";

  return <div className="mobile-admin-bar">
    <div className="mobile-admin-bar-inner">
      <Link className="mobile-admin-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </Link>
      <button
        type="button"
        className="mobile-admin-menu-button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>
    </div>

    {open && <div className="mobile-admin-menu">
      <nav>
        <Link className={linkClass("/dashboard")} href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
        {role === "admin" && <Link className={linkClass("/managers")} href="/managers" onClick={() => setOpen(false)}>Manager</Link>}
        {role === "admin" && <Link className={linkClass("/upload")} href="/upload" onClick={() => setOpen(false)}>Upload</Link>}
        {role === "manager" && <Link className={linkClass("/scanner")} href="/scanner" onClick={() => setOpen(false)}>Scanner</Link>}
        {role === "admin" ? <details className="mobile-report-menu">
          <summary className="mobile-admin-menu-label">Report</summary>
          <Link href="/report?report=registration" onClick={() => setOpen(false)}>Registration Report</Link>
          <Link href="/report?report=event" onClick={() => setOpen(false)}>Event Report</Link>
          <Link prefetch={false} className={linkClass("/report/whatsapp")} href="/report/whatsapp" onClick={() => setOpen(false)}>WhatsApp</Link>
        </details> : <Link href={eventId ? `/report?eventId=${eventId}` : "/report"} onClick={() => setOpen(false)}>Report</Link>}
        {role === "admin" && <NotificationNavLink onClick={() => setOpen(false)} />}
      </nav>
      <div className="mobile-admin-menu-footer">
        <AdminLogoutButton />
      </div>
    </div>}
  </div>;
}
