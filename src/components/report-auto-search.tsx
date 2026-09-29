"use client";

import { useEffect, useRef, useState } from "react";

export function ReportAutoSearch({ reportKey }: { reportKey: string }) {
  const [query, setQuery] = useState("");

  const search = useRef<HTMLDivElement>(null);
  const [matches, setMatches] = useState(0);

  useEffect(() => {
    const table = search.current?.closest(".report-table-card");
    if (!table) return;
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("[data-report-row]"));

    for (const row of rows) {
      const haystack = `${row.dataset.reportSearch ?? ""} ${row.textContent ?? ""}`.toLocaleLowerCase();
      const visible = words.every((word) => haystack.includes(word));

      // Mobile report rows use display:block, which can override the browser's
      // default [hidden] styling. Keep both the hidden attribute and an inline
      // display override so filtering behaves identically on desktop and mobile.
      row.hidden = !visible;
      row.style.display = visible ? "" : "none";
    }

    const emptyState = table.querySelector<HTMLElement>("[data-report-search-empty]");
    const visibleRows = rows.filter((row) => !row.hidden).length;
    setMatches(visibleRows);
    if (emptyState) emptyState.hidden = words.length === 0 || visibleRows > 0;
  }, [query, reportKey]);

  return <div className="report-auto-search" ref={search}>
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
    <input
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
      placeholder="Search report"
      aria-label="Search report"
    />
    {query && <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setQuery("")}>×</button>}
    <span className="sr-only" role="status" aria-live="polite">{matches} matching records</span>
  </div>;
}
