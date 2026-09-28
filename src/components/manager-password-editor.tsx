"use client";

import { useState, type FormEvent } from "react";
import { PasswordInput } from "./password-input";

export function ManagerPasswordEditor({ managerId, userId }: { managerId: string; userId: string }) {
  const [password, setPassword] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [message, setMessage] = useState("");
  const endpoint = `/api/managers/${managerId}/password`;

  async function reveal() {
    if (password) return true;
    setMessage("");
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPassword(result.password);
      return true;
    } catch (error) {
      setMessage(error instanceof Error && error.name === "Error" ? error.message : "Could not load password. Please retry.");
      return false;
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dirty || !password || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }), signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPassword(""); setDirty(false); setInputKey((value) => value + 1);
      setMessage("Password updated.");
    } catch (error) {
      setMessage(error instanceof Error && error.name === "Error" ? error.message : "Could not save password. Please retry.");
    } finally { setBusy(false); }
  }

  return <form className="manager-password-editor" onSubmit={save} aria-label={`Password for ${userId}`}>
    <label className="sr-only" htmlFor={`manager-password-${managerId}`}>Password for {userId}</label>
    <div className="manager-password-actions">
      <PasswordInput key={inputKey} id={`manager-password-${managerId}`} value={password}
        onChange={(event) => { setPassword(event.target.value); setDirty(true); setMessage(""); }}
        placeholder="Saved password" autoComplete="new-password" maxLength={128} disabled={busy} onReveal={reveal} />
      <button className="manager-password-save" type="submit" disabled={!dirty || !password || busy}>{busy ? "Saving…" : "Save"}</button>
    </div>
    {message && <small role="status">{message}</small>}
  </form>;
}
