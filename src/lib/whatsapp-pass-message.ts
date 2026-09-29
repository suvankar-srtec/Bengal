import { venueMapUrl } from "./venue-map";

export function whatsappPassMessage(input: {
  memberName: string;
  eventName: string;
  participantCount: number;
  passUrl: string;
  venue?: string | null;
  googleMapsUrl?: string | null;
}) {
  const map = venueMapUrl(input.venue, input.googleMapsUrl);
  return [
    `Hello ${input.memberName},`,
    "",
    `Your registration for ${input.eventName} is confirmed.`,
    `Your ${input.participantCount} QR ${input.participantCount === 1 ? "pass is" : "passes are"} ready.`,
    "",
    "View or download your passes here:",
    input.passUrl,
    "",
    `Venue: ${input.venue?.trim() || "Venue to be announced"}`,
    ...(map ? ["Google Maps:", map] : []),
    "",
    "Please keep the QR pass ready at the venue entrance.",
    "Bengal Business Council",
  ].join("\n");
}
