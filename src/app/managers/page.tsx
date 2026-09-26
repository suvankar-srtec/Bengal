import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { ManagerCreator } from "@/components/manager-creator";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

type EventRow = { id: number; title_en: string };
type ManagerRow = {
  id: string;
  user_id: string;
  event_id: number;
  event_title: string;
  created_at: Date | string;
};

function dateLabel(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function ManagersPage() {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/dashboard");

  let events: EventRow[] = [];
  let managers: ManagerRow[] = [];

  try {
    const database = getDatabase();
    const [eventResult, managerResult] = await Promise.all([
      database.query<EventRow>(`
        SELECT id, title_en
        FROM public.bbc_event_content
        ORDER BY created_at DESC, id DESC
      `),
      database.query<ManagerRow>(`
        SELECT
          m.id,
          m.user_id,
          m.event_id,
          e.title_en AS event_title,
          m.created_at
        FROM public.bbc_managers m
        JOIN public.bbc_event_content e ON e.id = m.event_id
        ORDER BY m.created_at DESC
      `),
    ]);
    events = eventResult.rows;
    managers = managerResult.rows;
  } catch {
    // Keep page available while the database is temporarily unavailable.
  }

  return <div className="admin-dashboard-shell">
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </a>
      <nav className="admin-nav">
        <a href="/dashboard">Dashboard</a>
        <a href="/members">Members</a>
        <a className="active" href="/managers">Manager</a>
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

    <main className="admin-dashboard-main managers-main">
      <div className="members-heading">
        <div>
          <h1>Manager</h1>
          <p>Create event-specific manager accounts.</p>
        </div>
        <span>{managers.length} {managers.length === 1 ? "manager" : "managers"}</span>
      </div>

      <ManagerCreator events={events.map((event) => ({ id: Number(event.id), title: event.title_en }))} />

      <section className="manager-list-card">
        <div className="manager-list-heading">
          <div>
            <h2>Assigned managers</h2>
            <p>Each account is restricted to its selected event.</p>
          </div>
        </div>

        <div className="members-table-wrap">
          <table className="members-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Event</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {managers.length ? managers.map((manager) => <tr key={manager.id}>
                <td><strong>{manager.user_id}</strong></td>
                <td>{manager.event_title}</td>
                <td>{dateLabel(manager.created_at)}</td>
              </tr>) : <tr>
                <td colSpan={3}>
                  <div className="members-empty-state">
                    <strong>No managers created yet</strong>
                    <span>Create a manager above and assign an event.</span>
                  </div>
                </td>
              </tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>;
}
