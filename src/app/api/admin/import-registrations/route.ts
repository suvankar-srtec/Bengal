import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { parseRegistrationImport } from "@/lib/admin-registration-import";
import { getDatabase } from "@/lib/db";
import { calculateTotal, participationPricesFromRow, registrationSchema } from "@/lib/registration";

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

function field(row: Record<string, string>, names: string[]) {
  for (const name of names) if (row[name]?.trim()) return row[name].trim();
  return "";
}

function phone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

function participants(raw: string, primary: string) {
  const names = raw.split(/[|;\n]+/).map((value) => value.trim()).filter(Boolean);
  if (names[0]?.toLowerCase() === primary.trim().toLowerCase()) names.shift();
  return names;
}

function yes(raw: string) {
  return /^(?:1|true|yes|y)$/i.test(raw.trim());
}

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
  const parsedRows: Array<{
    rowNumber: number;
    memberName: string;
    email: string;
    phone: string;
    billingDetails: string;
    participantNames: string[];
    participationQuantity: number;
    standeeQuantity: number;
    presentationSelected: boolean;
    amountPaidPaise: number;
    totalPaise: number;
    key: string;
  }> = [];
  const rowErrors: Array<{ row: number; error: string }> = [];
  const keys = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const memberName = field(row, ["primary_member", "member_name", "primary_member_name", "name"]);
    const email = field(row, ["email", "email_address"]);
    const whatsapp = phone(field(row, ["whatsapp_number", "whatsapp", "phone", "mobile", "mobile_number"]));
    const billingDetails = field(row, ["billing_details", "billing", "gst_pan", "gstin_pan", "gst_pan_number"]).toUpperCase();
    const additional = participants(field(row, ["additional_participants", "participant_names", "participants"]), memberName);
    const participantNames = [memberName, ...additional];
    const quantityText = field(row, ["participation_quantity", "participant_count", "participants_count"]);
    const participationQuantity = quantityText ? Number(quantityText) : participantNames.length;
    const standeeQuantity = Number(field(row, ["standee_quantity", "standee", "standees"]) || "0");
    const presentationSelected = yes(field(row, ["company_presentation", "presentation", "presentation_selected"]));
    const amountPaidRaw = field(row, ["amount_paid", "paid_amount", "amount"]);

    const parsed = registrationSchema.safeParse({
      submissionId: randomUUID(),
      eventContentId: eventId,
      memberName,
      email,
      phone: whatsapp,
      billingDetails,
      photoDataUrl: null,
      participationQuantity,
      standeeQuantity,
      mealChoice: null,
      presentationSelected,
      additionalParticipantNames: additional,
    });

    if (!parsed.success) {
      rowErrors.push({ row: rowNumber, error: parsed.error.issues[0]?.message || "Invalid registration data." });
      return;
    }

    const calculatedTotalPaise = calculateTotal(parsed.data, prices);
    const amountPaidRupees = amountPaidRaw ? Number(amountPaidRaw.replace(/[₹,\s]/g, "")) : calculatedTotalPaise / 100;

    if (!Number.isFinite(amountPaidRupees) || amountPaidRupees < 0) {
      rowErrors.push({ row: rowNumber, error: "Amount Paid could not be calculated. Check the row values." });
      return;
    }

    const key = createHash("sha256").update(JSON.stringify({
      eventId,
      memberName: parsed.data.memberName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      billingDetails: parsed.data.billingDetails,
      participantNames,
      standeeQuantity: parsed.data.standeeQuantity,
      presentationSelected: parsed.data.presentationSelected,
    })).digest("hex");

    if (keys.has(key)) {
      rowErrors.push({ row: rowNumber, error: "This registration is duplicated within the uploaded file." });
      return;
    }
    keys.add(key);

    parsedRows.push({
      rowNumber,
      memberName: parsed.data.memberName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      billingDetails: parsed.data.billingDetails,
      participantNames,
      participationQuantity: parsed.data.participationQuantity,
      standeeQuantity: parsed.data.standeeQuantity,
      presentationSelected: parsed.data.presentationSelected,
      amountPaidPaise: Math.round(amountPaidRupees * 100),
      totalPaise: calculatedTotalPaise,
      key,
    });
  });

  if (rowErrors.length) {
    return Response.json({ error: "Some rows need correction. Nothing was imported.", rowErrors: rowErrors.slice(0, 50) }, { status: 400 });
  }

  const client = await database.connect();
  const resultRows: Array<{ row: number; primaryMember: string; participants: number; additionalParticipants: number; whatsapp: string; passUrl: string; existing: boolean }> = [];
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
          "UPDATE public.bbc_event_registrations SET amount_paid_paise = $2, payment_status = 'paid' WHERE id = $1",
          [registration.id, row.amountPaidPaise],
        );
      }

      await client.query(
        "INSERT INTO public.bbc_whatsapp_pass_deliveries (registration_id, media_token, status) VALUES ($1,$2,'manual') ON CONFLICT (registration_id) DO NOTHING",
        [registration.id, randomBytes(32).toString("hex")],
      );

      const delivery = (await client.query<{ media_token: string }>(
        "SELECT media_token FROM public.bbc_whatsapp_pass_deliveries WHERE registration_id = $1",
        [registration.id],
      )).rows[0];
      if (!delivery) throw new Error("Pass link could not be generated.");

      resultRows.push({
        row: row.rowNumber,
        primaryMember: row.memberName,
        participants: row.participantNames.length,
        additionalParticipants: Math.max(0, row.participantNames.length - 1),
        whatsapp: "+91" + row.phone,
        passUrl: origin + "/passes/" + delivery.media_token,
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

  return Response.json({ ok: true, event: { id: event.id, title: event.title_en }, count: resultRows.length, results: resultRows });
}
