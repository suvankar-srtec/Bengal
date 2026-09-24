import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { ReportEventSelector } from "@/components/report-event-selector";
import { Icon } from "@/components/icon";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

export const dynamic = "force-dynamic";

type EventOption = {
  id: number;
  title_en: string;
  title_bn: string;
  event_date: Date | string;
  organizer: string;
  created_at: Date | string;
};

type RegistrationRow = {
  id: string;
  member_name: string;
  email: string;
  phone: string;
  billing_details: string;
  participation_quantity: number;
  standee_quantity: number;
  meal_choice: "lunch" | "dinner" | null;
  presentation_selected: boolean;
  total_paise: number;
  payment_status: string;
  participant_names: string[];
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

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const store = await cookies();
  if (!validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/");

  const params = await searchParams;
  const requestedEventId = Number(params.eventId);

  let events: EventOption[] = [];
  let selectedEvent: EventOption | null = null;
  let registrations: RegistrationRow[] = [];

  try {
    const database = getDatabase();
    const eventResult = await database.query<EventOption>(`
      SELECT id, title_en, title_bn, event_date, organizer, created_at
      FROM public.bbc_event_content
      ORDER BY created_at DESC, id DESC
    `);
    events = eventResult.rows;

    const selectedId = Number.isInteger(requestedEventId) && requestedEventId > 0
      ? requestedEventId
      : events[0]?.id ?? null;

    if (selectedId) {
      selectedEvent = events.find((event) => Number(event.id) === selectedId) ?? null;

      const registrationResult = await database.query<RegistrationRow>(`
        SELECT
          id, member_name, email, phone, billing_details,
          participation_quantity, standee_quantity, meal_choice,
          presentation_selected, total_paise, payment_status,
          participant_names, created_at
        FROM public.bbc_event_registrations
        WHERE event_id = $1
        ORDER BY created_at DESC
      `, [String(selectedId)]);
      registrations = registrationResult.rows;

    }
  } catch (error) {
    console.error("Event report could not be loaded.", {
      code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
    });
  }

  const selectorEvents = events.map((event) => ({
    id: Number(event.id),
    title: event.title_en,
    eventDate: dateLabel(event.event_date),
  }));

  return <div className="admin-dashboard-shell">
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </a>

      <nav className="admin-nav">
        <a href="/dashboard">Dashboard</a>
        <a href="/pricing">Participation Pricing</a>
        <a className="active" href="/report">Report</a>
      </nav>

      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main report-main">
      <div className="report-page-heading">
        <div>
          <h1>Report</h1>
          <p>Select a created event to view its complete registration report.</p>
        </div>
        <ReportEventSelector events={selectorEvents} selectedEventId={selectedEvent ? Number(selectedEvent.id) : null} />
      </div>

      {selectedEvent ? <>
        <section className="report-table-card">
          <div className="report-table-heading">
            <div><h2>Registrations</h2><p>{registrations.length} record{registrations.length === 1 ? "" : "s"} for {selectedEvent.title_en}</p></div>
            <details className="report-download-menu">
              <summary aria-label="Download registration report" title="Download report">
                <Icon name="download" size={17} />
              </summary>
              <div className="report-download-popover">
                <a href={`/api/report/export?eventId=${selectedEvent.id}&format=pdf`}>Download PDF</a>
                <a href={`/api/report/export?eventId=${selectedEvent.id}&format=excel`}>Download Excel</a>
              </div>
            </details>
          </div>

          {registrations.length ? <div className="report-table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Primary member</th>
                  <th>Participants</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Billing</th>
                  <th>Meal</th>
                  <th>Standee</th>
                  <th>Presentation</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => <tr key={registration.id}>
                  <td><strong>{registration.member_name}</strong></td>
                  <td>
                    <div className="report-participant-names">
                      {(registration.participant_names ?? [registration.member_name]).map((name, index) => <span key={`${registration.id}-${index}`}>{name}</span>)}
                    </div>
                  </td>
                  <td>{registration.email}</td>
                  <td>{registration.phone}</td>
                  <td>{registration.billing_details}</td>
                  <td>{registration.meal_choice ? registration.meal_choice[0].toUpperCase() + registration.meal_choice.slice(1) : "None"}</td>
                  <td>{registration.standee_quantity}</td>
                  <td>{registration.presentation_selected ? "Yes" : "No"}</td>
                  <td>{money(registration.total_paise)}</td>
                  <td><span className={`report-payment-status ${registration.payment_status}`}>{registration.payment_status}</span></td>
                  <td>{dateLabel(registration.created_at)}</td>
                </tr>)}
              </tbody>
            </table>
          </div> : <div className="report-empty-state">No registrations have been recorded for this event yet.</div>}
        </section>
      </> : <div className="report-empty-state">Create an event first to view event reports.</div>}
    </main>
  </div>;
}
