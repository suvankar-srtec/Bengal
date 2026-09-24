import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegistrationForm } from "@/components/registration-form";
import { Icon } from "@/components/icon";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { DEFAULT_EVENT_CONTENT, eventContentFromRow } from "@/lib/event-content";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const store = await cookies();
  if (!validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/");

  const params = await searchParams;
  const requestedEventId = Number(params.id);

  let event = DEFAULT_EVENT_CONTENT;
  let activeEventId: number | null = null;
  try {
    const result = Number.isInteger(requestedEventId) && requestedEventId > 0
      ? await getDatabase().query("SELECT * FROM public.bbc_event_content WHERE id = $1", [requestedEventId])
      : await getDatabase().query("SELECT * FROM public.bbc_event_content ORDER BY created_at DESC, id DESC LIMIT 1");
    event = eventContentFromRow(result.rows[0]);
    activeEventId = result.rows[0]?.id ? Number(result.rows[0].id) : null;
  } catch {
    // Use defaults if the editable event content cannot be loaded.
  }

  const [eventYear, eventMonth, eventDay] = event.eventDate.split("-").map(Number);
  const eventDate = new Date(Date.UTC(eventYear, eventMonth - 1, eventDay));
  const eventDateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
  }).format(eventDate);
  const eventDayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", timeZone: "UTC",
  }).format(eventDate);

  return (
    <>
      <a className="skip-link" href="#registration">Skip to registration</a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/dashboard" aria-label="Bengal Business Council dashboard">
            <img className="bbc-logo bbc-logo-header" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
          </a>
          <div className="admin-header-actions">
            <a className="dashboard-back-link" href="/dashboard">Dashboard</a>
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <main className="page-shell">
        <nav className="breadcrumb" aria-label="Breadcrumb"><a href="/dashboard">Dashboard</a><Icon name="chevron" size={13} /><span aria-current="page">Event registration</span></nav>

        <div className="event-layout">
          <section className="event-info" aria-labelledby="event-title">
            <div className="eyebrow"><span /> {event.sectionLabel}</div>
            <h1 id="event-title" lang="bn">{event.titleBn}<span lang="en">{event.titleEn}</span></h1>
            <p className="event-tagline">{event.taglineLine1}<br />{event.taglineLine2}</p>

            <div className="event-date"><span className="date-icon"><Icon name="calendar" size={23} /></span><div><strong>{eventDateLabel}</strong><span>{eventDayLabel} <i /> {event.organizer}</span></div></div>

            <div className="section-rule" />
            <h2 className="about-title">{event.aboutTitle}</h2>
            <p className="about-copy">{event.aboutParagraph1}</p>
            <p className="about-copy">{event.aboutParagraph2}</p>

            {(event.bengaliParagraph1 || event.bengaliParagraph2) && <details className="bengali-details">
              <summary><span lang="bn">বাংলায় পড়ুন</span><Icon name="chevron" size={14} /></summary>
              <div lang="bn">{event.bengaliParagraph1 && <p>{event.bengaliParagraph1}</p>}{event.bengaliParagraph2 && <p>{event.bengaliParagraph2}</p>}</div>
            </details>}

            <div className="impact-card">
              <div className="impact-icon"><Icon name="users" size={26} /></div>
              <div><span className="impact-label">CONNECTIONS THAT CREATE IMPACT</span><strong>₹2,500+ crore</strong><p>in business through connections built within the Council.</p></div>
              <span className="impact-decoration" aria-hidden="true">↗</span>
            </div>

            <div className="event-values"><span><Icon name="check" size={15} /> Meaningful connections</span><span><Icon name="check" size={15} /> Shared growth</span></div>
          </section>

          <section className="form-column" id="registration" aria-label="Event registration form">
            <RegistrationForm eventContentId={activeEventId} />
            <p className="form-footnote"><Icon name="lock" size={13} /> Your details are saved securely for this event.</p>
          </section>
        </div>
      </main>

      <footer className="site-footer"><span>© 2026 Bengal Business Council</span><span>Bringing people and possibilities together.</span></footer>
    </>
  );
}
