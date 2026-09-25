"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { eventPublicPath } from "@/lib/event-public-link";

export function DashboardEventCard({
  id,
  title,
  createdAt,
}: {
  id: number;
  title: string;
  createdAt: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
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
      window.alert("Public registration link copied.");
    } catch {
      window.prompt("Copy this registration link:", url);
    }
  }

  async function deleteEvent() {
    if (deleting) return;

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

  return <div className="dashboard-event-card-shell">
    <a className="dashboard-event-card" href={`/create-event?id=${id}`}>
      <span className="dashboard-event-card-label">EVENT</span>
      <strong>{title}</strong>
      <span className="dashboard-event-created">Created {createdAt}</span>
    </a>

    <div className="dashboard-event-menu" ref={menuRef}>
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
    </div>
  </div>;
}
