"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney, type RegistrationReceipt } from "@/lib/registration";

type Review = {
  id: string;
  status: "pending" | "approved" | "rejected";
  method: "cash" | "bank";
  note: string;
};

export function RegistrationPayment({
  receipt,
  submissionId,
  onReset,
}: {
  receipt: RegistrationReceipt;
  submissionId: string;
  onReset: () => void;
}) {
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [file, setFile] = useState<File | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef("");
  const locked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/registration-payments/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId: receipt.id, submissionId }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not check payment status.");
    setReview(result.review);
    if (result.review?.status === "rejected") requestId.current = "";
  }, [receipt.id, submissionId]);

  useEffect(() => {
    heading.current?.focus();
    void refresh().catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (review?.status !== "pending" && review?.status !== "approved") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [review?.status, refresh]);

  async function submit() {
    if (locked.current) return;
    if (method === "bank" && !file) {
      setError("Upload your bank transfer receipt.");
      return;
    }

    const normalizedTransactionId = transactionId.trim();
    if (method === "bank" && !/^[A-Za-z0-9._\/-]{4,100}$/.test(normalizedTransactionId)) {
      setError("Enter the transaction ID used for this bank transfer.");
      return;
    }

    if (file && file.size > 3 * 1024 * 1024) {
      setError("The receipt must be 3 MB or smaller.");
      return;
    }

    locked.current = true;
    setBusy(true);
    setError("");
    requestId.current ||= crypto.randomUUID();

    const form = new FormData();
    form.set("registrationId", receipt.id);
    form.set("submissionId", submissionId);
    form.set("requestId", requestId.current);
    form.set("method", method);
    if (method === "bank") form.set("transactionId", normalizedTransactionId);
    if (method === "bank" && file) form.set("receipt", file);

    try {
      const response = await fetch("/api/registration-payments", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment request could not be saved.");
      setReview(result.review);
      setFile(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  const waiting = review?.status === "pending";
  const approved = review?.status === "approved";

  return (
    <section className="registration-card payment-choice-card" aria-labelledby="payment-heading">
      <span className="eyebrow">REGISTRATION SAVED</span>
      <h2 id="payment-heading" ref={heading} tabIndex={-1}>
        {approved ? "Payment approved" : waiting ? "Awaiting payment approval" : "Registration successful"}
      </h2>

      <p className="payment-reference">Reference: {receipt.reference}</p>
      <div className="total-row">
        <span>Total amount</span>
        <strong>{formatMoney(receipt.totalPaise)}</strong>
      </div>

      {loading ? (
        <p role="status">Checking payment status...</p>
      ) : approved ? (
        <div role="status">
          <p>Your payment has been approved.</p>
          <p>
            A private photo-upload link is sent to each participant through their registered WhatsApp number and email address.
            Upload the photo from that link to generate the QR pass.
          </p>
        </div>
      ) : waiting ? (
        <div role="status">
          <p>
            {review?.method === "bank"
              ? "Your bank receipt and transaction ID have been submitted for review."
              : "Your cash payment request has been submitted for review."}
          </p>
          <p>
            {review?.method === "bank"
              ? "Your registration remains unpaid until the admin confirms the last 4 characters of the transaction ID."
              : "Your registration remains unpaid until the admin confirms that the cash payment was received."}
          </p>
        </div>
      ) : (
        <>
          {review?.status === "rejected" && (
            <div className="error-banner" role="alert">
              Payment was not approved: {review.note}. You may submit a corrected request below.
            </div>
          )}

          <p>Choose how you would like to pay.</p>

          <fieldset className="payment-methods" disabled={busy}>
            <legend className="sr-only">Payment method</legend>
            {(["cash", "bank"] as const).map((value) => (
              <label key={value} className={method === value ? "selected" : ""}>
                <input
                  type="radio"
                  name="payment-method"
                  checked={method === value}
                  onChange={() => {
                    setMethod(value);
                    requestId.current = "";
                    setError("");
                  }}
                />
                {value === "cash" ? "Cash" : "Bank transfer"}
              </label>
            ))}
            <label className="unavailable">
              <input type="radio" name="payment-method" disabled />
              Razorpay
              <small>Not available yet</small>
            </label>
          </fieldset>

          {method === "bank" ? (
            <>
              <div className="field">
                <label htmlFor="payment-transaction-id">Transaction ID *</label>
                <input
                  id="payment-transaction-id"
                  type="text"
                  value={transactionId}
                  maxLength={100}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(event) => {
                    setTransactionId(event.target.value);
                    requestId.current = "";
                    setError("");
                  }}
                  placeholder="Enter the bank transaction ID"
                />
                <span className="field-hint">
                  The admin confirms the bank transfer by entering the last 4 characters of this transaction ID.
                </span>
              </div>
              <div className="field receipt-upload">
              <label htmlFor="bank-receipt">Bank transfer receipt *</label>
              <p>Transfer the amount using the bank details provided by the organizer, then upload your receipt.</p>
              <input
                id="bank-receipt"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                disabled={busy}
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  requestId.current = "";
                }}
              />
              <span className="field-hint">JPG, PNG or PDF. Maximum 3 MB. Only admins can view your receipt.</span>
              </div>
            </>
          ) : (
            <p>Pay the organizer in cash. The admin will confirm the cash receipt directly; no transaction ID is required.</p>
          )}

          <button className="submit-button" type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Saving..." : method === "bank" ? "Submit receipt for approval" : "Confirm cash payment choice"}
          </button>
        </>
      )}

      {error && <p className="error-banner" role="alert">{error}</p>}

      {!loading && (
        <button
          type="button"
          className="new-registration"
          disabled={busy}
          onClick={() => {
            setError("");
            void refresh().catch((reason) => setError(reason.message));
          }}
        >
          Refresh payment status
        </button>
      )}

      <button type="button" className="new-registration" disabled={busy} onClick={onReset}>
        Register another member
      </button>
    </section>
  );
}
