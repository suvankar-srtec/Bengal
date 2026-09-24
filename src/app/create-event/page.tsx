import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { EventContentEditor } from "@/components/event-content-editor";
import { DEFAULT_EVENT_CONTENT, eventContentFromRow } from "@/lib/event-content";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

export const dynamic = "force-dynamic";

export default async function CreateEventPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const store = await cookies();
  if (!validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/");

  const params = await searchParams;
  const eventId = Number(params.id);
  let content = DEFAULT_EVENT_CONTENT;
  let editingId: number | undefined;

  if (Number.isInteger(eventId) && eventId > 0) {
    try {
      const result = await getDatabase().query("SELECT * FROM public.bbc_event_content WHERE id = $1", [eventId]);
      if (result.rows[0]) {
        content = eventContentFromRow(result.rows[0]);
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
        <a className="active" href="/create-event">Create Event</a>
        <a href="/register">Event registration</a>
      </nav>
      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main event-editor-page">
      <div className="event-editor-heading">
        <div>
          <span className="eyebrow">EVENT CONTENT</span>
          <h1>{editingId ? "Edit Event" : "Create Event"}</h1>
          <p>These fields control only the left side of the registration page. The registration form remains fixed.</p>
        </div>
      </div>
      <EventContentEditor initial={content} eventId={editingId} />
    </main>
  </div>;
}
