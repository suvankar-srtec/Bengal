import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { EventContentEditor } from "@/components/event-content-editor";
import { DEFAULT_EVENT_CONTENT, eventContentFromRow } from "@/lib/event-content";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { PRICES, participationPricesFromRow, type ParticipationPrices } from "@/lib/registration";

export const dynamic = "force-dynamic";

export default async function CreateEventPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const eventId = Number(params.id);
  let content = DEFAULT_EVENT_CONTENT;
  let pricing: ParticipationPrices = PRICES;
  let editingId: number | undefined;

  if (Number.isInteger(eventId) && eventId > 0) {
    try {
      const result = await getDatabase().query("SELECT * FROM public.bbc_event_content WHERE id = $1", [eventId]);
      if (result.rows[0]) {
        content = eventContentFromRow(result.rows[0]);
        pricing = participationPricesFromRow(result.rows[0]);
        editingId = eventId;
      }
    } catch {
      // Defaults keep the editor usable if the database is temporarily unavailable.
    }
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

    <main className="admin-dashboard-main event-editor-page">
      <div className="event-editor-heading">
        <div>
          <span className="eyebrow">EVENT CONTENT</span>
          <h1>{editingId ? "Edit Event" : "Create Event"}</h1>
          <p>{editingId ? "Review this event’s participation fees first, then edit the event details." : "Set participation fees first, then create the event details."}</p>
        </div>
      </div>
      <EventContentEditor initial={content} initialPrices={pricing} eventId={editingId} />
    </main>
  </div>;
}
