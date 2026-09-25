"use client";

import { useState, type FormEvent } from "react";
import type { EventContent } from "@/lib/event-content";
import { eventPublicPath } from "@/lib/event-public-link";
import { EventPublicLinkCard } from "@/components/event-public-link-card";
import {
  formatMoney,
  mealChoiceLabel,
  type MealChoice,
  type ParticipationPrices,
} from "@/lib/registration";

function rupees(paise: number) {
  return (paise / 100).toFixed(2);
}

function toPaise(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function EventContentEditor({
  initial,
  initialPrices,
  eventId,
}: {
  initial: EventContent;
  initialPrices: ParticipationPrices;
  eventId?: number;
}) {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState<"pricing" | "content">("pricing");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [publicLink, setPublicLink] = useState<string | null>(null);

  const [participation, setParticipation] = useState(rupees(initialPrices.participation));
  const [standee, setStandee] = useState(rupees(initialPrices.standee));
  const [presentation, setPresentation] = useState(rupees(initialPrices.presentation));
  const [mealOption, setMealOption] = useState<MealChoice>(initialPrices.mealOption);
  const [snacks, setSnacks] = useState(rupees(initialPrices.snacks));
  const [lunch, setLunch] = useState(rupees(initialPrices.lunch));
  const [dinner, setDinner] = useState(rupees(initialPrices.dinner));

  function set<K extends keyof EventContent>(key: K, value: EventContent[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  function pricingPayload(): ParticipationPrices | null {
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
      return null;
    }

    return {
      participation: participationPaise,
      standee: standeePaise,
      presentation: presentationPaise,
      mealOption,
      snacks: snacksPaise,
      lunch: lunchPaise,
      dinner: dinnerPaise,
    };
  }

  function continueToEvent() {
    const pricing = pricingPayload();
    if (!pricing) {
      setMessage({ type: "error", text: "Enter valid pricing amounts before continuing." });
      return;
    }
    setMessage(null);
    setStep("content");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const pricing = pricingPayload();
    if (!pricing) {
      setMessage({ type: "error", text: "Pricing is incomplete. Go back and complete Step 1." });
      setStep("pricing");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const payload = {
        ...form,
        ...(eventId ? { eventId } : {}),
        participationPaise: pricing.participation,
        standeePaise: pricing.standee,
        presentationPaise: pricing.presentation,
        mealOption: pricing.mealOption,
        snacksPaise: pricing.snacks,
        lunchPaise: pricing.lunch,
        dinnerPaise: pricing.dinner,
      };

      const response = await fetch("/api/event-content", {
        method: eventId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t save event content.");

      const savedEventId = Number(result.eventId);
      if (!Number.isInteger(savedEventId) || savedEventId < 1) {
        throw new Error("The event was saved, but its registration link could not be generated.");
      }

      if (eventId) {
        window.location.assign(`/register?id=${savedEventId}`);
        return;
      }

      setPublicLink(eventPublicPath(savedEventId, form.titleEn));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Couldn’t save event content.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (publicLink) {
    return <EventPublicLinkCard title={form.titleEn} path={publicLink} />;
  }

  if (step === "pricing") {
    return <div className="event-create-wizard">
      <div className="event-create-steps" aria-label={eventId ? "Edit event steps" : "Create event steps"}>
        <span className="active"><b>1</b> Participation Fees</span>
        <span><b>2</b> Event Details</span>
      </div>

      <section className="event-editor-section event-pricing-step">
        <div className="event-step-heading">
          <span className="eyebrow">STEP 01</span>
          <h2>Participation Fees</h2>
          <p>{eventId ? "Review or update pricing for this event only. Other events are not affected." : "Set pricing for this event. These amounts are stored only with this event."}</p>
        </div>

        <div className="pricing-fields">
          <label>
            <span>Participation fee <small>per person</small></span>
            <div className="pricing-money-input"><span>₹</span><input type="number" min="0" step="0.01" value={participation} onChange={(e) => setParticipation(e.target.value)} /></div>
          </label>
          <label>
            <span>Standee placement <small>per standee</small></span>
            <div className="pricing-money-input"><span>₹</span><input type="number" min="0" step="0.01" value={standee} onChange={(e) => setStandee(e.target.value)} /></div>
          </label>
          <label>
            <span>Company presentation <small>per presentation</small></span>
            <div className="pricing-money-input"><span>₹</span><input type="number" min="0" step="0.01" value={presentation} onChange={(e) => setPresentation(e.target.value)} /></div>
          </label>
        </div>

        <div className="pricing-meal-section">
          <div className="pricing-meal-heading">
            <div>
              <span>MEAL PREFERENCE</span>
              <h3>Choose one meal option for this event</h3>
              <p>Only the selected meal option will appear on the registration form.</p>
            </div>
          </div>

          <div className="pricing-meal-grid">
            {([
              { key: "snacks" as const, label: "Snacks", value: snacks, setValue: setSnacks },
              { key: "lunch" as const, label: "Lunch", value: lunch, setValue: setLunch },
              { key: "dinner" as const, label: "Dinner", value: dinner, setValue: setDinner },
            ]).map((item) => <label className={`pricing-meal-card${mealOption === item.key ? " selected" : ""}`} key={item.key}>
              <div className="pricing-meal-card-title">
                <input type="checkbox" checked={mealOption === item.key} onChange={() => setMealOption(item.key)} />
                <strong>{item.label}</strong>
              </div>
              <div className="pricing-money-input"><span>₹</span><input type="number" min="0" step="0.01" value={item.value} onChange={(e) => item.setValue(e.target.value)} /></div>
            </label>)}
          </div>

          <div className="pricing-active-meal">Selected meal: <strong>{mealChoiceLabel(mealOption)}</strong></div>
        </div>
      </section>

      {message && <div className={`event-editor-message ${message.type}`} role="status">{message.text}</div>}

      <div className="event-editor-actions">
        <button type="button" onClick={continueToEvent}>Continue to event details</button>
      </div>
    </div>;
  }

  return <form className="event-editor-form" onSubmit={submit}>
    <div className="event-create-steps" aria-label={eventId ? "Edit event steps" : "Create event steps"}>
      <span><b>1</b> Participation Fees</span>
      <span className="active"><b>2</b> Event Details</span>
    </div>

    <section className="event-editor-section">
      <h2>Hero content</h2>
      <div className="event-editor-grid">
        <label><span>Section label</span><input value={form.sectionLabel} onChange={(e) => set("sectionLabel", e.target.value)} required /></label>
        <label><span>English title</span><input value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} required /></label>
        <label className="full"><span>Bengali title</span><input value={form.titleBn} onChange={(e) => set("titleBn", e.target.value)} required /></label>
        <label><span>Tagline line 1</span><input value={form.taglineLine1} onChange={(e) => set("taglineLine1", e.target.value)} required /></label>
        <label><span>Tagline line 2</span><input value={form.taglineLine2} onChange={(e) => set("taglineLine2", e.target.value)} required /></label>
        <label><span>Event date</span><input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} required /></label>
        <label><span>Organizer</span><input value={form.organizer} onChange={(e) => set("organizer", e.target.value)} required /></label>
      </div>
    </section>

    <section className="event-editor-section">
      <h2>About event</h2>
      <div className="event-editor-grid">
        <label className="full"><span>About heading</span><input value={form.aboutTitle} onChange={(e) => set("aboutTitle", e.target.value)} required /></label>
        <label className="full"><span>Paragraph 1</span><textarea rows={4} value={form.aboutParagraph1} onChange={(e) => set("aboutParagraph1", e.target.value)} required /></label>
        <label className="full"><span>Paragraph 2</span><textarea rows={4} value={form.aboutParagraph2} onChange={(e) => set("aboutParagraph2", e.target.value)} required /></label>
        <label className="full"><span>Bengali paragraph 1</span><textarea rows={4} value={form.bengaliParagraph1} onChange={(e) => set("bengaliParagraph1", e.target.value)} /></label>
        <label className="full"><span>Bengali paragraph 2</span><textarea rows={4} value={form.bengaliParagraph2} onChange={(e) => set("bengaliParagraph2", e.target.value)} /></label>
      </div>
    </section>

    {message && <div className={`event-editor-message ${message.type}`} role="status">{message.text}</div>}

    <div className="event-editor-actions">
      <button type="button" className="secondary-event-button" onClick={() => setStep("pricing")}>Back to pricing</button>
      {eventId && <a href={`/register?id=${eventId}`} target="_blank" rel="noreferrer">Preview registration</a>}
      <button type="submit" disabled={busy}>{busy ? "Saving…" : eventId ? "Update event" : "Create event"}</button>
    </div>
  </form>;
}
