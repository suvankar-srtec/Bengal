import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { readPassToken, tokenFromScannedValue } from "@/lib/pass-token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid scan." }, { status: 400 });
  }

  const raw = typeof body.value === "string" ? body.value : "";
  const token = tokenFromScannedValue(raw);
  const pass = readPassToken(token);

  if (!pass) {
    return NextResponse.json({ error: "Invalid QR pass." }, { status: 400 });
  }

  if (session.role === "manager" && pass.eventId !== session.eventId) {
    return NextResponse.json({ error: "This pass belongs to another event." }, { status: 403 });
  }

  try {
    const result = await getDatabase().query<{
      id: string;
      reference: string;
      event_id: string;
      event_name: string;
      event_date: Date | string;
      participant_names: string[];
      payment_status: string;
      included_meals: string[];
      meal_choice: string | null;
    }>(`
      SELECT
        id,
        reference,
        event_id,
        event_name,
        event_date,
        participant_names,
        payment_status,
        included_meals,
        meal_choice
      FROM public.bbc_event_registrations
      WHERE id = $1
        AND event_id = $2
        AND reference = $3
      LIMIT 1
    `, [pass.registrationId, String(pass.eventId), pass.reference]);

    const registration = result.rows[0];
    const participantName = registration?.participant_names?.[pass.participantNumber - 1];

    if (!registration || !participantName) {
      return NextResponse.json({ error: "Pass not found." }, { status: 404 });
    }

    const meals = registration.included_meals?.length
      ? registration.included_meals
      : registration.meal_choice
        ? [registration.meal_choice]
        : [];

    return NextResponse.json({
      ok: true,
      participantName,
      participantNumber: pass.participantNumber,
      reference: registration.reference,
      eventId: Number(registration.event_id),
      eventName: registration.event_name,
      eventDate: registration.event_date,
      paymentStatus: registration.payment_status,
      meals,
    });
  } catch {
    return NextResponse.json({ error: "Unable to verify pass." }, { status: 500 });
  }
}
