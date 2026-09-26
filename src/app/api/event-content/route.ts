import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { createEventSchema, eventContentSchema } from "@/lib/event-content";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

async function authorized() {
  const store = await cookies();
  return readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)?.role === "admin";
}

function values(data: ReturnType<typeof eventContentSchema.parse>) {
  return [
    "",
    data.titleBn,
    data.titleEn,
    data.aboutTagline1,
    data.aboutTagline2,
    data.eventDate,
    data.eventTime,
    data.organizer,
    data.aboutTagline1,
    data.aboutParagraph1,
    data.aboutParagraph2,
    "",
    "",
  ];
}

export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete pricing and event content before creating the event." }, { status: 400 });
  }

  try {
    const database = getDatabase();
    const eventValues = values(parsed.data);

    const duplicate = await database.query<{ id: number }>(
      `SELECT id
       FROM public.bbc_event_content
       WHERE title_bn = $1
         AND title_en = $2
         AND event_date = $3::date
         AND event_time = $4::time
         AND organizer = $5
       ORDER BY id
       LIMIT 1`,
      [
        parsed.data.titleBn,
        parsed.data.titleEn,
        parsed.data.eventDate,
        parsed.data.eventTime,
        parsed.data.organizer,
      ],
    );

    if (duplicate.rows[0]) {
      return NextResponse.json(
        {
          error: "This event already exists.",
          eventId: duplicate.rows[0].id,
        },
        { status: 409 },
      );
    }

    const result = await database.query<{ id: number }>(
      `INSERT INTO public.bbc_event_content (
        section_label, title_bn, title_en, tagline_line_1, tagline_line_2,
        event_date, event_time, organizer, about_title, about_paragraph_1, about_paragraph_2,
        bengali_paragraph_1, bengali_paragraph_2,
        participation_unit_paise, standee_unit_paise, presentation_unit_paise,
        meal_option, snacks_unit_paise, lunch_unit_paise, dinner_unit_paise, included_meals
      ) VALUES (
        $1, $2, $3, $4, $5, $6::date, $7::time, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, 0, 0, 0, $18
      )
      RETURNING id`,
      [
        ...eventValues,
        parsed.data.participationPaise,
        parsed.data.standeePaise,
        parsed.data.presentationPaise,
        parsed.data.includedMeals[0],
        parsed.data.includedMeals,
      ],
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

  const parsed = createEventSchema.safeParse(candidate);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete pricing and event content before updating the event." }, { status: 400 });
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
        event_time = $7::time,
        organizer = $8,
        about_title = $9,
        about_paragraph_1 = $10,
        about_paragraph_2 = $11,
        bengali_paragraph_1 = $12,
        bengali_paragraph_2 = $13,
        participation_unit_paise = $14,
        standee_unit_paise = $15,
        presentation_unit_paise = $16,
        meal_option = $17,
        snacks_unit_paise = 0,
        lunch_unit_paise = 0,
        dinner_unit_paise = 0,
        included_meals = $18,
        updated_at = NOW()
      WHERE id = $19`,
      [
        ...values(parsed.data),
        parsed.data.participationPaise,
        parsed.data.standeePaise,
        parsed.data.presentationPaise,
        parsed.data.includedMeals[0],
        parsed.data.includedMeals,
        eventId,
      ],
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
