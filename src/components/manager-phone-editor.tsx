"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManagerPhoneEditor({
  registrationId,
  phone,
}: {
  registrationId: string;
  phone: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/manager/registration-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, phone: value }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "The WhatsApp number could not be updated.");
        return;
      }

      setValue(String(data.phone || value));
      setEditing(false);
      router.refresh();
    } catch {
      setError("The WhatsApp number could not be updated. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return <div className="manager-phone-display">
      <span>{value}</span>
      <button
        type="button"
        className="manager-phone-edit"
        onClick={() => {
          setEditing(true);
          setError("");
        }}
        aria-label="Edit WhatsApp number"
        title="Edit WhatsApp number"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 16.5V20h3.5L18.2 9.3l-3.5-3.5L4 16.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
          <path d="m13.9 6.6 3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.7"/>
        </svg>
      </button>
    </div>;
  }

  return <div className="manager-phone-editor">
    <input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      inputMode="tel"
      autoFocus
      aria-label="WhatsApp number"
    />
    <div className="manager-phone-editor-actions">
      <button type="button" className="save" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="cancel"
        disabled={saving}
        onClick={() => {
          setValue(phone);
          setEditing(false);
          setError("");
        }}
      >
        Cancel
      </button>
    </div>
    {error && <small>{error}</small>}
  </div>;
}
