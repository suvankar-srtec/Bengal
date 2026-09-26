"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { eventPublicPath } from "@/lib/event-public-link";

export function DashboardEventCard({
  id,
  title,
  createdAt,
  registrations,
  participants,
  revenue,
  canManage,
}: {
  id: number;
  title: string;
  createdAt: string;
  registrations: number;
  participants: number;
  revenue: number;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copyAgainLabel, setCopyAgainLabel] = useState("Copy again");
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const revenueLabel = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(revenue / 100);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setCopiedUrl(null);
      }
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function copyPublicLink() {
    const path = eventPublicPath(id, title);
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setOpen(false);
      setCopyAgainLabel("Copy again");
      setCopiedUrl(url);
    } catch {
      window.prompt("Copy this registration link:", url);
    }
  }

  async function copyAgain() {
    if (!copiedUrl) return;
    try {
      await navigator.clipboard.writeText(copiedUrl);
      setCopyAgainLabel("Copied");
      window.setTimeout(() => setCopyAgainLabel("Copy again"), 1400);
    } catch {
      window.prompt("Copy this registration link:", copiedUrl);
    }
  }

  async function deleteEvent() {
    if (deleting || !canManage) return;
    const confirmed = window.confirm(`Delete "${title}"? This event content will be permanently removed.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/event-content?id=${id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(result.error || "Couldn’t delete the event. Please try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      window.alert("Couldn’t delete the event. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const href = canManage ? `/create-event?id=${id}` : `/report?eventId=${id}`;

  return <div className="dashboard-event-card-shell">
    <a className="dashboard-event-card" href={href}>
      <span className="dashboard-event-card-label">EVENT</span>
      <strong>{title}</strong>

      <div className="dashboard-event-stats">
        <div><span>Registrations</span><strong>{registrations}</strong></div>
        <div><span>Participants</span><strong>{participants}</strong></div>
        <div><span>Paid value</span><strong>{revenueLabel}</strong></div>
      </div>

      <span className="dashboard-event-created">Created {createdAt}</span>
    </a>

    {canManage && <div className="dashboard-event-menu" ref={menuRef}>
      <button
        className="dashboard-event-menu-trigger"
        type="button"
        aria-label={`Open actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">•••</span>
      </button>

      {open && <div className="dashboard-event-menu-popover" role="menu">
        <a role="menuitem" href={`/create-event?id=${id}`} onClick={() => setOpen(false)}>Edit</a>
        <button role="menuitem" type="button" onClick={() => void copyPublicLink()}>Copy public link</button>
        <button role="menuitem" type="button" className="delete" disabled={deleting} onClick={() => void deleteEvent()}>
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>}
    </div>}

    {copiedUrl && <div
      className="link-copied-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) setCopiedUrl(null);
      }}
    >
      <div className="link-copied-modal" role="dialog" aria-modal="true" aria-labelledby={`link-copied-title-${id}`}>
        <button className="link-copied-modal-close" type="button" aria-label="Close" onClick={() => setCopiedUrl(null)}>
          <span aria-hidden="true">×</span>
        </button>
        <div className="link-copied-modal-icon" aria-hidden="true">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
            <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
          </svg>
          <i className="link-ray ray-1" /><i className="link-ray ray-2" /><i className="link-ray ray-3" /><i className="link-ray ray-4" />
        </div>
        <h2 id={`link-copied-title-${id}`}>Link copied successfully</h2>
        <p>The public registration link has been copied to your clipboard.</p>
        <div className="link-copied-modal-actions">
          <button className="link-copied-copy-again" type="button" onClick={() => void copyAgain()}>{copyAgainLabel}</button>
          <button className="link-copied-done" type="button" onClick={() => setCopiedUrl(null)}>Done</button>
        </div>
      </div>
    </div>}
  </div>;
}
