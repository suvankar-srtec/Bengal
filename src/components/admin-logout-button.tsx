"use client";

import { useState } from "react";

export function AdminLogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  return <button className="dashboard-signout" type="button" disabled={busy} onClick={() => void logout()}>
    {busy ? "Signing out…" : "Sign out"}
  </button>;
}
