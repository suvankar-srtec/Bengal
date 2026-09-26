"use client";

import { useState, type FormEvent } from "react";
import type { EventContent } from "@/lib/event-content";
import { eventPublicPath } from "@/lib/event-public-link";
import { EventPublicLinkCard } from "@/components/event-public-link-card";
import {
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
  const [showSecondAbout, setShowSecondAbout] = useState(Boolean(initial.aboutTagline2 || initial.aboutParagraph2));

  const [participation, setParticipation] = useState(rupees(initialPrices.participation));
  const [standee, setStandee] = useState(rupees(initialPrices.standee));
  const [presentation, setPresentation] = useState(rupees(initialPrices.presentation));
  const [includedMeals, setIncludedMeals] = useState<MealChoice[]>(initialPrices.includedMeals);

  function set<K extends keyof EventContent>(key: K, value: EventContent[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  function pricingPayload(): ParticipationPrices | null {
    const participationPaise = toPaise(participation);
    const standeePaise = toPaise(standee);
    const presentationPaise = toPaise(presentation);
    if (
      participationPaise === null ||
      standeePaise === null ||
      presentationPaise === null ||
      includedMeals.length === 0
    ) {
      return null;
    }

    return {
      participation: participationPaise,
      standee: standeePaise,
      presentation: presentationPaise,
      includedMeals,
      mealOption: includedMeals[0],
      snacks: 0,
      lunch: 0,
      dinner: 0,
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
        includedMeals: pricing.includedMeals,
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
              <span>MEALS INCLUDED</span>
              <h3>Select all meals included in the participation fee</h3>
              <p>These meals are included automatically. Participants will not choose meals on the registration form.</p>
            </div>
          </div>

          <div className="pricing-meal-grid">
            {(["snacks", "lunch", "dinner"] as MealChoice[]).map((meal) => {
              const selected = includedMeals.includes(meal);
              return <label className={`pricing-meal-card${selected ? " selected" : ""}`} key={meal}>
                <div className="pricing-meal-card-title">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => setIncludedMeals((current) =>
                      event.target.checked
                        ? Array.from(new Set([...current, meal]))
                        : current.filter((item) => item !== meal)
                    )}
                  />
                  <strong>{mealChoiceLabel(meal)}</strong>
                </div>
              </label>;
            })}
          </div>

          <div className="pricing-active-meal">Included: <strong>{includedMeals.map(mealChoiceLabel).join(", ") || "Select at least one meal"}</strong></div>
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
        <label><span>English title</span><input value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} required /></label>
        <label><span>Bengali title</span><input value={form.titleBn} onChange={(e) => set("titleBn", e.target.value)} required /></label>
        <label><span>Event date</span><input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} required /></label>
        <label><span>Event time</span><input type="time" value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} required /></label>
        <label className="full"><span>Organizer</span><input value={form.organizer} onChange={(e) => set("organizer", e.target.value)} required /></label>
      </div>
    </section>

    <section className="event-editor-section">
      <div className="about-editor-heading">
        <h2>About event</h2>
        {!showSecondAbout && <button
          type="button"
          className="about-add-group"
          aria-label="Add another tagline and paragraph"
          title="Add another tagline and paragraph"
          onClick={() => setShowSecondAbout(true)}
        >+</button>}
      </div>

      <div className="about-editor-group">
        <span className="about-group-label">01</span>
        <div className="event-editor-grid">
          <label className="full"><span>Tagline</span><input value={form.aboutTagline1} onChange={(e) => set("aboutTagline1", e.target.value)} required /></label>
          <label className="full"><span>Paragraph</span><textarea rows={4} value={form.aboutParagraph1} onChange={(e) => set("aboutParagraph1", e.target.value)} required /></label>
        </div>
      </div>

      {showSecondAbout && <div className="about-editor-group">
        <div className="about-group-top">
          <span className="about-group-label">02</span>
          <button
            type="button"
            className="about-remove-group"
            onClick={() => {
              set("aboutTagline2", "");
              set("aboutParagraph2", "");
              setShowSecondAbout(false);
            }}
          >Remove</button>
        </div>
        <div className="event-editor-grid">
          <label className="full"><span>Tagline</span><input value={form.aboutTagline2} onChange={(e) => set("aboutTagline2", e.target.value)} /></label>
          <label className="full"><span>Paragraph</span><textarea rows={4} value={form.aboutParagraph2} onChange={(e) => set("aboutParagraph2", e.target.value)} /></label>
        </div>
      </div>}
    </section>

    {message && <div className={`event-editor-message ${message.type}`} role="status">{message.text}</div>}

    <div className="event-editor-actions">
      <button type="button" className="secondary-event-button" onClick={() => setStep("pricing")}>Back to pricing</button>
      {eventId && <a href={`/register?id=${eventId}`} target="_blank" rel="noreferrer">Preview registration</a>}
      <button type="submit" disabled={busy}>{busy ? "Saving…" : eventId ? "Update event" : "Create event"}</button>
    </div>
  </form>;
}
