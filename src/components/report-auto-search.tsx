"use client";

import { useEffect, useState } from "react";

export function ReportAutoSearch() {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const normalized = query.trim().toLowerCase();
    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>("[data-report-row]"));

    for (const row of rows) {
      const haystack = (row.dataset.reportSearch || "").toLowerCase();
      row.hidden = normalized ? !haystack.includes(normalized) : false;
    }

    const emptyState = document.querySelector<HTMLElement>("[data-report-search-empty]");
    if (emptyState) {
      const visibleRows = rows.filter((row) => !row.hidden).length;
      emptyState.hidden = !normalized || visibleRows > 0;
    }
  }, [query]);

  return <div className="report-auto-search">
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
    <input
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Search report"
      aria-label="Search report"
    />
    {query && <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setQuery("")}>×</button>}
  </div>;
}
