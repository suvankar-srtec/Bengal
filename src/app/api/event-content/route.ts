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

function values(data: ReturnType<typeof eventContentSchema.parse>) {
  return [
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
  ];
}

export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = eventContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete all event content fields." }, { status: 400 });
  }

  try {
    const result = await getDatabase().query<{ id: number }>(
      `INSERT INTO public.bbc_event_content (
        section_label, title_bn, title_en, tagline_line_1, tagline_line_2,
        event_date, organizer, about_title, about_paragraph_1, about_paragraph_2,
        bengali_paragraph_1, bengali_paragraph_2
      ) VALUES (
        $1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12
      )
      RETURNING id`,
      values(parsed.data),
    );
    return NextResponse.json({ ok: true, eventId: result.rows[0]?.id }, { status: 201 });
  } catch (error) {
    const diagnostic = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    console.error("Event could not be created.", { code: diagnostic });
    return NextResponse.json({ error: "Couldn’t create the event. Please try again." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const candidate = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const eventId = Number(candidate.eventId);
  if (!Number.isInteger(eventId) || eventId < 1) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  const parsed = eventContentSchema.safeParse(candidate);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete all event content fields." }, { status: 400 });
  }

  try {
    const result = await getDatabase().query(
      `UPDATE public.bbc_event_content SET
        section_label = $1,
        title_bn = $2,
        title_en = $3,
        tagline_line_1 = $4,
        tagline_line_2 = $5,
        event_date = $6::date,
        organizer = $7,
        about_title = $8,
        about_paragraph_1 = $9,
        about_paragraph_2 = $10,
        bengali_paragraph_1 = $11,
        bengali_paragraph_2 = $12,
        updated_at = NOW()
      WHERE id = $13`,
      [...values(parsed.data), eventId],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json({ ok: true, eventId });
  } catch (error) {
    const diagnostic = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    console.error("Event could not be updated.", { code: diagnostic });
    return NextResponse.json({ error: "Couldn’t update the event. Please try again." }, { status: 500 });
  }
}


export async function DELETE(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const eventId = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(eventId) || eventId < 1) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  try {
    const result = await getDatabase().query(
      "DELETE FROM public.bbc_event_content WHERE id = $1",
      [eventId],
    );

    if (!result.rowCount) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, eventId });
  } catch (error) {
    const diagnostic = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    console.error("Event could not be deleted.", { code: diagnostic });
    return NextResponse.json({ error: "Couldn’t delete the event. Please try again." }, { status: 500 });
  }
}
