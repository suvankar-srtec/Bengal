import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const submissionId = randomUUID();
const email = `bbc-integration-${submissionId}@example.com`;
const payload = {
  submissionId, memberName: "Automated verification — remove after test", email,
  phone: "9000000000", billingDetails: "ABCDE1234F",
  additionalParticipantNames: ["  Second Test Participant  "],
  participationQuantity: 2, standeeQuantity: 1, presentationSelected: true,
  totalPaise: 1, paymentStatus: "paid",
};
const connection = new URL(process.env.DATABASE_URL);
connection.searchParams.set("sslmode", "verify-full");
const client = new pg.Client({ connectionString: connection.toString(), enableChannelBinding: true, connectionTimeoutMillis: 15000 });
const send = (body, headers = {}) => fetch(`${base}/api/registrations`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...headers },
  body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
});

try {
  await client.connect();
  const invalid = await send({ ...payload, phone: "12", participationQuantity: -1 });
  assert.equal(invalid.status, 400);
  assert.ok((await invalid.json()).fields.phone);
  const missingName = await send({ ...payload, additionalParticipantNames: [""] });
  assert.equal(missingName.status, 400);
  assert.ok((await missingName.json()).fields.participantName2);
  const missingNames = await send({ ...payload, additionalParticipantNames: [] });
  assert.equal(missingNames.status, 400);
  const wrongOrigin = await send(payload, { Origin: "https://unrelated.example" });
  assert.equal(wrongOrigin.status, 403);
  const oversize = await send({ ...payload, unexpected: "x".repeat(20000) });
  assert.equal(oversize.status, 413);
  console.log("PASS: invalid fields, quantities, foreign origins, and oversized requests are rejected.");

  const responses = await Promise.all([send(payload), send(payload)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  const [first, retry] = await Promise.all(responses.map((response) => response.json()));
  assert.equal(first.registration.id, retry.registration.id);
  assert.equal(first.registration.totalPaise, 4071000);
  assert.equal(first.registration.paymentStatus, "unpaid");
  const result = await client.query("SELECT * FROM public.bbc_event_registrations WHERE submission_id = $1", [submissionId]);
  assert.equal(result.rowCount, 1);
  const row = result.rows[0];
  assert.equal(row.member_name, payload.memberName);
  assert.deepEqual(row.participant_names, [payload.memberName, "Second Test Participant"]);
  assert.equal(row.email, email);
  assert.equal(row.phone, payload.phone);
  assert.equal(row.phone_country_code, "+91");
  assert.equal(row.billing_details, payload.billingDetails);
  assert.equal(row.participation_quantity, 2);
  assert.equal(row.standee_quantity, 1);
  assert.equal(row.presentation_selected, true);
  assert.equal(row.total_paise, 4071000);
  assert.equal(row.payment_status, "unpaid");
  assert.equal(row.event_id, "aalap-alochona-2026-09-29");
  assert.ok(row.created_at);
  console.log("PASS: every form field is persisted, amounts are calculated on the server, and concurrent retries create one record.");

  const conflict = await send({ ...payload, memberName: "Changed Member" });
  assert.equal(conflict.status, 409);
  const noRead = await fetch(`${base}/api/registrations`);
  assert.equal(noRead.status, 405);
  console.log("PASS: changed duplicate submissions are rejected; the endpoint does not expose registration data.");
} finally {
  // Delete only this run's synthetic record, identified by both unique key and email.
  const cleanup = await client.query("DELETE FROM public.bbc_event_registrations WHERE submission_id = $1 AND email = $2", [submissionId, email]).catch(() => null);
  if (cleanup) console.log(`Cleaned up ${cleanup.rowCount} synthetic test registration.`);
  await client.end();
}
