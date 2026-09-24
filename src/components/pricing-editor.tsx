"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type ParticipationPrices } from "@/lib/registration";

function rupees(paise: number) {
  return (paise / 100).toFixed(2);
}

function toPaise(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function PricingEditor({
  eventId,
  eventTitle,
  initial,
}: {
  eventId: number;
  eventTitle: string;
  initial: ParticipationPrices;
}) {
  const router = useRouter();
  const [participation, setParticipation] = useState(rupees(initial.participation));
  const [standee, setStandee] = useState(rupees(initial.standee));
  const [presentation, setPresentation] = useState(rupees(initial.presentation));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const participationPaise = toPaise(participation);
    const standeePaise = toPaise(standee);
    const presentationPaise = toPaise(presentation);

    if (participationPaise === null || standeePaise === null || presentationPaise === null) {
      setMessage({ type: "error", text: "Enter valid amounts of zero or more." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/event-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          participationPaise,
          standeePaise,
          presentationPaise,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Couldn’t save pricing.");

      setMessage({
        type: "success",
        text: "Pricing saved. The registration form now uses these amounts.",
      });
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Couldn’t save pricing.",
      });
    } finally {
      setSaving(false);
    }
  }

  return <form className="pricing-editor-card" onSubmit={save}>
    <div className="pricing-editor-heading">
      <div>
        <span>YOUR PARTICIPATION</span>
        <h2>{eventTitle}</h2>
        <p>Edit the amounts displayed and charged on this event’s registration form.</p>
      </div>
      <a href={`/register?id=${eventId}`}>Open registration</a>
    </div>

    <div className="pricing-fields">
      <label>
        <span>Participation fee <small>per person</small></span>
        <div className="pricing-money-input"><span>₹</span><input type="number" min="0" step="0.01" value={participation} onChange={(event) => setParticipation(event.target.value)} required /></div>
        <small>Current: {formatMoney(initial.participation)}</small>
      </label>

      <label>
        <span>Standee placement <small>per standee</small></span>
        <div className="pricing-money-input"><span>₹</span><input type="number" min="0" step="0.01" value={standee} onChange={(event) => setStandee(event.target.value)} required /></div>
        <small>Current: {formatMoney(initial.standee)}</small>
      </label>

      <label>
        <span>Company presentation <small>per presentation</small></span>
        <div className="pricing-money-input"><span>₹</span><input type="number" min="0" step="0.01" value={presentation} onChange={(event) => setPresentation(event.target.value)} required /></div>
        <small>Current: {formatMoney(initial.presentation)}</small>
      </label>
    </div>

    {message && <div className={`pricing-message ${message.type}`} role="status">{message.text}</div>}

    <div className="pricing-editor-actions">
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save pricing"}</button>
    </div>
  </form>;
}
