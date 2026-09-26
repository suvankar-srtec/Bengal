import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { ManagerQrScanner } from "@/components/manager-qr-scanner";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  return <div className="admin-dashboard-shell">
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </a>
      <nav className="admin-nav">
        <a href="/dashboard">Dashboard</a>
        {session.role === "admin" && <a href="/members">Members</a>}
        {session.role === "admin" && <a href="/managers">Manager</a>}
        <a className="active mobile-scanner-nav" href="/scanner">Scanner</a>
        <a href={session.role === "manager" ? `/report?eventId=${session.eventId}` : "/report"}>Report</a>
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
