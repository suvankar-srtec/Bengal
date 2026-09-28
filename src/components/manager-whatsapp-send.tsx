"use client";

import { useState } from "react";

export function ManagerWhatsAppSend({ registrationId }: { registrationId: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  async function send() {
    if (sending || sent) return;
    setSending(true);
    setMessage("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/send-registration-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "WhatsApp could not send the passes.");
        return;
      }

      setSent(true);
      setSuccess(
        data.alreadySent
          ? "WhatsApp passes were already sent successfully."
          : "WhatsApp passes sent successfully."
      );
    } catch {
      setMessage("WhatsApp could not send the passes. Please retry.");
    } finally {
      setSending(false);
    }
  }

  return <>
    <button
      type="button"
      className="manager-report-whatsapp-button"
      disabled={sending || sent}
      onClick={() => void send()}
    >
      {sent ? "Sent" : sending ? "Sending…" : "Send WhatsApp"}
    </button>

    {message && <small className="manager-report-whatsapp-error">{message}</small>}

    {success && <div className="admin-upload-whatsapp-success-backdrop" role="dialog" aria-modal="true" aria-labelledby={"manager-whatsapp-success-" + registrationId}>
      <div className="admin-upload-whatsapp-success-modal">
        <div className="admin-upload-whatsapp-success-icon" aria-hidden="true">✓</div>
        <h2 id={"manager-whatsapp-success-" + registrationId}>Success</h2>
        <p>{success}</p>
        <button type="button" onClick={() => setSuccess("")}>OK</button>
      </div>
    </div>}
  </>;
}
