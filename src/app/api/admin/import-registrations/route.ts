import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { prepareRegistrationImport } from "@/lib/prepare-registration-import";
import { parseRegistrationImport } from "@/lib/admin-registration-import";
import { getDatabase } from "@/lib/db";
import { passBundlePath } from "@/lib/whatsapp-delivery";
import { participationPricesFromRow } from "@/lib/registration";

export const runtime = "nodejs";
export const maxDuration = 60;

type EventRow = {
  id: number;
  title_en: string;
  event_date: Date | string;
  participation_unit_paise: number;
  standee_unit_paise: number;
  presentation_unit_paise: number;
  meal_option: "snacks" | "lunch" | "dinner";
  snacks_unit_paise: number;
  lunch_unit_paise: number;
  dinner_unit_paise: number;
  included_meals: ("snacks" | "lunch" | "dinner")[];
};

export async function POST(request: Request) {
  const session = readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Sign in as an administrator." }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Only administrators can upload registrations." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "The uploaded file could not be read." }, { status: 400 });

  const eventId = Number(form.get("eventId"));
  const file = form.get("file");
  if (!Number.isInteger(eventId) || eventId < 1) return Response.json({ error: "Select an event." }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "Choose a CSV or Excel file." }, { status: 400 });
  if (file.size < 1 || file.size > 5 * 1024 * 1024) return Response.json({ error: "The file must be 5 MB or smaller." }, { status: 400 });

  let rows: Record<string, string>[];
  try {
    rows = parseRegistrationImport(file.name, Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The file could not be parsed." }, { status: 400 });
  }

  if (!rows.length) return Response.json({ error: "The file contains no registration rows." }, { status: 400 });
  if (rows.length > 500) return Response.json({ error: "Upload at most 500 registrations at a time." }, { status: 400 });

  const database = getDatabase();
  const event = (await database.query<EventRow>(
    "SELECT id, title_en, event_date, participation_unit_paise, standee_unit_paise, presentation_unit_paise, meal_option, snacks_unit_paise, lunch_unit_paise, dinner_unit_paise, included_meals FROM public.bbc_event_content WHERE id = $1",
    [eventId],
  )).rows[0];
  if (!event) return Response.json({ error: "The selected event no longer exists." }, { status: 404 });

  const prices = participationPricesFromRow(event as unknown as Record<string, unknown>);
  const { parsedRows, rowErrors, skippedRows, paymentExport } = prepareRegistrationImport(rows, eventId, prices);
  if (!parsedRows.length) {
    return Response.json({
      error: paymentExport
        ? "No valid captured registration payments were found. Failed, incomplete, unrelated, or invalid rows were skipped."
        : "No valid registrations were found. Check the row details below.",
      rowErrors: rowErrors.slice(0, 50), skippedRows: skippedRows.slice(0, 50),
      skippedCount: rowErrors.length + skippedRows.length,
    }, { status: 400 });
  }

  const client = await database.connect();
  const resultRows: Array<{
    row: number;
    registrationId: string;
    primaryMember: string;
    participants: number;
    additionalParticipants: number;
    whatsapp: string;
    passUrl: string;
    deliveryStatus: string;
    canSendPasses: boolean;
    existing: boolean;
  }> = [];
  const origin = (process.env.APP_PUBLIC_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const eventDate = event.event_date instanceof Date ? event.event_date.toISOString().slice(0, 10) : String(event.event_date).slice(0, 10);

  try {
    await client.query("BEGIN");

    for (const row of parsedRows) {
      let registration = (await client.query<{ id: string; reference: string }>(
        "SELECT id, reference FROM public.bbc_event_registrations WHERE admin_import_key = $1 LIMIT 1",
        [row.key],
      )).rows[0];
      const existing = Boolean(registration);

      if (!registration) {
        const id = randomUUID();
        const submissionId = randomUUID();
        const reference = "BBC-" + id.toUpperCase();
        const requestHash = createHash("sha256").update(JSON.stringify(row)).digest("hex");

        registration = (await client.query<{ id: string; reference: string }>(
          "INSERT INTO public.bbc_event_registrations (" +
          "id, submission_id, request_hash, reference, event_id, event_name, event_date, member_name, email, phone, billing_details, " +
          "participation_quantity, standee_quantity, meal_choice, included_meals, presentation_selected, participation_unit_paise, standee_unit_paise, " +
          "presentation_unit_paise, meal_unit_paise, total_paise, amount_paid_paise, participant_names, payment_status, admin_import_key" +
          ") VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13,NULL,$14,$15,$16,$17,$18,0,$19,$20,$21,'paid',$22) RETURNING id, reference",
          [
            id, submissionId, requestHash, reference, String(eventId), event.title_en, eventDate,
            row.memberName, row.email, "+91" + row.phone, row.billingDetails,
            row.participationQuantity, row.standeeQuantity, prices.includedMeals, row.presentationSelected,
            prices.participation, prices.standee, prices.presentation, row.totalPaise, row.amountPaidPaise, row.participantNames, row.key,
          ],
        )).rows[0];

        await client.query(
          "INSERT INTO public.bbc_members (id, primary_name, participant_names, email, phone, billing_details, updated_at) " +
          "VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (email) DO UPDATE SET primary_name=EXCLUDED.primary_name, " +
          "participant_names=EXCLUDED.participant_names, phone=EXCLUDED.phone, billing_details=EXCLUDED.billing_details, updated_at=NOW()",
          [randomUUID(), row.memberName, row.participantNames.slice(1), row.email, "+91" + row.phone, row.billingDetails],
        );
      } else {
        await client.query(
          "UPDATE public.bbc_event_registrations SET amount_paid_paise = $2, payment_status = 'paid', participant_names = $3, participation_quantity = $4 WHERE id = $1",
          [registration.id, row.amountPaidPaise, row.participantNames, row.participationQuantity],
        );

        await client.query(
          "UPDATE public.bbc_members SET primary_name = $2, participant_names = $3, phone = $4, billing_details = $5, updated_at = NOW() WHERE email = $1",
          [row.email, row.memberName, row.participantNames.slice(1), "+91" + row.phone, row.billingDetails],
        );
      }

      await client.query(
        "INSERT INTO public.bbc_whatsapp_pass_deliveries (registration_id, media_token, status) VALUES ($1,$2,'manual') ON CONFLICT (registration_id) DO NOTHING",
        [registration.id, randomBytes(32).toString("hex")],
      );

      const delivery = (await client.query<{
        media_token: string;
        status: string;
        event_resend_at: Date | null;
        event_started: boolean;
      }>(`
        SELECT
          d.media_token,
          d.status,
          d.event_resend_at,
          (r.event_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date) AS event_started
        FROM public.bbc_whatsapp_pass_deliveries d
        JOIN public.bbc_event_registrations r ON r.id=d.registration_id
        WHERE d.registration_id=$1
      `, [registration.id])).rows[0];
      if (!delivery) throw new Error("Pass link could not be generated.");

      resultRows.push({
        row: row.rowNumber,
        registrationId: registration.id,
        primaryMember: row.memberName,
        participants: row.participantNames.length,
        additionalParticipants: Math.max(0, row.participantNames.length - 1),
        whatsapp: "+91" + row.phone,
        passUrl: origin + passBundlePath(delivery.media_token),
        deliveryStatus: delivery.status,
        canSendPasses:
          delivery.status !== "accepted" ||
          (delivery.event_started && !delivery.event_resend_at),
        existing,
      });
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Admin registration import failed.", {
      code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
    });
    return Response.json({ error: "The registrations could not be imported. Nothing was saved." }, { status: 500 });
  } finally {
    client.release();
  }

  return Response.json({ ok: true, event: { id: event.id, title: event.title_en }, count: resultRows.length, results: resultRows, skippedCount: skippedRows.length + rowErrors.length, skippedRows: skippedRows.slice(0, 50), rowErrors: rowErrors.slice(0, 50) });
}
