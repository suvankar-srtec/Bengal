import { NotificationNavLink } from "@/components/notification-nav-link";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { RegistrationUpload } from "@/components/registration-upload";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { MobileAdminNav } from "@/components/mobile-admin-nav";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

type EventRow = {
  id: number;
  title_en: string;
  event_date: Date | string;
};

function dateLabel(value: Date | string) {
  const date = value instanceof Date ? value : new Date(String(value) + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function UploadPage() {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/dashboard");

  let events: EventRow[] = [];
  try {
    events = (await getDatabase().query<EventRow>(
      "SELECT id, title_en, event_date FROM public.bbc_event_content ORDER BY event_date DESC, id DESC",
    )).rows;
  } catch {
    events = [];
  }

  return <div className="admin-dashboard-shell">
    <MobileAdminNav role="admin" />
    <aside className="admin-sidebar">
      <Link prefetch={false} className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </Link>

      <nav className="admin-nav">
        <Link prefetch={false} href="/dashboard">Dashboard</Link>
        <Link prefetch={false} href="/managers">Manager</Link>
        <Link prefetch={false} className="active" href="/upload">Upload</Link>
        <Link prefetch={false} className="mobile-scanner-nav" href="/scanner">Scanner</Link>
        <details className="admin-nav-group">
          <summary className="admin-nav-parent">Report</summary>
          <div className="admin-nav-submenu">
            <Link prefetch={false} href="/report?report=registration">Registration Report</Link>
            <Link prefetch={false} href="/report?report=event">Event Report</Link>
            <Link prefetch={false} href="/report/whatsapp">WhatsApp</Link>
          </div>
        </details>
        <NotificationNavLink />
      </nav>

      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main admin-upload-main">
      <div className="members-heading">
        <div>
          <h1>Upload</h1>
          <p>Import confirmed registrations in bulk and generate QR pass links.</p>
        </div>
      </div>

      <RegistrationUpload events={events.map((event) => ({
        id: Number(event.id),
        title: event.title_en,
        eventDate: dateLabel(event.event_date),
      }))} />
    </main>
  </div>;
}
