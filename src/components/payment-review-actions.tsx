"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshNotificationStatus } from "./notification-status";

export function PaymentReviewActions({
  id,
  registrationId,
  status,
  method,
}: {
  id: string;
  registrationId: string;
  status: string;
  method: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirmationSuffix, setConfirmationSuffix] = useState("");
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const bankTransfer = method === "bank";

  async function act(decision: "approved" | "rejected" | "retry") {
    if (locked.current) return;

    if (
      decision === "approved" &&
      bankTransfer &&
      !/^[A-Za-z0-9]{4}$/.test(confirmationSuffix.trim())
    ) {
      setMessage("Enter the last 4 characters of the transaction ID.");
      return;
    }

    if (decision === "rejected" && !note.trim()) {
      setMessage("Enter a reason for rejecting this payment.");
      return;
    }

    locked.current = true;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        decision === "retry"
          ? "/api/admin/send-registration-whatsapp"
          : `/api/admin/payment-reviews/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            decision === "retry"
              ? { registrationId }
              : {
                  decision,
                  note,
                  confirmationSuffix:
                    decision === "approved" && bankTransfer
                      ? confirmationSuffix.trim().toUpperCase()
                      : undefined,
                },
          ),
          signal: AbortSignal.timeout(55000),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The request failed.");

      if (decision === "retry") {
        setMessage(result.message);
      } else if (decision === "approved") {
        const delivery = result.photoDelivery;
        setMessage(
          delivery
            ? `Payment approved. Photo link sent — WhatsApp ${delivery.whatsapp_sent}/${delivery.total}, Email ${delivery.email_sent}/${delivery.total}.`
            : "Payment approved. Participant photo links are being sent.",
        );
      } else {
        setMessage("Payment rejected; registration remains unpaid.");
      }

      void refreshNotificationStatus();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please retry.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="payment-review-actions">
      {status === "pending" && (
        <>
          {bankTransfer && (
            <>
              <label className="sr-only" htmlFor={`transaction-last4-${id}`}>
                Last 4 characters of transaction ID
              </label>
              <input
                id={`transaction-last4-${id}`}
                value={confirmationSuffix}
                onChange={(event) =>
                  setConfirmationSuffix(
                    event.target.value
                      .replace(/[^A-Za-z0-9]/g, "")
                      .slice(0, 4)
                      .toUpperCase(),
                  )
                }
                placeholder="Last 4 of transaction ID"
                maxLength={4}
                autoComplete="off"
                disabled={busy}
              />
            </>
          )}

          <label className="sr-only" htmlFor={`review-note-${id}`}>
            Review note or rejection reason
          </label>
          <input
            id={`review-note-${id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note / rejection reason"
            maxLength={500}
            disabled={busy}
          />

          <button
            type="button"
            className="payment-approve"
            disabled={busy}
            onClick={() => void act("approved")}
          >
            {busy
              ? "Please wait..."
              : bankTransfer
                ? "Confirm bank payment & request photos"
                : "Confirm cash & request photos"}
          </button>

          <button type="button" disabled={busy} onClick={() => void act("rejected")}>
            Reject
          </button>
        </>
      )}

      {status === "approved" && (
        <button type="button" disabled={busy} onClick={() => void act("retry")}>
          {busy ? "Sending..." : "Retry photo-link delivery"}
        </button>
      )}

      {message && <p role="status">{message}</p>}
    </div>
  );
}
