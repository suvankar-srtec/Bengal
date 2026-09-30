import { venueMapEmbedUrl } from "@/lib/venue-map";
import { Icon } from "./icon";

export function EventVenue({ venue, googleMapsUrl, dateLabel, timeLabel }: { venue?: string | null; googleMapsUrl?: string | null; dateLabel?: string; timeLabel?: string }) {
  const mapUrl = venueMapEmbedUrl(venue, googleMapsUrl);
  const address = venue?.trim() || "Venue to be announced";
  return <section className="event-venue-details" aria-label="Venue and event schedule">
    <div className="event-venue-content">
      <div className="event-venue-heading">
        <span className="event-venue-pin"><Icon name="pin" size={22} /></span>
        <div><span className="event-venue-eyebrow">Venue</span><p className="event-venue-address">{address}</p></div>
      </div>
      {(dateLabel || timeLabel) && <dl className="event-venue-schedule">
        {dateLabel && <div className="event-venue-date"><dt><Icon name="calendar" size={16} /> Event date</dt><dd>{dateLabel}</dd></div>}
        {timeLabel && <div className="event-venue-time"><dt><Icon name="clock" size={16} /> Event time</dt><dd>{timeLabel}</dd></div>}
      </dl>}
    </div>
    {mapUrl && <div className="event-venue-map"><iframe title={`Google Maps location: ${address}`} src={mapUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>}
  </section>;
}
