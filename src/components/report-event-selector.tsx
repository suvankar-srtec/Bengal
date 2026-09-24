"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportEventSelector({
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
    router.push(`/report?eventId=${encodeURIComponent(value)}`);
  }

  return <div className="report-event-selector">
    <label htmlFor="reportEvent">Event</label>
    <div className="report-event-select-wrap">
      <select
        id="reportEvent"
        value={selectedEventId ? String(selectedEventId) : ""}
        onChange={(event) => change(event.target.value)}
        disabled={busy}
      >
        <option value="" disabled>Select an event</option>
        {events.map((event) => <option value={event.id} key={event.id}>
          {event.title} · {event.eventDate}
        </option>)}
      </select>
      {busy && <span className="report-select-loading">Loading…</span>}
    </div>
  </div>;
}
