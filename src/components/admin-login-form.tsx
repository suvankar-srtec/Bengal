"use client";

import { useState, type FormEvent } from "react";

export function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Login failed.");
      window.location.assign("/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-login-form" onSubmit={submit}>
    <div className="admin-login-field">
      <label htmlFor="admin-username">Username</label>
      <input id="admin-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter username" required autoFocus />
    </div>
    <div className="admin-login-field">
      <label htmlFor="admin-password">Password</label>
      <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
    </div>
    {error && <div className="admin-login-error" role="alert">{error}</div>}
    <button className="admin-login-button" type="submit" disabled={busy}>
      {busy ? <><span className="admin-login-spinner" /> Signing in…</> : "Sign in"}
    </button>
  </form>;
}
