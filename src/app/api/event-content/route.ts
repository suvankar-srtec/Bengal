import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { eventContentSchema } from "@/lib/event-content";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

async function authorized() {
  const store = await cookies();
  return validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function PUT(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = eventContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete all event content fields." }, { status: 400 });
  }

  const data = parsed.data;

  try {
    await getDatabase().query(
      `INSERT INTO public.bbc_event_content (
        id, section_label, title_bn, title_en, tagline_line_1, tagline_line_2,
        event_date, organizer, about_title, about_paragraph_1, about_paragraph_2,
        bengali_paragraph_1, bengali_paragraph_2, impact_label, impact_value,
        impact_copy, value_1, value_2, updated_at
      ) VALUES (
        1, $1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        section_label = EXCLUDED.section_label,
        title_bn = EXCLUDED.title_bn,
        title_en = EXCLUDED.title_en,
        tagline_line_1 = EXCLUDED.tagline_line_1,
        tagline_line_2 = EXCLUDED.tagline_line_2,
        event_date = EXCLUDED.event_date,
        organizer = EXCLUDED.organizer,
        about_title = EXCLUDED.about_title,
        about_paragraph_1 = EXCLUDED.about_paragraph_1,
        about_paragraph_2 = EXCLUDED.about_paragraph_2,
        bengali_paragraph_1 = EXCLUDED.bengali_paragraph_1,
        bengali_paragraph_2 = EXCLUDED.bengali_paragraph_2,
        impact_label = EXCLUDED.impact_label,
        impact_value = EXCLUDED.impact_value,
        impact_copy = EXCLUDED.impact_copy,
        value_1 = EXCLUDED.value_1,
        value_2 = EXCLUDED.value_2,
        updated_at = NOW()`,
      [
        data.sectionLabel,
        data.titleBn,
        data.titleEn,
        data.taglineLine1,
        data.taglineLine2,
        data.eventDate,
        data.organizer,
        data.aboutTitle,
        data.aboutParagraph1,
        data.aboutParagraph2,
        data.bengaliParagraph1,
        data.bengaliParagraph2,
        data.impactLabel,
        data.impactValue,
        data.impactCopy,
        data.value1,
        data.value2,
      ],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const diagnostic = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    console.error("Event content could not be saved.", { code: diagnostic });
    return NextResponse.json({ error: "Couldn’t save the event content. Please try again." }, { status: 500 });
  }
}
