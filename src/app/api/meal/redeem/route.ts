import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

type ParsedPass = {
  registrationId: string;
  reference: string;
  participantNumber: number;
  passId: string;
  encodedName?: string;
  encodedMeal?: string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parsePassPayload(raw: string): ParsedPass | null {
  const value = raw.trim();
  if (!value.startsWith("BBC|")) return null;

  const fields = new Map<string, string>();
  for (const segment of value.split("|").slice(1)) {
    const separator = segment.indexOf(":");
    if (separator < 1) continue;
    fields.set(segment.slice(0, separator).toUpperCase(), segment.slice(separator + 1));
  }

  const registrationId = fields.get("REG")?.trim() ?? "";
  const reference = fields.get("REF")?.trim() ?? "";
  const passId = fields.get("PASS")?.trim() ?? "";
  const participantNumber = Number(fields.get("PARTICIPANT"));

  if (
    !registrationId ||
    !reference ||
    !passId ||
    !Number.isInteger(participantNumber) ||
    participantNumber < 1
  ) {
    return null;
  }

  return {
    registrationId,
    reference,
    participantNumber,
    passId,
    encodedName: fields.get("NAME"),
    encodedMeal: fields.get("MEAL"),
  };
}

async function readQrPayload(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json() as Record<string, unknown>;
    const candidate = body.qr ?? body.payload ?? body.code ?? body.value;
    return typeof candidate === "string" ? candidate : "";
  }

  return request.text();
}

export async function POST(request: Request) {
  let rawQr = "";
  try {
    rawQr = await readQrPayload(request);
  } catch {
    return json({ ok: false, status: "invalid_qr", message: "Invalid QR" }, 400);
  }

  const pass = parsePassPayload(rawQr);
  if (!pass) {
    return json({ ok: false, status: "invalid_qr", message: "Invalid QR" }, 400);
  }

  try {
    const database = getDatabase();

    const registrationResult = await database.query<{
      id: string;
      reference: string;
      payment_status: string;
      meal_choice: "lunch" | "dinner" | null;
      participant_names: string[];
    }>(`
      SELECT id, reference, payment_status, meal_choice, participant_names
      FROM public.bbc_event_registrations
      WHERE id = $1
      LIMIT 1
    `, [pass.registrationId]);

    const registration = registrationResult.rows[0];

    if (!registration) {
      return json({ ok: false, status: "invalid_pass", message: "Invalid pass" }, 404);
    }

    const expectedPassId = `${registration.reference}-P${pass.participantNumber}`;
    const participantName = registration.participant_names?.[pass.participantNumber - 1];

    if (
      registration.reference !== pass.reference ||
      expectedPassId !== pass.passId ||
      !participantName
    ) {
      return json({ ok: false, status: "invalid_pass", message: "Invalid pass" }, 400);
    }

    if (registration.payment_status !== "paid") {
      return json({
        ok: false,
        status: "payment_not_completed",
        message: "Payment not completed",
        participantName,
      });
    }

    if (!registration.meal_choice) {
      return json({
        ok: false,
        status: "no_meal",
        message: "No meal selected",
        participantName,
        mealChoice: null,
      });
    }

    const redeemed = await database.query<{
      pass_id: string;
      redeemed_at: Date | string;
    }>(`
      INSERT INTO public.bbc_meal_redemptions (
        pass_id,
        registration_id,
        participant_number,
        participant_name,
        meal_choice
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING pass_id, redeemed_at
    `, [
      pass.passId,
      registration.id,
      pass.participantNumber,
      participantName,
      registration.meal_choice,
    ]);

    if (redeemed.rows[0]) {
      return json({
        ok: true,
        status: "meal_available",
        message: "Meal available",
        participantName,
        participantNumber: pass.participantNumber,
        mealChoice: registration.meal_choice,
        redeemedAt: redeemed.rows[0].redeemed_at,
      });
    }

    const previousResult = await database.query<{
      participant_name: string;
      meal_choice: "lunch" | "dinner";
      redeemed_at: Date | string;
    }>(`
      SELECT participant_name, meal_choice, redeemed_at
      FROM public.bbc_meal_redemptions
      WHERE registration_id = $1
        AND participant_number = $2
      LIMIT 1
    `, [registration.id, pass.participantNumber]);

    const previous = previousResult.rows[0];

    return json({
      ok: false,
      status: "already_taken",
      message: "Meal already taken",
      participantName: previous?.participant_name ?? participantName,
      participantNumber: pass.participantNumber,
      mealChoice: previous?.meal_choice ?? registration.meal_choice,
      redeemedAt: previous?.redeemed_at ?? null,
    });
  } catch (error) {
    const diagnostic = error && typeof error === "object"
      ? {
          code: "code" in error ? String(error.code) : undefined,
          message: "message" in error ? String(error.message) : undefined,
        }
      : {};

    console.error("Meal QR could not be processed.", diagnostic);
    return json({
      ok: false,
      status: "server_error",
      message: "Unable to process meal QR",
    }, 500);
  }
}
