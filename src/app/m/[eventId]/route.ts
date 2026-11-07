import { getDatabase } from "@/lib/db";
import { venueMapUrl } from "@/lib/venue-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const headers = { "Cache-Control": "no-store" };
  if (!/^[1-9]\d*$/.test(eventId) || !Number.isSafeInteger(Number(eventId))) {
    return new Response("Venue not found.", { status: 404, headers });
  }
  try {
    const event = (await getDatabase().query<{ venue: string | null; google_maps_url: string | null }>(
      "SELECT venue, google_maps_url FROM public.bbc_event_content WHERE id = $1", [Number(eventId)],
    )).rows[0];
    const destination = event && venueMapUrl(event.venue, event.google_maps_url);
    if (!destination) return new Response("Venue not found.", { status: 404, headers });
    // Keep saved place IDs, coordinates, and share links intact; never truncate the address.
    return new Response(null, { status: 307, headers: { ...headers, Location: destination } });
  } catch {
    return new Response("The venue map is temporarily unavailable. Please try again.", { status: 503, headers });
  }
}
