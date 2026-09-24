"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, mealChoiceLabel, type MealChoice, type ParticipationPrices } from "@/lib/registration";

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
  const [mealOption, setMealOption] = useState<MealChoice>(initial.mealOption);
  const [snacks, setSnacks] = useState(rupees(initial.snacks));
  const [lunch, setLunch] = useState(rupees(initial.lunch));
  const [dinner, setDinner] = useState(rupees(initial.dinner));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const participationPaise = toPaise(participation);
    const standeePaise = toPaise(standee);
    const presentationPaise = toPaise(presentation);
    const snacksPaise = toPaise(snacks);
    const lunchPaise = toPaise(lunch);
    const dinnerPaise = toPaise(dinner);

    if (
      participationPaise === null ||
      standeePaise === null ||
      presentationPaise === null ||
      snacksPaise === null ||
      lunchPaise === null ||
      dinnerPaise === null
    ) {
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
          mealOption,
          snacksPaise,
          lunchPaise,
          dinnerPaise,
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

    <div className="pricing-meal-section">
      <div className="pricing-meal-heading">
        <div>
          <span>MEAL PREFERENCE</span>
          <h3>Choose one meal option for this event</h3>
          <p>Only the selected option will appear on the registration form. Guests may select it or leave it unselected.</p>
        </div>
      </div>

      <div className="pricing-meal-grid">
        {([
          { key: "snacks" as const, label: "Snacks", value: snacks, setValue: setSnacks, current: initial.snacks },
          { key: "lunch" as const, label: "Lunch", value: lunch, setValue: setLunch, current: initial.lunch },
          { key: "dinner" as const, label: "Dinner", value: dinner, setValue: setDinner, current: initial.dinner },
        ]).map((item) => <label className={`pricing-meal-card${mealOption === item.key ? " selected" : ""}`} key={item.key}>
          <div className="pricing-meal-card-title">
            <input
              type="checkbox"
              checked={mealOption === item.key}
              onChange={() => setMealOption(item.key)}
              aria-label={`Use ${item.label} for this event`}
            />
            <strong>{item.label}</strong>
          </div>
          <div className="pricing-money-input"><span>₹</span><input type="number" min="0" step="0.01" value={item.value} onChange={(event) => item.setValue(event.target.value)} required /></div>
          <small>Current: {formatMoney(item.current)}</small>
        </label>)}
      </div>

      <div className="pricing-active-meal">Active option: <strong>{mealChoiceLabel(mealOption)}</strong></div>
    </div>

    {message && <div className={`pricing-message ${message.type}`} role="status">{message.text}</div>}

    <div className="pricing-editor-actions">
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save pricing"}</button>
    </div>
  </form>;
}
