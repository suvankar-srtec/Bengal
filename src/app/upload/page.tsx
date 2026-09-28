import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { RegistrationUpload } from "@/components/registration-upload";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
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
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </a>

      <nav className="admin-nav">
        <a href="/dashboard">Dashboard</a>
        <a href="/members">Members</a>
        <a href="/managers">Manager</a>
        <a className="active" href="/upload">Upload</a>
        <a className="mobile-scanner-nav" href="/scanner">Scanner</a>
        <div className="admin-nav-group">
          <span className="admin-nav-parent">Report</span>
          <div className="admin-nav-submenu">
            <a href="/report?report=registration">Registration Report</a>
            <a href="/report?report=event">Event Report</a>
          </div>
        </div>
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
