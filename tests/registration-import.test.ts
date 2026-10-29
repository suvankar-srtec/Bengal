import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { parseRegistrationImport, type ImportRow } from "../src/lib/admin-registration-import";
import { prepareRegistrationImport } from "../src/lib/prepare-registration-import";
import { PRICES } from "../src/lib/registration";

const payment = (overrides: ImportRow = {}): ImportRow => ({
  payment_id: "pay_test", order_id: "order_test", item_name: "Amount", payment_status: "captured",
  member_name: "Example Member", email: "member@example.com", phone: "9000000000",
  item_quantity: "1.0", total_payment_amount: "1207.84", currency: "INR", payment_date: "2026-10-29", ...overrides,
});
const prepare = (rows: ImportRow[]) => prepareRegistrationImport(rows, 12, PRICES);

test("captured Amount and family lines form one registration with the correct pass count", () => {
  const result = prepare([payment({ total_payment_amount: "3623.54" }), payment({ item_name: "Add Family member", item_quantity: "2.0", total_payment_amount: "3623.54" })]);
  assert.equal(result.parsedRows.length, 1);
  assert.equal(result.parsedRows[0].participationQuantity, 3);
  assert.equal(result.parsedRows[0].participantNames.length, 3);
  assert.equal(result.parsedRows[0].amountPaidPaise, 362354);
  assert.equal(result.parsedRows[0].totalPaise, 354000);
  assert.equal(result.skippedRows.length, 0);
});

test("failed and incomplete payments never block a captured attempt for the same phone", () => {
  const result = prepare([payment({ payment_id: "failed", payment_status: "failed" }), payment({ payment_id: "pending", payment_status: "" }), payment()]);
  assert.equal(result.parsedRows.length, 1);
  assert.deepEqual(result.skippedRows.map((row) => row.row), [2, 3]);
  for (const status of ["failed", "authorized", "created", "refunded", "pending", "paid", "", "success"]) {
    assert.equal(prepare([payment({ payment_status: status })]).parsedRows.length, 0);
  }
});

test("invalid successful row does not prevent a different valid row being prepared", () => {
  const result = prepare([payment({ payment_id: "bad", phone: "123" }), payment()]);
  assert.equal(result.parsedRows.length, 1);
  assert.equal(result.rowErrors.length, 1);
  assert.equal(result.rowErrors[0].row, 2);
});

test("rejects incomplete or inconsistent groups and orphan family payments", () => {
  const variations: ImportRow[] = [{ payment_status: "failed" }, { email: "someone@example.com" }, { total_payment_amount: "2000" }, { currency: "USD" }, { item_quantity: "20" }];
  for (const changes of variations) {
    assert.equal(prepare([payment(), payment({ item_name: "Add Family member", ...changes })]).parsedRows.length, 0);
  }
  assert.equal(prepare([payment({ item_name: "Add Family member" })]).parsedRows.length, 0);
  assert.equal(prepare([payment({ item_name: "Donation" })]).parsedRows.length, 0);
  assert.equal(prepare([payment(), payment({ member_name: "Different Member" })]).parsedRows.length, 0);
});

test("duplicates and repeat uploads do not multiply passes or change import identity", () => {
  const base = payment({ total_payment_amount: "2415.70" });
  const family = payment({ item_name: "Add Family member", total_payment_amount: "2415.70" });
  const result = prepare([base, family, base, family]);
  assert.equal(result.parsedRows.length, 1);
  assert.equal(result.parsedRows[0].participationQuantity, 2);
  assert.equal(result.skippedRows.length, 2);
  assert.equal(result.parsedRows[0].key, prepare([family, base]).parsedRows[0].key);
  assert.notEqual(result.parsedRows[0].key, prepare([payment({ payment_id: "another_success" })]).parsedRows[0].key);
});

test("legacy Participation Fees imports preserve their existing deduplication key", () => {
  const row = payment({ item_name: "Participation Fees", total_payment_amount: "1180" });
  const result = prepare([row]).parsedRows[0];
  const key = createHash("sha256").update(JSON.stringify({ source: "payment_export", eventId: 12, paymentDate: row.payment_date, memberName: row.member_name, email: row.email, phone: row.phone, billingDetails: "", quantity: 1, amountPaidRupees: 1180 })).digest("hex");
  assert.equal(result.key, key);
  const legacy = { ...row, amount_paid: "1180" }; delete (legacy as ImportRow).total_payment_amount;
  assert.equal(prepare([legacy]).parsedRows.length, 1);
});

test("captured status alone cannot issue passes with missing, zero, or invalid amounts", () => {
  for (const amount of ["", "0", "-1", "invalid"]) {
    assert.equal(prepare([payment({ total_payment_amount: amount })]).parsedRows.length, 0);
  }
});

test("CSV header normalization supports the supplied export layout and generic imports remain compatible", () => {
  const csv = "Payment ID,Item Name,Payment Status,Member Name,Email,Phone,Item Quantity,Total Payment Amount\n" +
    "pay_a,Amount,captured,Example Member,member@example.com,9000000000,1.0,1180\n" +
    "pay_b,Amount,failed,Other Member,other@example.com,9000000001,1.0,1180";
  const result = prepare(parseRegistrationImport("payments.csv", Buffer.from(csv)));
  assert.equal(result.parsedRows.length, 1); assert.equal(result.skippedRows.length, 1);
  const generic = prepare([{ primary_member: "Legacy Member", email: "member@example.com", phone: "9000000000" }]);
  assert.equal(generic.paymentExport, false); assert.equal(generic.parsedRows.length, 1);
});
