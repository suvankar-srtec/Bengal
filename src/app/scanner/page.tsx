import { NotificationNavLink } from "@/components/notification-nav-link";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { ManagerQrScanner } from "@/components/manager-qr-scanner";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { MobileAdminNav } from "@/components/mobile-admin-nav";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  return <div className="admin-dashboard-shell">
    <MobileAdminNav role={session.role} eventId={session.role === "manager" ? session.eventId : undefined} />
    <aside className="admin-sidebar">
      <Link prefetch={false} className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </Link>
      <nav className="admin-nav">
        <Link prefetch={false} href="/dashboard">Dashboard</Link>
        {session.role === "admin" && <Link prefetch={false} href="/managers">Manager</Link>}
        {session.role === "admin" && <Link prefetch={false} href="/upload">Upload</Link>}
        <Link prefetch={false} className="active mobile-scanner-nav" href="/scanner">Scanner</Link>
        {session.role === "admin" ? <details className="admin-nav-group">
          <summary className="admin-nav-parent">Report</summary>
          <div className="admin-nav-submenu">
            <Link prefetch={false} href="/report?report=registration">Registration Report</Link>
            <Link prefetch={false} href="/report?report=event">Event Report</Link>
            <Link prefetch={false} href="/report/whatsapp">WhatsApp</Link>
          </div>
        </details> : <Link prefetch={false} href={`/report?eventId=${session.eventId}`}>Report</Link>}
        {session.role === "admin" && <NotificationNavLink />}
      </nav>
      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main scanner-main">
      <div className="members-heading">
        <div>
          <h1>Scanner</h1>
          <p>Scan QR passes and verify participant access.</p>
        </div>
      </div>
      <div className="scanner-desktop-note">QR camera scanning is available on mobile view.</div>
      <div className="scanner-mobile-only"><ManagerQrScanner /></div>
    </main>
  </div>;
}
