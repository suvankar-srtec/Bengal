import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { MobileAdminNav } from "@/components/mobile-admin-nav";

export const dynamic = "force-dynamic";

const statuses = {
  accepted: "Sent to provider",
  pending: "Queued",
  sending: "Sending",
  failed: "Failed",
  unknown: "Unconfirmed",
  manual: "Not sent",
} as const;
type Status = keyof typeof statuses;
type Delivery = {
  registration_id: string;
  member_name: string;
  reference: string;
  phone: string;
  event_name: string;
  status: Status;
  attempts: number;
  updated_at: Date | string;
  accepted_at: Date | string | null;
  error_code: string | null;
};
const PAGE_SIZE = 50;

function dateTime(value: Date | string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  }).format(date);
}

export default async function WhatsAppReportPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const status = typeof params.status === "string" && Object.hasOwn(statuses, params.status) ? params.status : "";
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  let deliveries: Delivery[] = [];
  let failed = false;
  try {
    deliveries = (await getDatabase().query<Delivery>(`
      SELECT d.registration_id, r.member_name, r.reference, r.phone, r.event_name,
        d.status, d.attempts, d.updated_at, d.accepted_at, d.error_code
      FROM public.bbc_whatsapp_pass_deliveries d
      JOIN public.bbc_event_registrations r ON r.id = d.registration_id
      WHERE ($1::text = '' OR strpos(lower(concat_ws(' ', r.member_name, r.reference, r.phone, r.event_name)), lower($1)) > 0)
        AND ($2::text = '' OR d.status = $2)
      ORDER BY d.updated_at DESC, d.registration_id DESC
      LIMIT $3 OFFSET $4
    `, [query, status, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE])).rows;
  } catch {
    failed = true;
  }
  const hasNext = deliveries.length > PAGE_SIZE;
  const rows = deliveries.slice(0, PAGE_SIZE);
  function pageHref(nextPage: number) {
    const values = new URLSearchParams();
    if (query) values.set("q", query);
    if (status) values.set("status", status);
    values.set("page", String(nextPage));
    return `/report/whatsapp?${values}`;
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
        <Link prefetch={false} href="/upload">Upload</Link>
        <Link prefetch={false} className="mobile-scanner-nav" href="/scanner">Scanner</Link>
        <div className="admin-nav-group">
          <span className="admin-nav-parent active">Report</span>
          <div className="admin-nav-submenu">
            <Link prefetch={false} href="/report?report=registration">Registration Report</Link>
            <Link prefetch={false} href="/report?report=event">Event Report</Link>
            <Link prefetch={false} className="active" aria-current="page" href="/report/whatsapp">WhatsApp</Link>
          </div>
        </div>
      </nav>
      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>
    <main className="admin-dashboard-main whatsapp-history-main">
      <div className="members-heading">
        <div><h1>WhatsApp</h1><p>Pass send history and the latest status for each registration.</p></div>
      </div>
      <form className="whatsapp-history-filters" action="/report/whatsapp" method="get">
        <label htmlFor="whatsapp-search">Search history
          <input id="whatsapp-search" name="q" type="search" defaultValue={query} maxLength={120} placeholder="Member, WhatsApp number, event or reference" />
        </label>
        <label htmlFor="whatsapp-status">Status
          <select id="whatsapp-status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="submit">Search</button>
        <Link prefetch={false} href="/report/whatsapp">Reset</Link>
      </form>
      <section className="report-table-card">
        <div className="report-table-heading"><div>
          <h2>WhatsApp send history</h2>
        </div></div>
        {failed ? <div className="report-empty-state" role="alert">Could not load WhatsApp history. Please refresh to try again.</div>
          : rows.length === 0 ? <div className="report-empty-state">{query || status || page > 1 ? "No WhatsApp records match these filters or page." : "No WhatsApp pass history yet."}</div>
          : <div className="whatsapp-history-scroll"><table className="whatsapp-history-table">
            <thead><tr>
              <th scope="col">Member / reference</th><th scope="col">WhatsApp number</th><th scope="col">Event</th>
              <th scope="col">Status</th><th scope="col">Attempts</th><th scope="col">Sent to provider at</th><th scope="col">Last updated</th>
            </tr></thead>
            <tbody>{rows.map((row) => <tr key={row.registration_id}>
              <td><strong>{row.member_name}</strong><small>{row.reference}</small></td>
              <td>{row.phone.startsWith("+") ? row.phone : row.phone.length === 10 ? `+91${row.phone}` : `+${row.phone}`}</td>
              <td>{row.event_name}</td>
              <td><span className={`whatsapp-history-status ${row.status}`}>{statuses[row.status] ?? row.status}</span>{row.error_code && <small>{row.error_code.replaceAll("_", " ")}</small>}</td>
              <td>{row.attempts}</td><td>{dateTime(row.accepted_at)}</td><td>{dateTime(row.updated_at)}</td>
            </tr>)}</tbody>
          </table></div>}
        {!failed && <nav className="whatsapp-history-pagination" aria-label="WhatsApp history pages">
          <span>Page {page}{rows.length ? ` - ${rows.length} records` : ""}</span>
          {page > 1 && <Link prefetch={false} href={pageHref(page - 1)}>Previous</Link>}
          {hasNext && <Link prefetch={false} href={pageHref(page + 1)}>Next</Link>}
        </nav>}
      </section>
    </main>
  </div>;
}
