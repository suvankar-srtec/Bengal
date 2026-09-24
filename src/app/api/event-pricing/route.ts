import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

async function authorized() {
  const store = await cookies();
  return validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
}

function validPaise(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 100_000_000_000
    ? number
    : null;
}

export async function PUT(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const eventId = Number(body.eventId);
  const participationPaise = validPaise(body.participationPaise);
  const standeePaise = validPaise(body.standeePaise);
  const presentationPaise = validPaise(body.presentationPaise);

  if (
    !Number.isInteger(eventId) || eventId < 1 ||
    participationPaise === null ||
    standeePaise === null ||
    presentationPaise === null
  ) {
    return NextResponse.json({ error: "Enter valid pricing values." }, { status: 400 });
  }

  try {
    const result = await getDatabase().query(
      `UPDATE public.bbc_event_content
       SET participation_unit_paise = $1,
           standee_unit_paise = $2,
           presentation_unit_paise = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [participationPaise, standeePaise, presentationPaise, eventId],
    );

    if (!result.rowCount) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      eventId,
      prices: {
        participation: participationPaise,
        standee: standeePaise,
        presentation: presentationPaise,
      },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    console.error("Event pricing could not be saved.", { code });
    return NextResponse.json({ error: "Couldn’t save pricing. Please try again." }, { status: 500 });
  }
}
