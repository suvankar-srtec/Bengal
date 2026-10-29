import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { calculateTotal, registrationSchema, type ParticipationPrices } from "./registration";
import { isPaymentExport, preparePaymentRows } from "./payment-import-rows";
import type { ImportRow } from "./admin-registration-import";

function field(row: Record<string, string>, names: string[]) {
  for (const name of names) if (row[name]?.trim()) return row[name].trim();
  return "";
}

function phone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

function optionalBillingDetails(raw: string) {
  const value = raw.trim().toUpperCase();
  return /^(?:[A-Z]{5}[0-9]{4}[A-Z]|[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])$/.test(value)
    ? value
    : "";
}

function participants(raw: string, primary: string) {
  const names = raw.split(/[|;\n]+/).map((value) => value.trim()).filter(Boolean);
  if (names[0]?.toLowerCase() === primary.trim().toLowerCase()) names.shift();
  return names;
}

function yes(raw: string) {
  return /^(?:1|true|yes|y)$/i.test(raw.trim());
}

function moneyRupees(raw: string) {
  const value = Number(raw.replace(/[₹,\s]/g, ""));
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

export function prepareRegistrationImport(rows: ImportRow[], eventId: number, prices: ParticipationPrices) {
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
    source: "registration" | "payment_export";
  }> = [];
  const rowErrors: Array<{ row: number; error: string }> = [];
  const keys = new Set<string>();

  const paymentExport = isPaymentExport(rows);
  const prepared = paymentExport ? preparePaymentRows(rows) : { rows: rows.map((row, index) => ({ row, rowNumber: index + 2 })), skippedRows: [] };
  const skippedRows = prepared.skippedRows;

  prepared.rows.forEach(({ row, rowNumber }) => {

    if (paymentExport) {

      const memberName = field(row, ["member_name", "primary_member", "name"]);
      const email = field(row, ["email", "email_address"]);
      const whatsapp = phone(field(row, ["phone", "whatsapp_number", "whatsapp", "mobile", "mobile_number"]));
      const billingDetails = optionalBillingDetails(field(row, ["billing_details", "billing", "gst_pan", "gstin_pan", "gst_pan_number", "gst_number_or_pan_number"]));
      const quantity = Number(field(row, ["item_quantity", "participation_quantity", "participant_count"]));
      const amountPaidRupees = moneyRupees(field(row, ["total_payment_amount", "amount_paid", "paid_amount", "amount"]));
      const paymentDate = field(row, ["payment_date"]);

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        rowErrors.push({ row: rowNumber, error: "Participation Fees item quantity must be between 1 and 20." });
        return;
      }
      if (!Number.isFinite(amountPaidRupees) || amountPaidRupees <= 0) {
        rowErrors.push({ row: rowNumber, error: "A positive captured payment amount is required." });
        return;
      }

      const generatedAdditionalNames = Array.from(
        { length: quantity - 1 },
        (_, nameIndex) => `${memberName} +${nameIndex + 1}`,
      );
      const parsed = registrationSchema.safeParse({
        submissionId: randomUUID(),
        eventContentId: eventId,
        memberName,
        email,
        phone: whatsapp,
        billingDetails,
        photoDataUrl: null,
        participationQuantity: quantity,
        standeeQuantity: 0,
        mealChoice: null,
        presentationSelected: false,
        additionalParticipantNames: generatedAdditionalNames,
      });

      if (!parsed.success) {
        rowErrors.push({ row: rowNumber, error: parsed.error.issues[0]?.message || "Invalid payment registration data." });
        return;
      }

      const participantNames = [parsed.data.memberName, ...generatedAdditionalNames];
      const calculatedTotalPaise = quantity * prices.participation;
      const paymentIdentity = field(row, ["payment_id", "order_id"]);
      const keyData = row.item_name.trim().toLowerCase() === "amount" && paymentIdentity
        ? { source: "payment_export_amount", eventId, paymentIdentity }
        : { source: "payment_export", eventId, paymentDate, memberName: parsed.data.memberName, email: parsed.data.email,
            phone: parsed.data.phone, billingDetails: parsed.data.billingDetails, quantity, amountPaidRupees };
      const key = createHash("sha256").update(JSON.stringify(keyData)).digest("hex");

      if (keys.has(key)) {
        rowErrors.push({ row: rowNumber, error: "This captured Participation Fees payment is duplicated within the uploaded file." });
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
        participationQuantity: quantity,
        standeeQuantity: 0,
        presentationSelected: false,
        amountPaidPaise: Math.round(amountPaidRupees * 100),
        totalPaise: calculatedTotalPaise,
        key,
        source: "payment_export",
      });
      return;
    }

    const memberName = field(row, ["primary_member", "member_name", "primary_member_name", "name"]);
    const email = field(row, ["email", "email_address"]);
    const whatsapp = phone(field(row, ["whatsapp_number", "whatsapp", "phone", "mobile", "mobile_number"]));
    const billingDetails = optionalBillingDetails(field(row, ["billing_details", "billing", "gst_pan", "gstin_pan", "gst_pan_number", "gst_number_or_pan_number"]));
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
    const amountPaidRupees = amountPaidRaw ? moneyRupees(amountPaidRaw) : calculatedTotalPaise / 100;
    if (!Number.isFinite(amountPaidRupees) || amountPaidRupees <= 0) {
      rowErrors.push({ row: rowNumber, error: "Amount Paid could not be calculated. Check the row values." });
      return;
    }

    const key = createHash("sha256").update(JSON.stringify({
      source: "registration", eventId, memberName: parsed.data.memberName, email: parsed.data.email, phone: parsed.data.phone,
      billingDetails: parsed.data.billingDetails, participantNames, standeeQuantity: parsed.data.standeeQuantity,
      presentationSelected: parsed.data.presentationSelected,
    })).digest("hex");

    if (keys.has(key)) {
      rowErrors.push({ row: rowNumber, error: "This registration is duplicated within the uploaded file." });
      return;
    }
    keys.add(key);

    parsedRows.push({
      rowNumber, memberName: parsed.data.memberName, email: parsed.data.email, phone: parsed.data.phone,
      billingDetails: parsed.data.billingDetails, participantNames, participationQuantity: parsed.data.participationQuantity,
      standeeQuantity: parsed.data.standeeQuantity, presentationSelected: parsed.data.presentationSelected,
      amountPaidPaise: Math.round(amountPaidRupees * 100), totalPaise: calculatedTotalPaise, key,
      source: "registration",
    });
  });

  return { parsedRows, rowErrors, skippedRows, paymentExport };
}
