import type { ImportRow } from "./admin-registration-import";

type NumberedRow = { row: ImportRow; rowNumber: number };
export type SkippedImportRow = { row: number; error: string };
const normalized = (value: string | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const baseItem = (row: ImportRow) => ["participation fees", "amount"].includes(normalized(row.item_name));
const familyItem = (row: ImportRow) => normalized(row.item_name) === "add family member";

export function isPaymentExport(rows: ImportRow[]) {
  return rows.some((row) => ["item_name", "payment_status", "item_quantity", "total_payment_amount", "payment_id", "order_id"].some((key) => key in row));
}

// Group by transaction, never by phone: a failed attempt must not cancel a later successful payment.
export function preparePaymentRows(input: ImportRow[]) {
  const rows: NumberedRow[] = [];
  const skippedRows: SkippedImportRow[] = [];
  const groups = new Map<string, NumberedRow[]>();
  input.forEach((row, index) => {
    const entry = { row, rowNumber: index + 2 };
    if (!baseItem(row) && !familyItem(row)) {
      skippedRows.push({ row: entry.rowNumber, error: "Skipped: this item is not a registration fee or family member." });
      return;
    }
    const identity = row.payment_id?.trim() ? `payment:${row.payment_id.trim()}` : row.order_id?.trim() ? `order:${row.order_id.trim()}` : `row:${index}`;
    const group = groups.get(identity) ?? [];
    group.push(entry);
    groups.set(identity, group);
  });

  for (const group of groups.values()) {
    const skipGroup = (error: string) => group.forEach((entry) => skippedRows.push({ row: entry.rowNumber, error }));
    if (group.some(({ row }) => normalized(row.payment_status) !== "captured")) {
      skipGroup("Skipped: payment is failed, incomplete, or not captured. No pass created.");
      continue;
    }
    // Repeated export lines must not multiply the number of passes.
    const seen = new Set<string>();
    const unique = group.filter(({ row, rowNumber }) => {
      const signature = JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
      if (seen.has(signature)) {
        skippedRows.push({ row: rowNumber, error: "Skipped: duplicate payment line." });
        return false;
      }
      seen.add(signature);
      return true;
    });
    const bases = unique.filter(({ row }) => baseItem(row));
    if (bases.length !== 1) {
      // No safe way to attribute an orphan family line, or two different base lines.
      unique.forEach(({ rowNumber }) => skippedRows.push({ row: rowNumber, error: "Skipped: payment must contain exactly one registration fee line." }));
      continue;
    }
    const base = bases[0];
    const contact = (row: ImportRow, keys: string[]) => normalized(keys.map((key) => row[key]).find((value) => value?.trim()));
    const amount = (row: ImportRow) => Number((["total_payment_amount", "amount_paid", "paid_amount", "amount"].map((key) => row[key]).find((value) => value?.trim()) ?? "").replace(/[,\s]/g, ""));
    const inconsistent = unique.some(({ row }) =>
      contact(row, ["email", "email_address"]) !== contact(base.row, ["email", "email_address"])
      || contact(row, ["phone", "whatsapp_number", "whatsapp", "mobile", "mobile_number"]).replace(/\D/g, "") !== contact(base.row, ["phone", "whatsapp_number", "whatsapp", "mobile", "mobile_number"]).replace(/\D/g, "")
      || amount(row) !== amount(base.row)
      || (row.currency?.trim() && normalized(row.currency) !== "inr"));
    if (inconsistent) {
      unique.forEach(({ rowNumber }) => skippedRows.push({ row: rowNumber, error: "Skipped: payment lines have inconsistent contact details, amounts, or currency." }));
      continue;
    }
    const quantities = unique.map(({ row }) => Number(row.item_quantity || row.participation_quantity || row.participant_count));
    if (quantities.some((quantity) => !Number.isInteger(quantity) || quantity < 1 || quantity > 20) || quantities.reduce((sum, n) => sum + n, 0) > 20) {
      unique.forEach(({ rowNumber }) => skippedRows.push({ row: rowNumber, error: "Skipped: total participant quantity must be between 1 and 20." }));
      continue;
    }
    rows.push({ rowNumber: base.rowNumber, row: { ...base.row, item_quantity: String(quantities.reduce((sum, n) => sum + n, 0)) } });
  }
  return { rows, skippedRows: skippedRows.sort((a, b) => a.row - b.row) };
}
