import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { EventContentEditor } from "@/components/event-content-editor";
import { DEFAULT_EVENT_CONTENT, eventContentFromRow } from "@/lib/event-content";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CreateEventPage() {
  const store = await cookies();
  if (!validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/");

  let content = DEFAULT_EVENT_CONTENT;
  try {
    const result = await getDatabase().query("SELECT * FROM public.bbc_event_content WHERE id = 1");
    content = eventContentFromRow(result.rows[0]);
  } catch {
    // Defaults keep the editor usable if the database is temporarily unavailable.
  }

  return <div className="admin-dashboard-shell">
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/dashboard">
        <span className="brand-mark" aria-hidden="true">b<span>.</span></span>
        <span className="brand-name">BENGAL<span>BUSINESS COUNCIL</span></span>
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
          <h1>Create / Edit Event</h1>
          <p>These fields control only the left side of the registration page. The registration form remains fixed.</p>
        </div>
      </div>
      <EventContentEditor initial={content} />
    </main>
  </div>;
}
