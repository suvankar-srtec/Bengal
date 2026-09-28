"use client";

import { useState, type FormEvent } from "react";

type EventOption = { id: number; title: string; eventDate: string };
type ImportResult = {
  row: number;
  primaryMember: string;
  participants: number;
  additionalParticipants: number;
  whatsapp: string;
  passUrl: string;
  existing: boolean;
};

export function RegistrationUpload({ events }: { events: EventOption[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ? String(events[0].id) : "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rowErrors, setRowErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [results, setResults] = useState<ImportResult[]>([]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !eventId || busy) return;

    setBusy(true);
    setMessage("");
    setRowErrors([]);
    setResults([]);

    const form = new FormData();
    form.set("eventId", eventId);
    form.set("file", file);

    try {
      const response = await fetch("/api/admin/import-registrations", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "The registrations could not be imported.");
        setRowErrors(Array.isArray(data.rowErrors) ? data.rowErrors : []);
        return;
      }

      setResults(Array.isArray(data.results) ? data.results : []);
      setMessage(String(data.count ?? 0) + " registration" + (data.count === 1 ? "" : "s") + " processed successfully.");
    } catch (error) {
      setMessage(error instanceof Error && error.name === "TimeoutError"
        ? "The upload took too long. Please retry."
        : "The upload could not be completed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  function whatsappUrl(result: ImportResult) {
    const number = result.whatsapp.replace(/\D/g, "");
    const message = "Hello " + result.primaryMember + ",\n\nYour QR pass" +
      (result.participants === 1 ? " is" : "es are") +
      " ready.\n\nView or download " +
      (result.participants === 1 ? "your pass" : "your passes") +
      " here:\n" + result.passUrl + "\n\nBengal Business Council";
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setMessage("Pass link copied.");
  }

  return <div className="admin-upload-stack">
    <section className="admin-upload-card">
      <div className="admin-upload-card-head">
        <div>
          <span className="eyebrow">REGISTRATION IMPORT</span>
          <h2>Upload Excel or CSV</h2>
          <p>Imported registrations are marked as confirmed and paid, then QR passes are generated for manual WhatsApp sharing.</p>
        </div>
      </div>

      <div className="admin-upload-example-row">
        <span>Example File Format</span>
        <a
          href={eventId ? `/api/admin/registration-template?eventId=${encodeURIComponent(eventId)}` : "#"}
          download
          aria-disabled={!eventId}
          onClick={(event) => { if (!eventId) event.preventDefault(); }}
        >Excel Format</a>
        <small>
          Download the template after selecting the event. The headings and price formulas are fixed.
          Fill the editable fields only; Participation Fees and Amount Paid calculate automatically from the selected event pricing.
        </small>
      </div>

      <form className="admin-upload-form" onSubmit={submit}>
        <label>
          <span>Event</span>
          <select value={eventId} onChange={(event) => setEventId(event.target.value)} required>
            {events.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.eventDate}</option>)}
          </select>
        </label>

        <label className="admin-upload-file">
          <span>Registration file</span>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
          <small>{file ? file.name : "Accepted: .csv or .xlsx · Maximum 5 MB · Up to 500 rows"}</small>
        </label>

        <button type="submit" disabled={busy || !file || !events.length}>
          {busy ? "Uploading and generating passes…" : "Upload registrations"}
        </button>
      </form>

      <div className="admin-upload-columns">
        <strong>File columns</strong>
        <p>Primary Member, Additional Participants, Email, WhatsApp Number, Billing Details, Participation Fees, Standee Quantity, Company Presentation, Amount Paid.</p>
        <small>
          Separate additional participant names with <b>|</b>. Use Yes/No for Company Presentation.
          <b>Participation Fees</b> is calculated automatically from the number of names and the event fee.
          <b> Amount Paid</b> is also calculated automatically from participation, standee quantity and company presentation.
        </small>
      </div>

      {message && <div className={"admin-upload-message" + (rowErrors.length ? " error" : "")} role="status">{message}</div>}

      {rowErrors.length > 0 && <div className="admin-upload-errors">
        {rowErrors.map((item) => <div key={String(item.row) + "-" + item.error}><strong>Row {item.row}</strong><span>{item.error}</span></div>)}
      </div>}
    </section>

    {results.length > 0 && <section className="admin-upload-results">
      <div className="admin-upload-results-head">
        <div>
          <h2>QR passes ready</h2>
          <p>Open WhatsApp for each registration and send the generated pass link manually.</p>
        </div>
        <span>{results.length} ready</span>
      </div>

      <div className="admin-upload-results-table-wrap">
        <table className="admin-upload-results-table">
          <thead>
            <tr>
              <th>Primary member</th>
              <th>Additional Participants</th>
              <th>WhatsApp</th>
              <th>QR pass link</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => <tr key={String(result.row) + "-" + result.passUrl}>
              <td><strong>{result.primaryMember}</strong>{result.existing && <small>Already imported</small>}</td>
              <td>{result.additionalParticipants}</td>
              <td>{result.whatsapp}</td>
              <td><button type="button" className="admin-upload-copy" onClick={() => void copyLink(result.passUrl)}>Copy pass link</button></td>
              <td><a className="admin-upload-whatsapp" href={whatsappUrl(result)} target="_blank" rel="noreferrer">Open WhatsApp</a></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>}
  </div>;
}
