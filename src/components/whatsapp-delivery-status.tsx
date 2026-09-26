"use client";

import { useEffect, useState } from "react";

type Status = { status: "pending" | "sending" | "accepted" | "failed" | "unknown"; canRetry: boolean; retryAfterSeconds: number };

export function WhatsAppDeliveryStatus({ registrationId, submissionId }: { registrationId: string; submissionId: string }) {
  const [delivery, setDelivery] = useState<Status | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [checkFailed, setCheckFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    setCheckFailed(false);
    async function check() {
      try {
        const response = await fetch("/api/passes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId, submissionId, retry: retryKey > 0 && count === 0 }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error("Status unavailable");
        const result = await response.json();
        if (controller.signal.aborted) return;
        setDelivery(result.whatsapp);
        count += 1;
        const status: Status = result.whatsapp;
        if (count < 30 && (status.status === "pending" || status.status === "sending"
          || (status.status === "failed" && status.canRetry && status.retryAfterSeconds > 0)
          || (retryKey > 0 && count === 1))) {
          timer = setTimeout(check, 5000);
        }
      } catch {
        if (!controller.signal.aborted) setCheckFailed(true);
      }
    }
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [registrationId, submissionId, retryKey]);

  let message = "Preparing your passes for WhatsApp…";
  if (checkFailed) message = "WhatsApp status is unavailable. You can still download your passes below.";
  else if (delivery?.status === "accepted") message = "Your passes have been queued on WhatsApp for the number you registered.";
  else if (delivery?.status === "failed") message = "WhatsApp delivery could not be completed. You can download your passes below.";
  else if (delivery?.status === "unknown") message = "We could not confirm WhatsApp delivery. Please check your messages or download your passes below.";
  else if (delivery?.status === "sending") message = "Sending your passes to WhatsApp…";

  return <div className="whatsapp-delivery-status">
    <p role="status" aria-live="polite">{message}</p>
    {delivery?.status === "failed" && delivery.canRetry && <button type="button"
      disabled={delivery.retryAfterSeconds > 0}
      onClick={() => { setDelivery(null); setRetryKey((value) => value + 1); }}>
      {delivery.retryAfterSeconds > 0 ? "Please wait a minute before retrying" : "Retry WhatsApp delivery"}
    </button>}
    {checkFailed && <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Check WhatsApp status</button>}
  </div>;
}
