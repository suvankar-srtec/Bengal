import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "./db";
import type { CheckoutOrder, PaymentAttempt, PaymentMode } from "./payment-types";

const accessSchema = z.object({
  registrationId: z.uuid(),
  submissionId: z.uuid(),
});

const completionSchema = accessSchema.extend({
  attemptId: z.uuid(),
  outcome: z.enum(["succeeded", "failed", "cancelled"]).optional(),
  method: z.enum(["upi", "card", "netbanking"]).optional(),
});

type AttemptRow = {
  id: string;
  mode: PaymentMode;
  provider_order_id: string;
  provider_payment_id: string | null;
  amount_paise: number;
  status: PaymentAttempt["status"];
  method: string | null;
};

class PaymentError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function serialize(row: AttemptRow): PaymentAttempt {
  return {
    id: row.id,
    mode: row.mode,
    orderId: row.provider_order_id,
    paymentId: row.provider_payment_id,
    amountPaise: row.amount_paise,
    status: row.status,
    method: row.method,
  };
}

function upiConfiguration() {
  const upiId = String(process.env.PAYMENT_UPI_ID || "").trim();
  const payeeName = String(process.env.PAYMENT_PAYEE_NAME || "Bengal Business Council").trim();

  if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(upiId)) {
    throw new PaymentError(
      "Payment UPI ID is not configured. Add PAYMENT_UPI_ID in the server environment.",
      503,
    );
  }

  return {
    upiId,
    payeeName: payeeName.slice(0, 80) || "Bengal Business Council",
  };
}

function buildUpiPaymentUri(amountPaise: number) {
  const { upiId, payeeName } = upiConfiguration();
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
  });

  return `upi://pay?${params.toString()}`;
}

async function requestBody(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let valid = false;
    try {
      const url = new URL(origin);
      valid = ["http:", "https:"].includes(url.protocol)
        && url.host === request.headers.get("host");
    } catch {}
    if (!valid) throw new PaymentError("Please use payment on this website.", 403);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new PaymentError("Use a JSON request.", 415);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new PaymentError("Missing payment request.");

  const chunks: Uint8Array[] = [];
  let length = 0;

  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > 8192) {
      await reader.cancel();
      throw new PaymentError("Payment request is too large.", 413);
    }
    chunks.push(part.value);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PaymentError("Invalid payment request.");
  }
}

export async function paymentHandler(request: Request, action: "order" | "complete") {
  try {
    const body = await requestBody(request);
    const result = action === "order"
      ? await createOrder(body)
      : await completePayment(body);

    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Check the payment request and try again." },
        { status: 400 },
      );
    }

    if (error instanceof PaymentError) {
      return Response.json(
        { error: error.message },
        {
          status: error.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    console.error("UPI payment request failed.", error);
    return Response.json(
      { error: "We couldn’t prepare the payment QR. Please retry; your registration is saved." },
      { status: 503 },
    );
  }
}

async function createOrder(body: unknown): Promise<{ order: CheckoutOrder }> {
  const data = accessSchema.parse(body);
  const mode: PaymentMode = "demo";
  const client = await getDatabase().connect();

  try {
    await client.query("BEGIN");

    const registration = (
      await client.query<{ total_paise: number }>(
        `SELECT total_paise
         FROM public.bbc_event_registrations
         WHERE id = $1 AND submission_id = $2
         FOR UPDATE`,
        [data.registrationId, data.submissionId],
      )
    ).rows[0];

    if (!registration) {
      throw new PaymentError(
        "Registration not found. Please use your own registration confirmation.",
        404,
      );
    }

    // Validate the configured UPI destination before creating/reusing an attempt.
    const paymentUri = buildUpiPaymentUri(registration.total_paise);

    let attempt = (
      await client.query<AttemptRow>(
        `SELECT *
         FROM public.bbc_payment_attempts
         WHERE registration_id = $1
           AND mode = $2
           AND status IN ('created', 'succeeded')`,
        [data.registrationId, mode],
      )
    ).rows[0];

    if (attempt?.status === "succeeded") {
      await client.query(
        "UPDATE public.bbc_event_registrations SET payment_status = 'paid' WHERE id = $1",
        [data.registrationId],
      );
    }

    if (!attempt) {
      const id = randomUUID();
      const orderId = `upi_order_${id.replaceAll("-", "")}`;

      attempt = (
        await client.query<AttemptRow>(
          `INSERT INTO public.bbc_payment_attempts
            (id, registration_id, mode, provider_order_id, amount_paise)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [id, data.registrationId, mode, orderId, registration.total_paise],
        )
      ).rows[0];
    }

    await client.query("COMMIT");

    return {
      order: {
        ...serialize(attempt),
        paymentUri,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completePayment(body: unknown): Promise<{ payment: PaymentAttempt }> {
  const data = completionSchema.parse(body);
  const client = await getDatabase().connect();

  try {
    await client.query("BEGIN");

    const row = (
      await client.query<AttemptRow>(
        `SELECT p.*
         FROM public.bbc_payment_attempts p
         JOIN public.bbc_event_registrations r ON r.id = p.registration_id
         WHERE p.id = $1
           AND r.id = $2
           AND r.submission_id = $3
         FOR UPDATE OF p`,
        [data.attemptId, data.registrationId, data.submissionId],
      )
    ).rows[0];

    if (!row) {
      throw new PaymentError("Payment attempt not found.", 404);
    }

    if (!data.outcome || !data.method) {
      throw new PaymentError("Payment result is missing.");
    }

    const status = data.outcome;
    const method = data.method;
    const paymentId = status === "succeeded"
      ? (row.provider_payment_id ?? `upi_manual_${randomUUID().replaceAll("-", "")}`)
      : null;

    if (row.status !== "created") {
      if (
        row.status !== status
        || row.method !== method
        || row.provider_payment_id !== paymentId
      ) {
        throw new PaymentError(
          "This payment attempt already has a different result.",
          409,
        );
      }

      if (row.status === "succeeded") {
        await client.query(
          "UPDATE public.bbc_event_registrations SET payment_status = 'paid' WHERE id = $1",
          [data.registrationId],
        );
      }

      await client.query("COMMIT");
      return { payment: serialize(row) };
    }

    const completed = (
      await client.query<AttemptRow>(
        `UPDATE public.bbc_payment_attempts
         SET status = $2,
             method = $3,
             provider_payment_id = $4,
             completed_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [row.id, status, method, paymentId],
      )
    ).rows[0];

    if (status === "succeeded") {
      await client.query(
        "UPDATE public.bbc_event_registrations SET payment_status = 'paid' WHERE id = $1",
        [data.registrationId],
      );
    }

    await client.query("COMMIT");
    return { payment: serialize(completed) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
