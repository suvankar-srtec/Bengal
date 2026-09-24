import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const store = await cookies();
  if (!validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/");

  let totals = { registrations: 0, paid: 0, participants: 0, revenue: 0 };

  try {
    const result = await getDatabase().query<{
      registrations: string;
      paid: string;
      participants: string;
      revenue: string;
    }>(`
      SELECT
        COUNT(*)::text AS registrations,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::text AS paid,
        COALESCE(SUM(participation_quantity), 0)::text AS participants,
        COALESCE(SUM(total_paise) FILTER (WHERE payment_status = 'paid'), 0)::text AS revenue
      FROM public.bbc_event_registrations
    `);

    const row = result.rows[0];
    totals = {
      registrations: Number(row?.registrations ?? 0),
      paid: Number(row?.paid ?? 0),
      participants: Number(row?.participants ?? 0),
      revenue: Number(row?.revenue ?? 0),
    };
  } catch {
    // Keep report page available if the database is temporarily unavailable.
  }

  const revenue = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(totals.revenue / 100);

  return <div className="admin-dashboard-shell">
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </a>

      <nav className="admin-nav">
        <a href="/dashboard">Dashboard</a>
        <a className="active" href="/report">Report</a>
      </nav>

      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main">
      <div className="report-page-heading">
        <h1>Report</h1>
      </div>

      <section className="admin-stat-grid" aria-label="Report summary">
        <article><span>Total registrations</span><strong>{totals.registrations}</strong><small>Saved registrations</small></article>
        <article><span>Paid registrations</span><strong>{totals.paid}</strong><small>Completed payments</small></article>
        <article><span>Total participants</span><strong>{totals.participants}</strong><small>Individual attendees</small></article>
        <article><span>Paid value</span><strong>{revenue}</strong><small>Successful payment value</small></article>
      </section>
    </main>
  </div>;
}
