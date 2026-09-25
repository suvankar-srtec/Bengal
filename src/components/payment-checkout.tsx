"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney, type RegistrationReceipt } from "@/lib/registration";
import type { CheckoutOrder, PaymentAttempt } from "@/lib/payment-types";
import { Icon } from "./icon";

async function api<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/payments/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Payment could not continue. Please try again.");
  return result as T;
}

function errorText(error: unknown) {
  return error instanceof Error && !["TypeError", "TimeoutError"].includes(error.name)
    ? error.message
    : "The connection was interrupted. Please retry; your registration is already saved.";
}

export function PaymentCheckout({
  registration,
  submissionId,
  onPaid,
  autoStart = false,
}: {
  registration: RegistrationReceipt;
  submissionId: string;
  member: { memberName: string; email: string; phone: string };
  onPaid: () => void;
  autoStart?: boolean;
}) {
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  const access = {
    registrationId: registration.id,
    submissionId,
  };

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void preparePaymentQr();
  }, [autoStart]);

  async function preparePaymentQr() {
    setBusy(true);
    setError("");

    try {
      const [{ order: checkoutOrder }, QRCode] = await Promise.all([
        api<{ order: CheckoutOrder }>("order", access),
        import("qrcode").then((module) => module.default),
      ]);

      if (checkoutOrder.status === "succeeded") {
        onPaid();
        return;
      }

      if (!checkoutOrder.paymentUri?.startsWith("upi://pay?")) {
        throw new Error("UPI payment QR is not configured.");
      }

      const image = await QRCode.toDataURL(checkoutOrder.paymentUri, {
        width: 520,
        margin: 2,
        errorCorrectionLevel: "M",
      });

      setOrder(checkoutOrder);
      setQrUrl(image);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment() {
    if (!order || busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await api<{ payment: PaymentAttempt }>("complete", {
        ...access,
        attemptId: order.id,
        outcome: "succeeded",
        method: "upi",
      });

      if (response.payment.status !== "succeeded") {
        throw new Error("Payment could not be confirmed. Please try again.");
      }

      onPaid();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return <section className="payment-qr-panel" aria-label="Payment QR">
    <div className="payment-qr-heading">
      <span className="eyebrow">PAYMENT QR</span>
      <h3>Scan to pay</h3>
      <p>Scan with your phone camera or any UPI app. Compatible phones can open installed payment apps such as Google Pay, PhonePe, Paytm, BHIM, or your bank’s UPI app.</p>
    </div>

    <div className="payment-qr-amount">
      <span>Total amount</span>
      <strong>{formatMoney(registration.totalPaise)}</strong>
    </div>

    {busy && !qrUrl && <div className="payment-qr-loading" role="status">
      <span className="qr-loader" aria-hidden="true" />
      <span>Generating payment QR…</span>
    </div>}

    {qrUrl && <div className="payment-qr-image-wrap">
      <img src={qrUrl} alt={`Payment QR for ${formatMoney(registration.totalPaise)}`} />
    </div>}

    {error && <div className="error-banner" role="alert">{error}</div>}

    {!qrUrl && !busy && <button className="submit-button" type="button" onClick={() => void preparePaymentQr()}>
      Generate payment QR
    </button>}

    {qrUrl && <button className="submit-button payment-qr-confirm" type="button" disabled={busy} onClick={() => void confirmPayment()}>
      {busy ? <><span className="spinner" /> Confirming…</> : <><Icon name="check" size={18} /> Confirm payment received</>}
    </button>}

    <p className="payment-qr-note">
      After the payment is received, confirm it here to generate the participant pass or passes.
    </p>
  </section>;
}
