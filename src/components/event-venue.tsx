import { venueMapUrl } from "@/lib/venue-map";

export function EventVenue({ venue, googleMapsUrl }: { venue?: string | null; googleMapsUrl?: string | null }) {
  const mapUrl = venueMapUrl(venue, googleMapsUrl);
  return <div className="event-venue-details">
    <strong>Venue</strong>
    <p>{venue || "Venue to be announced"}</p>
    {mapUrl && <a className="venue-map-link" href={mapUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>}
  </div>;
}
