import { venueMapUrl } from "./venue-map";

function formatEventDate(value?: string | null) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatEventTime(value?: string | null) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return "";
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function whatsappPassMessage(input: {
  memberName: string;
  eventName: string;
  participantCount: number;
  passUrl: string;
  venue?: string | null;
  googleMapsUrl?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  eventEndTime?: string | null;
}) {
  const map = venueMapUrl(input.venue, input.googleMapsUrl);
  const date = formatEventDate(input.eventDate);
  const startTime = formatEventTime(input.eventTime);
  const endTime = formatEventTime(input.eventEndTime);
  const time = startTime && endTime
    ? `${startTime} - ${endTime}`
    : startTime || endTime;

  return [
    `Hello *${input.memberName}*,`,
    "",
    `Your registration for ${input.eventName} is confirmed.`,
    `Your ${input.participantCount} QR ${input.participantCount === 1 ? "pass is" : "passes are"} ready.`,
    "",
    "*View or download your passes here:*",
    input.passUrl,
    "",
    `*Venue:* ${input.venue?.trim() || "Venue to be announced"}`,
    ...(map ? ["Google Maps:", map] : []),
    ...(date ? [`*Date:* ${date}`] : []),
    ...(time ? [`*Time:* ${time}`] : []),
    "",
    "Please keep the QR pass ready at the venue entrance.",
    "Bengal Business Council",
  ].join("\n");
}
