import { Fragment } from "react";
import { eventAboutSections, type EventContent } from "@/lib/event-content";

export function EventAbout({ event }: { event: EventContent }) {
  return <div className="event-about-sections">
    {eventAboutSections(event).map((section, index) => <Fragment key={index}>
      {section.tagline && <h2 className={`about-title${index ? " about-title-secondary" : ""}`}>{section.tagline}</h2>}
      {section.paragraph && <p className="about-copy">{section.paragraph}</p>}
    </Fragment>)}
  </div>;
}
