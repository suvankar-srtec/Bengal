import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/db";
import { calculateTotal, EVENT, PRICES, registrationSchema, registrationFieldKey } from "@/lib/registration";

export const runtime = "nodejs";

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) {
      await reader.cancel();
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    // Next may normalize request.url to an internal hostname. The browser's Host
    // header preserves the public origin and cannot be overridden by page JS.
    let sameHost = false;
    try {
      const originUrl = new URL(origin);
      sameHost = ["http:", "https:"].includes(originUrl.protocol)
        && originUrl.host === request.headers.get("host");
    } catch { /* Invalid origins are rejected. */ }
    if (!sameHost) return json({ error: "Please submit the form from this website." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Use an application/json request." }, 415);
  }

  let body: unknown;
  try {
    body = JSON.parse(await readBody(request));
  } catch (error) {
    return json({ error: error instanceof Error && error.message === "BODY_TOO_LARGE"
      ? "The submission is too large." : "The submission could not be read." },
    error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 400);
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[registrationFieldKey(issue.path)] ??= issue.message;
    return json({ error: "Please check the highlighted fields.", fields }, 400);
  }

  const data = parsed.data;
  const totalPaise = calculateTotal(data);
  const { additionalParticipantNames, ...originalFields } = data;
  // Keep the original single-participant fingerprint stable across this upgrade.
  const fingerprintData = additionalParticipantNames.length ? { ...originalFields, additionalParticipantNames } : originalFields;
  const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintData)).digest("hex");
  const participantNames = [data.memberName, ...additionalParticipantNames];
  const id = randomUUID();
  const reference = `BBC-${id.toUpperCase()}`;

  try {
    const database = getDatabase();

    let eventId: string = EVENT.id;
    let eventName: string = EVENT.name;
    let eventDate: string = EVENT.date;

    if (data.eventContentId) {
      const eventResult = await database.query<{ id: number; title_en: string; event_date: Date | string }>(
        "SELECT id, title_en, event_date FROM public.bbc_event_content WHERE id = $1",
        [data.eventContentId],
      );
      const eventRecord = eventResult.rows[0];
      if (!eventRecord) {
        return json({ error: "The selected event no longer exists. Return to the dashboard and choose an event again." }, 409);
      }

      eventId = String(eventRecord.id);
      eventName = eventRecord.title_en;
      eventDate = eventRecord.event_date instanceof Date
        ? eventRecord.event_date.toISOString().slice(0, 10)
        : String(eventRecord.event_date).slice(0, 10);
    }

    // The unique submission key makes retries safe if a response is lost.
    const inserted = await database.query<{
      id: string; reference: string; total_paise: number; payment_status: "unpaid"; request_hash: string;
    }>(`
      INSERT INTO public.bbc_event_registrations (
        id, submission_id, request_hash, reference, event_id, event_name, event_date,
        member_name, email, phone, billing_details,
        participation_quantity, standee_quantity, meal_choice, presentation_selected,
        participation_unit_paise, standee_unit_paise, presentation_unit_paise, total_paise, participant_names
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (submission_id) DO NOTHING
      RETURNING id, reference, total_paise, payment_status, request_hash
    `, [id, data.submissionId, fingerprint, reference, eventId, eventName, eventDate,
      data.memberName, data.email, `+91${data.phone}`, data.billingDetails,
      data.participationQuantity, data.standeeQuantity, data.mealChoice, data.presentationSelected, PRICES.participation, PRICES.standee, PRICES.presentation, totalPaise, participantNames]);

    const record = inserted.rows[0] ?? (await database.query<{
      id: string; reference: string; total_paise: number; payment_status: "unpaid"; request_hash: string;
    }>(`SELECT id, reference, total_paise, payment_status, request_hash
        FROM public.bbc_event_registrations WHERE submission_id = $1`, [data.submissionId])).rows[0];

    if (!record || record.request_hash !== fingerprint) {
      return json({ error: "This submission was already saved with different details. Start a new registration to make changes." }, 409);
    }
    return json({ registration: {
      id: record.id, reference: record.reference,
      totalPaise: record.total_paise, paymentStatus: record.payment_status,
    } }, inserted.rows.length ? 201 : 200);
  } catch (error) {
    // Log only database diagnostics; never log submitted personal data or credentials.
    const diagnostic = error && typeof error === "object"
      ? { code: "code" in error ? String(error.code) : undefined, message: "message" in error ? String(error.message) : undefined }
      : {};
    console.error("Registration could not be saved to the database.", diagnostic);
    return json({ error: "We couldn’t save your registration right now. Your details are still here; please try again." }, 503);
  }
}
