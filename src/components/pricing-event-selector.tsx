"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PricingEventSelector({
  events,
  selectedEventId,
}: {
  events: Array<{ id: number; title: string; eventDate: string }>;
  selectedEventId: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function change(value: string) {
    if (!value) return;
    setBusy(true);
    router.push(`/pricing?eventId=${encodeURIComponent(value)}`);
  }

  return <div className="pricing-event-selector">
    <label htmlFor="pricingEvent">Event</label>
    <div className="pricing-event-select-wrap">
      <select
        id="pricingEvent"
        value={selectedEventId ? String(selectedEventId) : ""}
        disabled={busy}
        onChange={(event) => change(event.target.value)}
      >
        <option value="" disabled>Select an event</option>
        {events.map((event) => <option value={event.id} key={event.id}>
          {event.title} · {event.eventDate}
        </option>)}
      </select>
      {busy && <span>Loading…</span>}
    </div>
  </div>;
}
