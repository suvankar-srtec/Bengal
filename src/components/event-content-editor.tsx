"use client";

import { useState, type FormEvent } from "react";
import type { EventContent } from "@/lib/event-content";

export function EventContentEditor({ initial, eventId }: { initial: EventContent; eventId?: number }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function set<K extends keyof EventContent>(key: K, value: EventContent[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/event-content", {
        method: eventId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventId ? { ...form, eventId } : form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t save event content.");
      const savedEventId = Number(result.eventId);
      window.location.assign(Number.isInteger(savedEventId) && savedEventId > 0 ? `/register?id=${savedEventId}` : "/register");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Couldn’t save event content." });
    } finally {
      setBusy(false);
    }
  }

  return <form className="event-editor-form" onSubmit={submit}>
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

    <section className="event-editor-section">
      <h2>Impact card & values</h2>
      <div className="event-editor-grid">
        <label><span>Impact label</span><input value={form.impactLabel} onChange={(e) => set("impactLabel", e.target.value)} required /></label>
        <label><span>Impact value</span><input value={form.impactValue} onChange={(e) => set("impactValue", e.target.value)} required /></label>
        <label className="full"><span>Impact description</span><textarea rows={3} value={form.impactCopy} onChange={(e) => set("impactCopy", e.target.value)} required /></label>
        <label><span>Value 1</span><input value={form.value1} onChange={(e) => set("value1", e.target.value)} required /></label>
        <label><span>Value 2</span><input value={form.value2} onChange={(e) => set("value2", e.target.value)} required /></label>
      </div>
    </section>

    {message && <div className={`event-editor-message ${message.type}`} role="status">{message.text}</div>}
    <div className="event-editor-actions">
      <a href="/register" target="_blank" rel="noreferrer">Preview registration</a>
      <button type="submit" disabled={busy}>{busy ? "Saving…" : eventId ? "Update event" : "Create event"}</button>
    </div>
  </form>;
}
