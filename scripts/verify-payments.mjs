import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const submissionId = randomUUID();
const email = `bbc-payment-test-${submissionId}@example.com`;
const connection = new URL(process.env.DATABASE_URL);
connection.searchParams.set("sslmode", "verify-full");
const client = new pg.Client({ connectionString: connection.toString(), enableChannelBinding: true });
const send = async (path, body, expected = 200, headers = {}) => {
  const response = await fetch(`${base}/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, expected, `${path} HTTP status`);
  return response.json();
};

try {
  await client.connect();
  const { registration } = await send("registrations", {
    submissionId, memberName: "Payment Integration Check", email, phone: "9000000000", billingDetails: "ABCDE1234F",
    additionalParticipantNames: ["Payment Test Guest"],
    participationQuantity: 2, standeeQuantity: 1, presentationSelected: true,
  }, 201);
  const access = { registrationId: registration.id, submissionId };
  await send("payments/order", { ...access, submissionId: randomUUID() }, 404);
  await send("payments/order", access, 403, { Origin: "https://unrelated.example" });
  await send("payments/order", { ...access, oversized: "x".repeat(9000) }, 413);
  console.log("PASS: checkout rejects invalid access, foreign origins, and oversized payloads.");

  const [first, concurrent] = await Promise.all([
    send("payments/order", { ...access, amountPaise: 1, mode: "live" }),
    send("payments/order", access),
  ]);
  assert.equal(first.order.mode, "demo", "Run this integration check with PAYMENT_MODE=demo.");
  assert.equal(first.order.amountPaise, 4071000);
  assert.equal(first.order.id, concurrent.order.id);
  assert.equal("keyId" in first.order, false);
  const cancel = { ...access, attemptId: first.order.id, outcome: "cancelled", method: "upi" };
  assert.equal((await send("payments/complete", cancel)).payment.status, "cancelled");
  assert.equal((await send("payments/complete", cancel)).payment.status, "cancelled");
  await send("payments/complete", { ...cancel, outcome: "succeeded" }, 409);

  const failedOrder = (await send("payments/order", access)).order;
  assert.notEqual(failedOrder.id, first.order.id);
  const failure = await send("payments/complete", { ...access, attemptId: failedOrder.id, outcome: "failed", method: "card" });
  assert.equal(failure.payment.status, "failed");
  console.log("PASS: server owns amount and mode; order creation is idempotent; cancelled and failed attempts can be retried.");

  const successOrder = (await send("payments/order", access)).order;
  await send("payments/complete", { ...access, submissionId: randomUUID(), attemptId: successOrder.id, outcome: "succeeded", method: "netbanking" }, 404);
  const complete = { ...access, attemptId: successOrder.id, outcome: "succeeded", method: "netbanking" };
  const [success, repeated] = await Promise.all([send("payments/complete", complete), send("payments/complete", complete)]);
  assert.equal(success.payment.status, "succeeded");
  assert.equal(success.payment.paymentId, repeated.payment.paymentId);
  assert.match(success.payment.paymentId, /^demo_pay_/);
  const reopen = (await send("payments/order", access)).order;
  assert.equal(reopen.id, successOrder.id);
  assert.equal(reopen.status, "succeeded");

  const rows = (await client.query("SELECT * FROM public.bbc_payment_attempts WHERE registration_id = $1 ORDER BY created_at", [registration.id])).rows;
  assert.deepEqual(rows.map((row) => row.status), ["cancelled", "failed", "succeeded"]);
  assert.ok(rows.every((row) => row.mode === "demo" && row.amount_paise === 4071000 && row.completed_at));
  assert.equal((await client.query("SELECT payment_status FROM public.bbc_event_registrations WHERE id = $1", [registration.id])).rows[0].payment_status, "unpaid");
  console.log("PASS: success and retries persist exactly once, attempt history is stored, and real payment status remains unpaid.");
} finally {
  const removed = await client.query("DELETE FROM public.bbc_event_registrations WHERE submission_id = $1 AND email = $2", [submissionId, email]).catch(() => null);
  if (removed) console.log(`Removed ${removed.rowCount} synthetic registration and its payment attempts.`);
  await client.end();
}
