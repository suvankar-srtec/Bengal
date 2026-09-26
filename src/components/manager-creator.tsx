"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "./password-input";

export function ManagerCreator({
  events,
}: {
  events: Array<{ id: number; title: string }>;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [eventId, setEventId] = useState(events[0]?.id ? String(events[0].id) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password, eventId: Number(eventId) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Couldn’t create manager.");

      setUserId("");
      setPassword("");
      setMessage({ type: "success", text: "Manager created successfully." });
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Couldn’t create manager.",
      });
    } finally {
      setBusy(false);
    }
  }

  return <form className="manager-create-card" onSubmit={submit}>
    <div className="manager-create-heading">
      <div>
        <span className="eyebrow">NEW MANAGER</span>
        <h2>Create manager access</h2>
        <p>Assign one manager to one event. The manager will only see that event and its report.</p>
      </div>
    </div>

    <div className="manager-create-grid">
      <label>
        <span>User ID</span>
        <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="manager01" required maxLength={80} />
      </label>
      <label>
        <span>Password</span>
        <PasswordInput autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 6 characters" required minLength={6} maxLength={128} />
      </label>
      <label>
        <span>Event</span>
        <select value={eventId} onChange={(event) => setEventId(event.target.value)} required>
          {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
        </select>
      </label>
    </div>

    {message && <div className={`manager-message ${message.type}`} role="status">{message.text}</div>}

    <div className="manager-create-actions">
      <button type="submit" disabled={busy || !events.length}>{busy ? "Creating…" : "Create manager"}</button>
    </div>
  </form>;
}
