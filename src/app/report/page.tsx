import { ReportParticipants } from "@/components/report-participants";
import { NotificationNavLink } from "@/components/notification-nav-link";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { ReportEventSelector } from "@/components/report-event-selector";
import { ReportAutoSearch } from "@/components/report-auto-search";
import { Icon } from "@/components/icon";
import { getDatabase } from "@/lib/db";
import { mealChoiceLabel, type ParticipantContact } from "@/lib/registration";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { MobileAdminNav } from "@/components/mobile-admin-nav";
import { ManagerWhatsAppSend } from "@/components/manager-whatsapp-send";
import { ManagerPhoneEditor } from "@/components/manager-phone-editor";

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
  additional_participant_contacts: ParticipantContact[];
  provided_meals: Array<{ participantNumber: number; meal: "snacks" | "lunch" | "dinner"; redeemedAt: string }>;
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

function mealTimeLabel(value?: string | Date) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
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

    const selectedId = Number.isInteger(requestedEventId) && requestedEventId > 0 ? requestedEventId : null;
    // Resolve the default event inside SQL so both requests can run concurrently.
    const [eventResult, registrationResult] = await Promise.all([
      database.query<EventOption>(`
        SELECT id, title_en, title_bn, event_date, organizer, created_at
        FROM public.bbc_event_content
        ${eventScope}
        ORDER BY created_at DESC, id DESC
      `, eventScopeParams),
      database.query<RegistrationRow>(`
        SELECT id, member_name, email, phone, billing_details,
          participation_quantity, standee_quantity, meal_choice, included_meals,
          presentation_selected, total_paise, payment_status, participant_names, additional_participant_contacts,
          ${reportType === "event" ? `COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'participantNumber', redemption.participant_number,
              'meal', redemption.meal_choice,
              'redeemedAt', redemption.redeemed_at
            ) ORDER BY redemption.participant_number, redemption.redeemed_at)
            FROM public.bbc_meal_redemptions redemption
            WHERE redemption.registration_id = bbc_event_registrations.id
          ), '[]'::jsonb)` : "'[]'::jsonb"} AS provided_meals,
          created_at
        FROM public.bbc_event_registrations
        WHERE event_id = COALESCE($1::text, (
          SELECT id::text FROM public.bbc_event_content ORDER BY created_at DESC, id DESC LIMIT 1
        ))
        ${reportType === "registration" ? "AND admin_import_key IS NULL" : ""}
        ORDER BY created_at DESC
      `, [selectedId === null ? null : String(selectedId)]),
    ]);
    events = eventResult.rows;
    selectedEvent = selectedId === null ? events[0] ?? null : events.find((event) => Number(event.id) === selectedId) ?? null;
    registrations = selectedEvent ? registrationResult.rows : [];
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
    <MobileAdminNav role={session.role} eventId={session.role === "manager" ? session.eventId : undefined} />
    <aside className="admin-sidebar">
      <Link prefetch={false} className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </Link>

      <nav className="admin-nav">
        <Link prefetch={false} href="/dashboard">Dashboard</Link>
        {session.role === "admin" && <Link prefetch={false} href="/managers">Manager</Link>}
        {session.role === "admin" && <Link prefetch={false} href="/upload">Upload</Link>}
        <Link prefetch={false} className="mobile-scanner-nav" href="/scanner">Scanner</Link>
        {session.role === "admin" ? <details className="admin-nav-group">
          <summary className="admin-nav-parent active">Report</summary>
          <div className="admin-nav-submenu">
            <Link prefetch={false} aria-current={reportType === "registration" ? "page" : undefined} className={reportType === "registration" ? "active" : ""} href={selectedEvent ? `/report?eventId=${selectedEvent.id}&report=registration` : "/report?report=registration"}>Registration Report</Link>
            <Link prefetch={false} aria-current={reportType === "event" ? "page" : undefined} className={reportType === "event" ? "active" : ""} href={selectedEvent ? `/report?eventId=${selectedEvent.id}&report=event` : "/report?report=event"}>Event Report</Link>
            <Link prefetch={false} href="/report/whatsapp">WhatsApp</Link>
          </div>
        </details> : <Link prefetch={false} className="active" href={`/report?eventId=${session.eventId}`}>Report</Link>}
        {session.role === "admin" && <NotificationNavLink />}
      </nav>

      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main report-main">
      <div className="report-page-heading">
        <div>
          <h1>Report</h1>
          <p>{session.role === "manager" ? "View participant and meal distribution details for your assigned event." : reportType === "registration" ? "View registrations submitted through the form. New submissions are marked Unpaid." : "Select an event to view participant and meal distribution details."}</p>
        </div>
        <ReportEventSelector
          events={selectorEvents}
          selectedEventId={selectedEvent ? Number(selectedEvent.id) : null}
          reportType={reportType}
        />
      </div>

      {selectedEvent ? <>

        <section className="report-table-card">
          <div className="report-table-heading">
            <div>
              <h2>{reportType === "event" ? "Event Report" : "Registration Report"}</h2>
              <p>{registrations.length} record{registrations.length === 1 ? "" : "s"} for {selectedEvent.title_en}</p>
            </div>
            <div className="report-heading-actions">
              <ReportAutoSearch reportKey={`${selectedEvent.id}-${reportType}`} />
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
          </div>

          {registrations.length ? <div className="report-table-scroll">
            {reportType === "event" ? <table className={`report-table manager-report-table event-report-table${session.role === "manager" ? " manager-event-report-table" : ""}`}>
              <thead>
                <tr>
                  <th className="report-date-column">Date</th>
                  <th>Primary member</th>
                  <th>Participants</th>
                  <th>WhatsApp</th>
                  {session.role === "manager" && <th>Action</th>}
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

                  const searchText = [
                    dateLabel(registration.created_at),
                    registration.member_name,
                    ...participants,
                    ...(registration.additional_participant_contacts ?? []).flatMap(({ email, phone }) => [email, phone]),
                    registration.phone,
                    ...includedMeals.map(mealChoiceLabel),
                    ...(registration.provided_meals ?? []).map((item) => mealChoiceLabel(item.meal)),
                  ].join(" ");

                  return <tr key={registration.id} data-report-row data-report-search={searchText}>
                    <td className="report-date-column" data-label="Date">{dateLabel(registration.created_at)}</td>
                    <td data-label="Primary member"><strong>{registration.member_name}</strong></td>
                    <td data-label="Participants">
                      <ReportParticipants names={participants} contacts={registration.additional_participant_contacts ?? []} />
                    </td>
                    <td data-label="WhatsApp">
                      {session.role === "manager"
                        ? <ManagerPhoneEditor registrationId={registration.id} phone={registration.phone} />
                        : registration.phone}
                    </td>
                    {session.role === "manager" && <td data-label="Action"><ManagerWhatsAppSend registrationId={registration.id} /></td>}
                    <td data-label="Meals included">{includedMeals.length ? includedMeals.map(mealChoiceLabel).join(", ") : "None"}</td>
                    <td data-label="Provided meal">
                      <div className="report-provided-meals">
                        {participants.map((name, index) => {
                          const participantMeals = (registration.provided_meals ?? [])
                            .filter((item) => Number(item.participantNumber) === index + 1)
                            .map((item) => {
                              const scanTime = mealTimeLabel(item.redeemedAt);
                              return scanTime
                                ? `${mealChoiceLabel(item.meal)} · ${scanTime}`
                                : mealChoiceLabel(item.meal);
                            });

                          return <span key={`${registration.id}-provided-${index}`}>
                            <strong>{name}</strong>
                            <small className={participantMeals.length ? "provided" : ""}>
                              {participantMeals.length ? participantMeals.join(", ") : "Not provided"}
                            </small>
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
                {registrations.map((registration) => <tr
                  key={registration.id}
                  data-report-row
                  data-report-search={[
                    dateLabel(registration.created_at),
                    registration.member_name,
                    ...(registration.participant_names ?? [registration.member_name]),
                    ...(registration.additional_participant_contacts ?? []).flatMap(({ email, phone }) => [email, phone]),
                    registration.email,
                    registration.phone,
                    registration.billing_details,
                    ...(registration.included_meals?.length ? registration.included_meals : registration.meal_choice ? [registration.meal_choice] : []).map(mealChoiceLabel),
                    registration.payment_status,
                    money(registration.total_paise),
                  ].join(" ")}
                >
                  <td className="report-date-column" data-label="Date">{dateLabel(registration.created_at)}</td>
                  <td data-label="Primary member"><strong>{registration.member_name}</strong></td>
                  <td data-label="Participants">
                    <ReportParticipants names={registration.participant_names ?? [registration.member_name]} contacts={registration.additional_participant_contacts ?? []} />
                  </td>
                  <td data-label="Email">{registration.email}</td>
                  <td data-label="WhatsApp">{registration.phone}</td>
                  <td data-label="Billing">{registration.billing_details}</td>
                  <td data-label="Meals included">{registration.included_meals?.length ? registration.included_meals.map(mealChoiceLabel).join(", ") : registration.meal_choice ? mealChoiceLabel(registration.meal_choice) : "None"}</td>
                  <td data-label="Standee">{registration.standee_quantity}</td>
                  <td data-label="Presentation">{registration.presentation_selected ? "Yes" : "No"}</td>
                  <td data-label="Amount">{money(registration.total_paise)}</td>
                  <td data-label="Payment"><span className={`report-payment-status ${registration.payment_status}`}>{registration.payment_status}</span></td>
                </tr>)}
              </tbody>
            </table>}
            <div className="report-search-empty" data-report-search-empty hidden>No matching records found.</div>
          </div> : <div className="report-empty-state">{reportType === "registration" ? "No form submissions have been recorded for this event yet." : "No registrations have been recorded for this event yet."}</div>}
        </section>
      </> : <div className="report-empty-state">Create an event first to view event reports.</div>}
    </main>
  </div>;
}
