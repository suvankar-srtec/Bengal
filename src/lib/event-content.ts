import { z } from "zod";

export const eventContentSchema = z.object({
  titleBn: z.string().trim().min(1).max(160),
  titleEn: z.string().trim().min(1).max(160),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/),
  eventEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  organizer: z.string().trim().min(1).max(160),
  aboutTagline1: z.string().trim().min(1).max(220),
  aboutParagraph1: z.string().trim().min(1).max(1500),
  aboutTagline2: z.string().trim().max(220),
  aboutParagraph2: z.string().trim().max(1500),
});

export const createEventSchema = eventContentSchema.extend({
  participationPaise: z.number().int().min(0),
  standeePaise: z.number().int().min(0),
  presentationPaise: z.number().int().min(0),
  includedMeals: z.array(z.enum(["snacks", "lunch", "dinner"])).min(1).max(3),
  mealOption: z.enum(["snacks", "lunch", "dinner"]).optional(),
  snacksPaise: z.number().int().min(0).optional(),
  lunchPaise: z.number().int().min(0).optional(),
  dinnerPaise: z.number().int().min(0).optional(),
});

export type EventContent = z.infer<typeof eventContentSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const DEFAULT_EVENT_CONTENT: EventContent = {
  titleBn: "আলাপ আলোচনা",
  titleEn: "Aalap Alochona",
  eventDate: "2026-09-29",
  eventTime: "18:00",
  eventEndTime: "20:00",
  organizer: "Bengal Business Council",
  aboutTagline1: "Good business begins with a conversation.",
  aboutParagraph1: "Aalap Alochona is the official networking format of the Bengal Business Council. A space to go beyond introductions, exchange ideas, and build meaningful professional and personal relationships.",
  aboutTagline2: "",
  aboutParagraph2: "",
};

function normalizeEventDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value ?? "");
  const direct = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return DEFAULT_EVENT_CONTENT.eventDate;
}

function normalizeEventTime(value: unknown) {
  const text = String(value ?? "");
  const direct = text.match(/\d{2}:\d{2}/)?.[0];
  return direct ?? DEFAULT_EVENT_CONTENT.eventTime;
}

export function eventContentFromRow(row: Record<string, unknown> | undefined): EventContent {
  if (!row) return DEFAULT_EVENT_CONTENT;
  return {
    titleBn: String(row.title_bn ?? DEFAULT_EVENT_CONTENT.titleBn),
    titleEn: String(row.title_en ?? DEFAULT_EVENT_CONTENT.titleEn),
    eventDate: normalizeEventDate(row.event_date ?? DEFAULT_EVENT_CONTENT.eventDate),
    eventTime: normalizeEventTime(row.event_time ?? DEFAULT_EVENT_CONTENT.eventTime),
    eventEndTime: normalizeEventTime(row.event_end_time ?? DEFAULT_EVENT_CONTENT.eventEndTime),
    organizer: String(row.organizer ?? DEFAULT_EVENT_CONTENT.organizer),
    aboutTagline1: String(
      row.tagline_line_1 ??
      row.about_title ??
      DEFAULT_EVENT_CONTENT.aboutTagline1
    ),
    aboutParagraph1: String(row.about_paragraph_1 ?? DEFAULT_EVENT_CONTENT.aboutParagraph1),
    aboutTagline2: String(row.tagline_line_2 ?? ""),
    aboutParagraph2: String(row.about_paragraph_2 ?? ""),
  };
}
