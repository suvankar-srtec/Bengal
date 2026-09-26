import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { readPassToken, tokenFromScannedValue } from "@/lib/pass-token";

export const runtime = "nodejs";

const mealValues = new Set(["snacks", "lunch", "dinner"]);

export async function POST(request: Request) {
  const store = await cookies();
  const session = readAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { value?: unknown; meal?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const raw = typeof body.value === "string" ? body.value : "";
  const meal = typeof body.meal === "string" ? body.meal : "";
  if (!mealValues.has(meal)) {
    return NextResponse.json({ error: "Select a valid meal." }, { status: 400 });
  }

  const token = tokenFromScannedValue(raw);
  const pass = readPassToken(token);
  if (!pass) return NextResponse.json({ error: "Invalid QR pass." }, { status: 400 });

  if (session.role === "manager" && pass.eventId !== session.eventId) {
    return NextResponse.json({ error: "This pass belongs to another event." }, { status: 403 });
  }

  const database = getDatabase();

  try {
    const result = await database.query<{
      id: string;
      reference: string;
      event_id: string;
      participant_names: string[];
      payment_status: string;
      included_meals: string[];
      meal_choice: string | null;
    }>(`
      SELECT id, reference, event_id, participant_names, payment_status, included_meals, meal_choice
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

    if (registration.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed." }, { status: 409 });
    }

    const meals = registration.included_meals?.length
      ? registration.included_meals
      : registration.meal_choice
        ? [registration.meal_choice]
        : [];

    if (!meals.includes(meal)) {
      return NextResponse.json({ error: "This meal is not included for this pass." }, { status: 409 });
    }

    const passId = `${registration.reference}-P${pass.participantNumber}`;

    const inserted = await database.query<{ redeemed_at: Date | string }>(`
      INSERT INTO public.bbc_meal_redemptions (
        pass_id,
        registration_id,
        participant_number,
        participant_name,
        meal_choice
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING redeemed_at
    `, [passId, registration.id, pass.participantNumber, participantName, meal]);

    const status = inserted.rowCount ? "provided" : "already_provided";

    const providedResult = await database.query<{ meal_choice: string }>(`
      SELECT meal_choice
      FROM public.bbc_meal_redemptions
      WHERE registration_id = $1
        AND participant_number = $2
      ORDER BY redeemed_at ASC
    `, [registration.id, pass.participantNumber]);

    return NextResponse.json({
      ok: true,
      status,
      message: status === "provided" ? "Meal marked as provided." : "Meal already provided.",
      meal,
      providedMeals: providedResult.rows.map((row) => row.meal_choice),
    });
  } catch {
    return NextResponse.json({ error: "Unable to update meal status." }, { status: 500 });
  }
}
