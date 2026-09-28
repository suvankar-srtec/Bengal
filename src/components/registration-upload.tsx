"use client";

import { useState, type FormEvent } from "react";

type EventOption = { id: number; title: string; eventDate: string };
type ImportResult = {
  row: number;
  registrationId: string;
  primaryMember: string;
  participants: number;
  additionalParticipants: number;
  whatsapp: string;
  passUrl: string;
  deliveryStatus: string;
  existing: boolean;
};

export function RegistrationUpload({ events }: { events: EventOption[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ? String(events[0].id) : "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rowErrors, setRowErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

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

      const importedResults: ImportResult[] = Array.isArray(data.results) ? data.results : [];
      setResults(importedResults);
      setMessage(String(data.count ?? 0) + " registration" + (data.count === 1 ? "" : "s") + " processed successfully.");
    } catch (error) {
      setMessage(error instanceof Error && error.name === "TimeoutError"
        ? "The upload took too long. Please retry."
        : "The upload could not be completed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function sendWhatsApp(result: ImportResult) {
    if (sendingId || result.deliveryStatus === "accepted") return;
    setSendingId(result.registrationId);
    setMessage("");

    try {
      const response = await fetch("/api/admin/send-registration-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: result.registrationId }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "WhatsApp could not send the passes.");
        return;
      }

      setResults((items) => items.map((item) =>
        item.registrationId === result.registrationId
          ? { ...item, deliveryStatus: "accepted" }
          : item
      ));
      setMessage(data.alreadySent ? "WhatsApp passes were already sent." : "WhatsApp passes sent successfully.");
    } catch {
      setMessage("WhatsApp could not send the passes. Please retry.");
    } finally {
      setSendingId(null);
    }
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
          <p>Upload the Razorpay payment export. QR passes are generated only for captured Participation Fees rows.</p>
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
        <strong>Required Razorpay columns</strong>
        <p>payment date, item name, item quantity, total payment amount, payment status, member_name, email, phone, billing_details.</p>
        <small>
          The importer ignores non-participation rows and non-captured payments.
          A QR pass registration is created only when <b>item name = Participation Fees</b> and <b>payment status = captured</b>.
          When item quantity is greater than 1, additional QR passes are named automatically from the primary member, for example <b>Primary Name +1</b>, <b>Primary Name +2</b>.
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
          <p>Review the generated pass bundle, then send the pass link through WhatsApp.</p>
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
              <td>
                <button
                  type="button"
                  className="admin-upload-whatsapp"
                  disabled={sendingId === result.registrationId || result.deliveryStatus === "accepted"}
                  onClick={() => void sendWhatsApp(result)}
                >
                  {result.deliveryStatus === "accepted"
                    ? "Sent"
                    : sendingId === result.registrationId
                      ? "Sending…"
                      : "Send WhatsApp"}
                </button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>}
  </div>;
}
