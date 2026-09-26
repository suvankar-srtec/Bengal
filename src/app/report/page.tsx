import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
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
  meal_choice: "snacks" | "lunch" | "dinner" | null;
  included_meals: ("snacks" | "lunch" | "dinner")[];
  presentation_selected: boolean;
  total_paise: number;
  payment_status: string;
  participant_names: string[];
  provided_meals: Array<{ participantNumber: number; meal: "snacks" | "lunch" | "dinner" }>;
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
  searchParams: Promise<{ eventId?: string; report?: string }>;
}) {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/");

  const params = await searchParams;
  const requestedEventId = session.role === "manager" ? session.eventId : Number(params.eventId);
  const reportType: "registration" | "event" = session.role === "manager"
    ? "event"
    : params.report === "event"
      ? "event"
      : "registration";

  let events: EventOption[] = [];
  let selectedEvent: EventOption | null = null;
  let registrations: RegistrationRow[] = [];

  try {
    const database = getDatabase();
    const eventScope = session.role === "manager" ? "WHERE id = $1" : "";
    const eventScopeParams = session.role === "manager" ? [session.eventId] : [];

    if (Number.isInteger(requestedEventId) && requestedEventId > 0) {
      const [eventResult, registrationResult] = await Promise.all([
        database.query<EventOption>(`
          SELECT id, title_en, title_bn, event_date, organizer, created_at
          FROM public.bbc_event_content
          ${eventScope}
          ORDER BY created_at DESC, id DESC
        `, eventScopeParams),
        database.query<RegistrationRow>(`
          SELECT
            id, member_name, email, phone, billing_details,
            participation_quantity, standee_quantity, meal_choice, included_meals,
            presentation_selected, total_paise, payment_status,
            participant_names,
            COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'participantNumber', redemption.participant_number,
                  'meal', redemption.meal_choice
                )
                ORDER BY redemption.participant_number, redemption.redeemed_at
              )
              FROM public.bbc_meal_redemptions redemption
              WHERE redemption.registration_id = bbc_event_registrations.id
            ), '[]'::jsonb) AS provided_meals,
            created_at
          FROM public.bbc_event_registrations
          WHERE event_id = $1
          ORDER BY created_at DESC
        `, [String(requestedEventId)]),
      ]);

      events = eventResult.rows;
      selectedEvent = events.find((event) => Number(event.id) === requestedEventId) ?? null;
      registrations = registrationResult.rows;
    } else {
      const eventResult = await database.query<EventOption>(`
        SELECT id, title_en, title_bn, event_date, organizer, created_at
        FROM public.bbc_event_content
        ${eventScope}
        ORDER BY created_at DESC, id DESC
      `, eventScopeParams);
      events = eventResult.rows;

      const selectedId = events[0]?.id ?? null;
      selectedEvent = selectedId
        ? events.find((event) => Number(event.id) === Number(selectedId)) ?? null
        : null;

      if (selectedId) {
        const registrationResult = await database.query<RegistrationRow>(`
          SELECT
            id, member_name, email, phone, billing_details,
            participation_quantity, standee_quantity, meal_choice, included_meals,
            presentation_selected, total_paise, payment_status,
            participant_names,
            COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'participantNumber', redemption.participant_number,
                  'meal', redemption.meal_choice
                )
                ORDER BY redemption.participant_number, redemption.redeemed_at
              )
              FROM public.bbc_meal_redemptions redemption
              WHERE redemption.registration_id = bbc_event_registrations.id
            ), '[]'::jsonb) AS provided_meals,
            created_at
          FROM public.bbc_event_registrations
          WHERE event_id = $1
          ORDER BY created_at DESC
        `, [String(selectedId)]);
        registrations = registrationResult.rows;
      }
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
        {session.role === "admin" && <a href="/members">Members</a>}
        {session.role === "admin" && <a href="/managers">Manager</a>}
        <a className="mobile-scanner-nav" href="/scanner">Scanner</a>
        <a className="active" href={session.role === "manager" ? `/report?eventId=${session.eventId}` : "/report"}>Report</a>
      </nav>

      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main report-main">
      <div className="report-page-heading">
        <div>
          <h1>Report</h1>
          <p>{session.role === "manager" ? "View participant and meal distribution details for your assigned event." : "Select a created event to view its complete registration report."}</p>
        </div>
        <ReportEventSelector
          events={selectorEvents}
          selectedEventId={selectedEvent ? Number(selectedEvent.id) : null}
          reportType={reportType}
        />
      </div>

      {selectedEvent ? <>
        {session.role === "admin" && <div className="report-type-tabs" role="tablist" aria-label="Report type">
          <a
            className={reportType === "registration" ? "active" : ""}
            href={`/report?eventId=${selectedEvent.id}&report=registration`}
            role="tab"
            aria-selected={reportType === "registration"}
          >
            Registration Report
          </a>
          <a
            className={reportType === "event" ? "active" : ""}
            href={`/report?eventId=${selectedEvent.id}&report=event`}
            role="tab"
            aria-selected={reportType === "event"}
          >
            Event Report
          </a>
        </div>}

        <section className="report-table-card">
          <div className="report-table-heading">
            <div>
              <h2>{reportType === "event" ? "Event Report" : "Registration Report"}</h2>
              <p>{registrations.length} record{registrations.length === 1 ? "" : "s"} for {selectedEvent.title_en}</p>
            </div>
            <details className="report-download-menu">
              <summary aria-label="Download registration report" title="Download report">
                <Icon name="download" size={17} />
              </summary>
              <div className="report-download-popover">
                <a href={`/api/report/export?eventId=${selectedEvent.id}&format=pdf&report=${reportType}`}>Download PDF</a>
                <a href={`/api/report/export?eventId=${selectedEvent.id}&format=excel&report=${reportType}`}>Download Excel</a>
              </div>
            </details>
          </div>

          {registrations.length ? <div className="report-table-scroll">
            {reportType === "event" ? <table className="report-table manager-report-table event-report-table">
              <thead>
                <tr>
                  <th className="report-date-column">Date</th>
                  <th>Primary member</th>
                  <th>Participants</th>
                  <th>WhatsApp</th>
                  <th>Meals included</th>
                  <th>Provided meal</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => {
                  const participants = registration.participant_names ?? [registration.member_name];
                  const includedMeals = registration.included_meals?.length
                    ? registration.included_meals
                    : registration.meal_choice
                      ? [registration.meal_choice]
                      : [];

                  return <tr key={registration.id}>
                    <td className="report-date-column">{dateLabel(registration.created_at)}</td>
                    <td><strong>{registration.member_name}</strong></td>
                    <td>
                      <div className="report-participant-names">
                        {participants.map((name, index) => <span key={`${registration.id}-${index}`}>{name}</span>)}
                      </div>
                    </td>
                    <td>{registration.phone}</td>
                    <td>{includedMeals.length ? includedMeals.map((meal) => meal[0].toUpperCase() + meal.slice(1)).join(", ") : "None"}</td>
                    <td>
                      <div className="report-provided-meals">
                        {participants.map((name, index) => {
                          const participantMeals = (registration.provided_meals ?? [])
                            .filter((item) => Number(item.participantNumber) === index + 1)
                            .map((item) => item.meal[0].toUpperCase() + item.meal.slice(1));

                          return <span key={`${registration.id}-provided-${index}`}>
                            <strong>{name}</strong>
                            <small>{participantMeals.length ? participantMeals.join(", ") : "Not provided"}</small>
                          </span>;
                        })}
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table> : <table className="report-table registration-report-table">
              <thead>
                <tr>
                  <th className="report-date-column">Date</th>
                  <th>Primary member</th>
                  <th>Participants</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Billing</th>
                  <th>Meals included</th>
                  <th>Standee</th>
                  <th>Presentation</th>
                  <th>Amount</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((registration) => <tr key={registration.id}>
                  <td className="report-date-column">{dateLabel(registration.created_at)}</td>
                  <td><strong>{registration.member_name}</strong></td>
                  <td>
                    <div className="report-participant-names">
                      {(registration.participant_names ?? [registration.member_name]).map((name, index) => <span key={`${registration.id}-${index}`}>{name}</span>)}
                    </div>
                  </td>
                  <td>{registration.email}</td>
                  <td>{registration.phone}</td>
                  <td>{registration.billing_details}</td>
                  <td>{registration.included_meals?.length ? registration.included_meals.map((meal) => meal[0].toUpperCase() + meal.slice(1)).join(", ") : registration.meal_choice ? registration.meal_choice[0].toUpperCase() + registration.meal_choice.slice(1) : "None"}</td>
                  <td>{registration.standee_quantity}</td>
                  <td>{registration.presentation_selected ? "Yes" : "No"}</td>
                  <td>{money(registration.total_paise)}</td>
                  <td><span className={`report-payment-status ${registration.payment_status}`}>{registration.payment_status}</span></td>
                </tr>)}
              </tbody>
            </table>}
          </div> : <div className="report-empty-state">No registrations have been recorded for this event yet.</div>}
        </section>
      </> : <div className="report-empty-state">Create an event first to view event reports.</div>}
    </main>
  </div>;
}
