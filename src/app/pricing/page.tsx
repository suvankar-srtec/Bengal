import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { PricingEditor } from "@/components/pricing-editor";
import { PricingEventSelector } from "@/components/pricing-event-selector";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { participationPricesFromRow, type ParticipationPrices } from "@/lib/registration";

export const dynamic = "force-dynamic";

type EventRow = {
  id: number;
  title_en: string;
  event_date: Date | string;
  participation_unit_paise: number;
  standee_unit_paise: number;
  presentation_unit_paise: number;
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

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const store = await cookies();
  if (!validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/");

  const params = await searchParams;
  const requestedEventId = Number(params.eventId);

  let events: EventRow[] = [];
  let selected: EventRow | null = null;
  let prices: ParticipationPrices | null = null;

  try {
    const result = await getDatabase().query<EventRow>(`
      SELECT
        id, title_en, event_date,
        participation_unit_paise,
        standee_unit_paise,
        presentation_unit_paise
      FROM public.bbc_event_content
      ORDER BY created_at DESC, id DESC
    `);
    events = result.rows;

    const selectedId = Number.isInteger(requestedEventId) && requestedEventId > 0
      ? requestedEventId
      : events[0]?.id ?? null;

    selected = events.find((event) => Number(event.id) === selectedId) ?? null;
    prices = selected ? participationPricesFromRow(selected as unknown as Record<string, unknown>) : null;
  } catch (error) {
    console.error("Pricing page could not load.", {
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
        <a className="active" href="/pricing">Participation Pricing</a>
        <a href="/report">Report</a>
      </nav>

      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main pricing-page">
      <div className="pricing-page-heading">
        <div>
          <h1>Participation Pricing</h1>
          <p>Manage the amounts shown under “Your participation” for each event.</p>
        </div>
        <PricingEventSelector
          events={selectorEvents}
          selectedEventId={selected ? Number(selected.id) : null}
        />
      </div>

      {selected && prices
        ? <PricingEditor eventId={Number(selected.id)} eventTitle={selected.title_en} initial={prices} />
        : <div className="report-empty-state">Create an event first to configure participation pricing.</div>}
    </main>
  </div>;
}
