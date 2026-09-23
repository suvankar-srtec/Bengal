import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "./db";
import { paymentConfiguration, verifyPaymentSignature } from "./payment-security";
import type { CheckoutOrder, PaymentAttempt, PaymentMode } from "./payment-types";

const accessSchema = z.object({ registrationId: z.uuid(), submissionId: z.uuid() });
const completionSchema = accessSchema.extend({
  attemptId: z.uuid(),
  outcome: z.enum(["succeeded", "failed", "cancelled"]).optional(),
  method: z.enum(["upi", "card", "netbanking"]).optional(),
  razorpay_order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/).optional(),
  razorpay_payment_id: z.string().regex(/^pay_[a-zA-Z0-9]+$/).optional(),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});

type AttemptRow = {
  id: string; mode: PaymentMode; provider_order_id: string; provider_payment_id: string | null;
  amount_paise: number; status: PaymentAttempt["status"]; method: string | null;
};

class PaymentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function serialize(row: AttemptRow): PaymentAttempt {
  return { id: row.id, mode: row.mode, orderId: row.provider_order_id, paymentId: row.provider_payment_id,
    amountPaise: row.amount_paise, status: row.status, method: row.method };
}

function configuration() {
  try { return paymentConfiguration(process.env); }
  catch { throw new PaymentError("Payment demo configuration is incomplete. Check the server’s test-mode settings.", 503); }
}

async function razorpayRequest(path: string, body?: Record<string, unknown>) {
  const { keyId, secret } = configuration();
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new PaymentError("Razorpay Test Mode could not complete this request. Please retry.", 502);
  return response.json();
}

async function requestBody(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let valid = false;
    try { const url = new URL(origin); valid = ["http:", "https:"].includes(url.protocol) && url.host === request.headers.get("host"); } catch {}
    if (!valid) throw new PaymentError("Please use checkout on this website.", 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new PaymentError("Use a JSON request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new PaymentError("Missing payment request.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > 8192) { await reader.cancel(); throw new PaymentError("Payment request is too large.", 413); }
    chunks.push(part.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new PaymentError("Invalid payment request."); }
}

export async function paymentHandler(request: Request, action: "order" | "complete") {
  try {
    const body = await requestBody(request);
    const result = action === "order" ? await createOrder(body) : await completePayment(body);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Check the payment request and try again." }, { status: 400 });
    if (error instanceof PaymentError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    console.error("Payment demo request failed.");
    return Response.json({ error: "We couldn’t save the payment attempt. Please retry; your registration is saved." }, { status: 503 });
  }
}

async function createOrder(body: unknown): Promise<{ order: CheckoutOrder }> {
  const data = accessSchema.parse(body);
  const config = configuration();
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    const registration = (await client.query<{ total_paise: number }>(
      "SELECT total_paise FROM public.bbc_event_registrations WHERE id = $1 AND submission_id = $2 FOR UPDATE",
      [data.registrationId, data.submissionId])).rows[0];
    if (!registration) throw new PaymentError("Registration not found. Please use your own registration confirmation.", 404);
    let attempt = (await client.query<AttemptRow>(
      "SELECT * FROM public.bbc_payment_attempts WHERE registration_id = $1 AND mode = $2 AND status IN ('created', 'succeeded')",
      [data.registrationId, config.mode])).rows[0];
    if (attempt?.status === "succeeded") {
      await client.query("UPDATE public.bbc_event_registrations SET payment_status = 'paid' WHERE id = $1", [data.registrationId]);
    }
    if (!attempt) {
      const id = randomUUID();
      let orderId = `demo_order_${id.replaceAll("-", "")}`;
      if (config.mode === "razorpay_test") {
        const order = await razorpayRequest("orders", { amount: registration.total_paise, currency: "INR", receipt: id });
        if (!/^order_[a-zA-Z0-9]+$/.test(order.id) || order.amount !== registration.total_paise || order.currency !== "INR") {
          throw new PaymentError("The test order did not match this registration.", 502);
        }
        orderId = order.id;
      }
      attempt = (await client.query<AttemptRow>(
        `INSERT INTO public.bbc_payment_attempts (id, registration_id, mode, provider_order_id, amount_paise)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, data.registrationId, config.mode, orderId, registration.total_paise])).rows[0];
    }
    await client.query("COMMIT");
    return { order: { ...serialize(attempt), ...(config.mode === "razorpay_test" ? { keyId: config.keyId } : {}) } };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function completePayment(body: unknown): Promise<{ payment: PaymentAttempt }> {
  const data = completionSchema.parse(body);
  const config = configuration();
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    const row = (await client.query<AttemptRow>(
      `SELECT p.* FROM public.bbc_payment_attempts p JOIN public.bbc_event_registrations r ON r.id = p.registration_id
       WHERE p.id = $1 AND r.id = $2 AND r.submission_id = $3 FOR UPDATE OF p`,
      [data.attemptId, data.registrationId, data.submissionId])).rows[0];
    if (!row) throw new PaymentError("Payment attempt not found.", 404);
    if (row.mode !== config.mode) throw new PaymentError("Payment mode changed. Start checkout again.", 409);

    let status: PaymentAttempt["status"];
    let method: string;
    let paymentId: string | null;
    if (row.mode === "demo") {
      if (!data.outcome || !data.method) throw new PaymentError("Choose a demo payment result.");
      status = data.outcome;
      method = data.method;
      paymentId = status === "succeeded" ? (row.provider_payment_id ?? `demo_pay_${randomUUID().replaceAll("-", "")}`) : null;
    } else {
      if (!data.razorpay_order_id || !data.razorpay_payment_id || !data.razorpay_signature
        || data.razorpay_order_id !== row.provider_order_id
        || !verifyPaymentSignature(row.provider_order_id, data.razorpay_payment_id, data.razorpay_signature, config.secret)) {
        throw new PaymentError("The Razorpay test payment signature could not be verified.");
      }
      const payment = await razorpayRequest(`payments/${data.razorpay_payment_id}`);
      if (payment.order_id !== row.provider_order_id || payment.amount !== row.amount_paise || payment.currency !== "INR") {
        throw new PaymentError("The test payment does not match this order.");
      }
      if (payment.status !== "captured" || payment.captured !== true) {
        throw new PaymentError("The test payment is not captured yet. Retry verification shortly.", 409);
      }
      status = "succeeded";
      method = typeof payment.method === "string" ? payment.method.slice(0, 32) : "unknown";
      paymentId = data.razorpay_payment_id;
    }

    if (row.status !== "created") {
      if (row.status !== status || row.method !== method || row.provider_payment_id !== paymentId) {
        throw new PaymentError("This attempt already has a different result. Start a new checkout to retry.", 409);
      }
      if (row.status === "succeeded") {
        await client.query("UPDATE public.bbc_event_registrations SET payment_status = 'paid' WHERE id = $1", [data.registrationId]);
      }
      await client.query("COMMIT");
      return { payment: serialize(row) };
    }
    const completed = (await client.query<AttemptRow>(
      `UPDATE public.bbc_payment_attempts SET status = $2, method = $3, provider_payment_id = $4, completed_at = NOW()
       WHERE id = $1 RETURNING *`, [row.id, status, method, paymentId])).rows[0];
    if (status === "succeeded") {
      await client.query("UPDATE public.bbc_event_registrations SET payment_status = 'paid' WHERE id = $1", [data.registrationId]);
    }
    await client.query("COMMIT");
    return { payment: serialize(completed) };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
