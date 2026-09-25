"use client";

import { useState } from "react";

export function EventPublicLinkCard({
  title,
  path,
}: {
  title: string;
  path: string;
}) {
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this registration link:", fullUrl);
    }
  }

  return <section className="event-public-link-card">
    <span className="eyebrow">PUBLIC REGISTRATION LINK</span>
    <h2>{title}</h2>
    <p>This link opens the event registration form directly. No admin login is required.</p>

    <div className="event-public-link-value">
      <input value={fullUrl} readOnly aria-label="Public registration link" />
      <button type="button" onClick={() => void copyLink()}>{copied ? "Copied" : "Copy link"}</button>
    </div>

    <div className="event-public-link-actions">
      <a href={path} target="_blank" rel="noreferrer">Open registration</a>
      <a href="/dashboard">Back to dashboard</a>
    </div>
  </section>;
}
