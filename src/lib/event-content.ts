import { z } from "zod";

export const eventContentSchema = z.object({
  sectionLabel: z.string().trim().min(1).max(100),
  titleBn: z.string().trim().min(1).max(160),
  titleEn: z.string().trim().min(1).max(160),
  taglineLine1: z.string().trim().min(1).max(180),
  taglineLine2: z.string().trim().min(1).max(180),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  organizer: z.string().trim().min(1).max(160),
  aboutTitle: z.string().trim().min(1).max(220),
  aboutParagraph1: z.string().trim().min(1).max(1500),
  aboutParagraph2: z.string().trim().min(1).max(1500),
  bengaliParagraph1: z.string().trim().max(2000),
  bengaliParagraph2: z.string().trim().max(2000),
  impactLabel: z.string().trim().min(1).max(180),
  impactValue: z.string().trim().min(1).max(120),
  impactCopy: z.string().trim().min(1).max(500),
  value1: z.string().trim().min(1).max(120),
  value2: z.string().trim().min(1).max(120),
});

export type EventContent = z.infer<typeof eventContentSchema>;

export const DEFAULT_EVENT_CONTENT: EventContent = {
  sectionLabel: "THE CONVERSATIONS THAT CONNECT US",
  titleBn: "আলাপ আলোচনা",
  titleEn: "Aalap Alochona",
  taglineLine1: "A conversation today.",
  taglineLine2: "A collaboration tomorrow.",
  eventDate: "2026-09-29",
  organizer: "Bengal Business Council",
  aboutTitle: "Good business begins with a conversation.",
  aboutParagraph1: "Aalap Alochona is the official networking format of the Bengal Business Council. A space to go beyond introductions, exchange ideas, and build meaningful professional and personal relationships.",
  aboutParagraph2: "Understand each other’s businesses, explore collaborations, and grow together through trust and mutual support.",
  bengaliParagraph1: "‘আলাপ আলোচনা’ হলো Bengal Business Council-এর আনুষ্ঠানিক নেটওয়ার্কিং প্ল্যাটফর্ম, যার উদ্দেশ্য সদস্যদের মধ্যে শুধুমাত্র পরিচয়ের গণ্ডি পেরিয়ে অর্থবহ পেশাগত ও ব্যক্তিগত সম্পর্ক গড়ে তোলা।",
  bengaliParagraph2: "এই উদ্যোগ সদস্যদের একে অপরের ব্যবসা ও কর্মকাণ্ড সম্পর্কে আরও ভালোভাবে জানার, অভিজ্ঞতা ও ভাবনার আদান-প্রদান করার, পারস্পরিক সহযোগিতার সম্ভাবনা খুঁজে দেখার এবং সদস্যদের মধ্যে আস্থা, সৌহার্দ্য ও সহযোগিতার সম্পর্ক আরও দৃঢ় করার সুযোগ করে দেয়।",
  impactLabel: "CONNECTIONS THAT CREATE IMPACT",
  impactValue: "₹2,500+ crore",
  impactCopy: "in business through connections built within the Council.",
  value1: "Meaningful connections",
  value2: "Shared growth",
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

export function eventContentFromRow(row: Record<string, unknown> | undefined): EventContent {
  if (!row) return DEFAULT_EVENT_CONTENT;
  return {
    sectionLabel: String(row.section_label ?? DEFAULT_EVENT_CONTENT.sectionLabel),
    titleBn: String(row.title_bn ?? DEFAULT_EVENT_CONTENT.titleBn),
    titleEn: String(row.title_en ?? DEFAULT_EVENT_CONTENT.titleEn),
    taglineLine1: String(row.tagline_line_1 ?? DEFAULT_EVENT_CONTENT.taglineLine1),
    taglineLine2: String(row.tagline_line_2 ?? DEFAULT_EVENT_CONTENT.taglineLine2),
    eventDate: normalizeEventDate(row.event_date ?? DEFAULT_EVENT_CONTENT.eventDate),
    organizer: String(row.organizer ?? DEFAULT_EVENT_CONTENT.organizer),
    aboutTitle: String(row.about_title ?? DEFAULT_EVENT_CONTENT.aboutTitle),
    aboutParagraph1: String(row.about_paragraph_1 ?? DEFAULT_EVENT_CONTENT.aboutParagraph1),
    aboutParagraph2: String(row.about_paragraph_2 ?? DEFAULT_EVENT_CONTENT.aboutParagraph2),
    bengaliParagraph1: String(row.bengali_paragraph_1 ?? DEFAULT_EVENT_CONTENT.bengaliParagraph1),
    bengaliParagraph2: String(row.bengali_paragraph_2 ?? DEFAULT_EVENT_CONTENT.bengaliParagraph2),
    impactLabel: String(row.impact_label ?? DEFAULT_EVENT_CONTENT.impactLabel),
    impactValue: String(row.impact_value ?? DEFAULT_EVENT_CONTENT.impactValue),
    impactCopy: String(row.impact_copy ?? DEFAULT_EVENT_CONTENT.impactCopy),
    value1: String(row.value_1 ?? DEFAULT_EVENT_CONTENT.value1),
    value2: String(row.value_2 ?? DEFAULT_EVENT_CONTENT.value2),
  };
}
