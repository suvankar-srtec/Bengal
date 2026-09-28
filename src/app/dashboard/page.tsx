import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { MobileAdminNav } from "@/components/mobile-admin-nav";
import { DashboardEventCard } from "@/components/dashboard-event-card";

export const dynamic = "force-dynamic";

type EventSummary = {
  id: number;
  title: string;
  eventDate: string;
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
      event_date: string;
      created_at: Date | string;
      registrations: string;
      participants: string;
      revenue: string;
    }>(`
      SELECT
        e.id,
        e.title_en,
        e.event_date::text AS event_date,
        e.created_at,
        COUNT(r.id)::text AS registrations,
        COALESCE(SUM(r.participation_quantity), 0)::text AS participants,
        COALESCE(SUM(COALESCE(r.amount_paid_paise, r.total_paise)) FILTER (WHERE r.payment_status = 'paid'), 0)::text AS revenue
      FROM public.bbc_event_content e
      LEFT JOIN public.bbc_event_registrations r ON r.event_id = e.id::text
      ${scope}
      GROUP BY e.id, e.title_en, e.event_date, e.created_at
      ORDER BY e.created_at DESC, e.id DESC
    `, params);

    events = result.rows.map((event) => {
      const eventDate = new Date(`${event.event_date}T12:00:00Z`);
      return {
        id: Number(event.id),
        title: event.title_en,
        eventDate: Number.isNaN(eventDate.getTime())
          ? event.event_date
          : new Intl.DateTimeFormat("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            }).format(eventDate),
        registrations: Number(event.registrations ?? 0),
        participants: Number(event.participants ?? 0),
        revenue: Number(event.revenue ?? 0),
      };
    });
  } catch {
    // Dashboard remains usable even if the database is temporarily unavailable.
  }

  return <div className="admin-dashboard-shell">
    <MobileAdminNav role={session.role} eventId={session.role === "manager" ? session.eventId : undefined} />
    <aside className="admin-sidebar">
      <Link prefetch={false} className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </Link>
      <nav className="admin-nav">
        <Link prefetch={false} className="active" href="/dashboard">Dashboard</Link>
                {session.role === "admin" && <Link prefetch={false} href="/managers">Manager</Link>}
        {session.role === "admin" && <Link prefetch={false} href="/upload">Upload</Link>}
        <Link prefetch={false} className="mobile-scanner-nav" href="/scanner">Scanner</Link>
        {session.role === "admin" ? <div className="admin-nav-group">
          <span className="admin-nav-parent">Report</span>
          <div className="admin-nav-submenu">
            <Link prefetch={false} href="/report?report=registration">Registration Report</Link>
            <Link prefetch={false} href="/report?report=event">Event Report</Link>
          </div>
        </div> : <Link prefetch={false} href={`/report?eventId=${session.eventId}`}>Report</Link>}
      </nav>
      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main">
      {session.role === "manager" && <div className="manager-dashboard-heading">
        <span className="eyebrow">MANAGER ACCESS</span>
        <h1>Assigned event</h1>
        <p>You can view only the event assigned to your manager account.</p>
        <Link prefetch={false} className="manager-mobile-scan-button" href="/scanner">Scan QR pass</Link>
      </div>}

      <section className="dashboard-events-grid" aria-label="Events">
        {events.map((event) => <DashboardEventCard
          key={event.id}
          id={event.id}
          title={event.title}
          eventDate={event.eventDate}
          registrations={event.registrations}
          participants={event.participants}
          revenue={event.revenue}
          canManage={session.role === "admin"}
        />)}

        {session.role === "admin" && <Link prefetch={false} className="dashboard-create-event-card" href="/create-event" aria-label="Create event">
          <span className="dashboard-create-event-plus" aria-hidden="true">+</span>
          <strong>Create Event</strong>
        </Link>}
      </section>
    </main>
  </div>;
}
