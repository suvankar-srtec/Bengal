import { notFound } from "next/navigation";
import { RegistrationForm } from "@/components/registration-form";
import { Icon } from "@/components/icon";
import { eventContentFromRow } from "@/lib/event-content";
import { eventIdFromPublicSlug } from "@/lib/event-public-link";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { participationPricesFromRow } from "@/lib/registration";

export const dynamic = "force-dynamic";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const eventId = eventIdFromPublicSlug(slug);
  if (!eventId) notFound();

  let row: Record<string, unknown> | undefined;
  try {
    const result = await getDatabase().query(
      "SELECT * FROM public.bbc_event_content WHERE id = $1 LIMIT 1",
      [eventId],
    );
    row = result.rows[0] as Record<string, unknown> | undefined;
  } catch {
    row = undefined;
  }

  if (!row) notFound();

  const event = eventContentFromRow(row);
  const prices = participationPricesFromRow(row);

  const [eventYear, eventMonth, eventDay] = event.eventDate.split("-").map(Number);
  const eventDate = new Date(Date.UTC(eventYear, eventMonth - 1, eventDay));
  const eventDateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(eventDate);
  const eventDayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  }).format(eventDate);

  return <>
    <a className="skip-link" href="#registration">Skip to registration</a>

    <header className="site-header public-event-header">
      <div className="header-inner">
        <div className="brand" aria-label="Bengal Business Council">
          <img className="bbc-logo bbc-logo-header" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
        </div>
      </div>
    </header>

    <main className="page-shell public-event-page">
      <div className="event-layout">
        <section className="event-info" aria-labelledby="event-title">
          <div className="eyebrow"><span /> {event.sectionLabel}</div>
          <h1 id="event-title" lang="bn">{event.titleBn}<span lang="en">{event.titleEn}</span></h1>
          <p className="event-tagline">{event.taglineLine1}<br />{event.taglineLine2}</p>

          <div className="event-date">
            <span className="date-icon"><Icon name="calendar" size={23} /></span>
            <div>
              <strong>{eventDateLabel}</strong>
              <span>{eventDayLabel} <i /> {event.organizer}</span>
            </div>
          </div>

          <div className="section-rule" />
          <h2 className="about-title">{event.aboutTitle}</h2>
          <p className="about-copy">{event.aboutParagraph1}</p>
          <p className="about-copy">{event.aboutParagraph2}</p>

          {(event.bengaliParagraph1 || event.bengaliParagraph2) && <details className="bengali-details">
            <summary><span lang="bn">বাংলায় পড়ুন</span><Icon name="chevron" size={14} /></summary>
            <div lang="bn">
              {event.bengaliParagraph1 && <p>{event.bengaliParagraph1}</p>}
              {event.bengaliParagraph2 && <p>{event.bengaliParagraph2}</p>}
            </div>
          </details>}

          <div className="impact-card">
            <div className="impact-icon"><Icon name="users" size={26} /></div>
            <div>
              <span className="impact-label">CONNECTIONS THAT CREATE IMPACT</span>
              <strong>₹2,500+ crore</strong>
              <p>in business through connections built within the Council.</p>
            </div>
            <span className="impact-decoration" aria-hidden="true">↗</span>
          </div>

          <div className="event-values">
            <span><Icon name="check" size={15} /> Meaningful connections</span>
            <span><Icon name="check" size={15} /> Shared growth</span>
          </div>
        </section>

        <section className="form-column" id="registration" aria-label="Event registration form">
          <RegistrationForm eventContentId={eventId} prices={prices} />
          <p className="form-footnote"><Icon name="lock" size={13} /> Your details are saved securely for this event.</p>
        </section>
      </div>
    </main>

    <footer className="site-footer">
      <span>© 2026 Bengal Business Council</span>
      <span>Bringing people and possibilities together.</span>
    </footer>
  </>;
}
