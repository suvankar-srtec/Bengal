import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { DashboardEventCard } from "@/components/dashboard-event-card";

export const dynamic = "force-dynamic";

type EventSummary = {
  id: number;
  title: string;
  createdAt: string;
  registrations: number;
  participants: number;
  revenue: number;
};

export default async function DashboardPage() {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  let events: EventSummary[] = [];

  try {
    const database = getDatabase();
    const params: unknown[] = [];
    let scope = "";

    if (session.role === "manager") {
      params.push(session.eventId);
      scope = "WHERE e.id = $1";
    }

    const result = await database.query<{
      id: number;
      title_en: string;
      created_at: Date | string;
      registrations: string;
      participants: string;
      revenue: string;
    }>(`
      SELECT
        e.id,
        e.title_en,
        e.created_at,
        COUNT(r.id)::text AS registrations,
        COALESCE(SUM(r.participation_quantity), 0)::text AS participants,
        COALESCE(SUM(r.total_paise) FILTER (WHERE r.payment_status = 'paid'), 0)::text AS revenue
      FROM public.bbc_event_content e
      LEFT JOIN public.bbc_event_registrations r ON r.event_id = e.id::text
      ${scope}
      GROUP BY e.id, e.title_en, e.created_at
      ORDER BY e.created_at DESC, e.id DESC
    `, params);

    events = result.rows.map((event) => {
      const created = event.created_at instanceof Date ? event.created_at : new Date(event.created_at);
      return {
        id: Number(event.id),
        title: event.title_en,
        createdAt: Number.isNaN(created.getTime())
          ? ""
          : new Intl.DateTimeFormat("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            }).format(created),
        registrations: Number(event.registrations ?? 0),
        participants: Number(event.participants ?? 0),
        revenue: Number(event.revenue ?? 0),
      };
    });
  } catch {
    // Dashboard remains usable even if the database is temporarily unavailable.
  }

  return <div className="admin-dashboard-shell">
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </a>
      <nav className="admin-nav">
        <a className="active" href="/dashboard">Dashboard</a>
        {session.role === "admin" && <a href="/members">Members</a>}
        {session.role === "admin" && <a href="/managers">Manager</a>}
        <a href={session.role === "manager" ? `/report?eventId=${session.eventId}` : "/report"}>Report</a>
      </nav>
      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main">
      {session.role === "manager" && <div className="manager-dashboard-heading">
        <span className="eyebrow">MANAGER ACCESS</span>
        <h1>Assigned event</h1>
        <p>You can view only the event assigned to your manager account.</p>
      </div>}

      <section className="dashboard-events-grid" aria-label="Events">
        {session.role === "admin" && <a className="dashboard-create-event-card" href="/create-event" aria-label="Create event">
          <span className="dashboard-create-event-plus" aria-hidden="true">+</span>
          <strong>Create Event</strong>
        </a>}

        {events.map((event) => <DashboardEventCard
          key={event.id}
          id={event.id}
          title={event.title}
          createdAt={event.createdAt}
          registrations={event.registrations}
          participants={event.participants}
          revenue={event.revenue}
          canManage={session.role === "admin"}
        />)}
      </section>
    </main>
  </div>;
}
