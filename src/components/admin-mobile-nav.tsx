"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

export function AdminMobileNav({
  role,
  eventId,
}: {
  role: "admin" | "manager";
  eventId?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const reportType = searchParams.get("report") === "event" ? "event" : "registration";

  function active(path: string) {
    return pathname === path;
  }

  return <>
    <div className="admin-mobile-topbar">
      <Link href="/dashboard" className="admin-mobile-brand" aria-label="Bengal Business Council">
        <img src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </Link>
      <span className="admin-mobile-role">{role === "admin" ? "ADMIN" : "MANAGER"}</span>
      <button
        type="button"
        className="admin-mobile-menu-trigger"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
    </div>

    {open && <div className="admin-mobile-nav-layer">
      <button
        type="button"
        className="admin-mobile-nav-backdrop"
        aria-label="Close navigation menu"
        onClick={() => setOpen(false)}
      />
      <aside className="admin-mobile-drawer" aria-label="Mobile navigation">
        <div className="admin-mobile-drawer-head">
          <img src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation menu">×</button>
        </div>

        <nav className="admin-mobile-nav-links">
          <Link className={active("/dashboard") ? "active" : ""} href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>

          {role === "admin" && <>
            <Link className={active("/managers") ? "active" : ""} href="/managers" onClick={() => setOpen(false)}>Manager</Link>
            <Link className={active("/upload") ? "active" : ""} href="/upload" onClick={() => setOpen(false)}>Upload</Link>
          </>}

          <Link className={active("/scanner") ? "active" : ""} href="/scanner" onClick={() => setOpen(false)}>Scanner</Link>

          {role === "admin" ? <details className="admin-mobile-report-group">
            <summary>Report</summary>
            <Link
              className={pathname === "/report" && reportType === "registration" ? "active" : ""}
              href="/report?report=registration"
              onClick={() => setOpen(false)}
            >
              Registration Report
            </Link>
            <Link
              className={pathname === "/report" && reportType === "event" ? "active" : ""}
              href="/report?report=event"
              onClick={() => setOpen(false)}
            >
              Event Report
            </Link>
            <Link prefetch={false} className={active("/report/whatsapp") ? "active" : ""} href="/report/whatsapp" onClick={() => setOpen(false)}>WhatsApp</Link>
          </details> : <Link
            className={active("/report") ? "active" : ""}
            href={eventId ? `/report?eventId=${eventId}` : "/report"}
            onClick={() => setOpen(false)}
          >
            Report
          </Link>}
        </nav>

        <div className="admin-mobile-drawer-footer">
          <AdminLogoutButton />
        </div>
      </aside>
    </div>}
  </>;
}
