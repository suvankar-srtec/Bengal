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
  canSendPasses: boolean;
  existing: boolean;
};

export function RegistrationUpload({ events }: { events: EventOption[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ? String(events[0].id) : "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [successPopup, setSuccessPopup] = useState("");
  const [whatsAppSuccessPopup, setWhatsAppSuccessPopup] = useState("");
  const [rowErrors, setRowErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !eventId || busy) return;

    setBusy(true);
    setMessage("");
    setSuccessPopup("");
    setWhatsAppSuccessPopup("");
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
      setMessage("");
      setSuccessPopup(String(data.count ?? 0) + " registration" + (data.count === 1 ? "" : "s") + " processed successfully.");
    } catch (error) {
      setMessage(error instanceof Error && error.name === "TimeoutError"
        ? "The upload took too long. Please retry."
        : "The upload could not be completed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function sendWhatsApp(result: ImportResult) {
    if (sendingId || !result.canSendPasses) return;
    setSendingId(result.registrationId);
    setMessage("");

    try {
      const response = await fetch("/api/admin/send-registration-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: result.registrationId }),
        signal: AbortSignal.timeout(55000),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "Pass delivery could not be completed.");
        return;
      }

      setResults((items) => items.map((item) =>
        item.registrationId === result.registrationId
          ? {
              ...item,
              deliveryStatus: data.status,
              canSendPasses: typeof data.canSendPasses === "boolean"
                ? data.canSendPasses
                : data.status !== "accepted",
            }
          : item
      ));
      setMessage("");
      setWhatsAppSuccessPopup(
        data.message || "Pass delivery status updated."
      );
    } catch {
      setMessage("Pass delivery could not be completed. Please retry.");
    } finally {
      setSendingId(null);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setMessage("Pass link copied.");
  }

  return <div className="admin-upload-stack">
    {whatsAppSuccessPopup && <div className="admin-upload-whatsapp-success-backdrop" role="dialog" aria-modal="true" aria-labelledby="whatsapp-success-title">
      <div className="admin-upload-whatsapp-success-modal">
        <div className="admin-upload-whatsapp-success-icon" aria-hidden="true">✓</div>
        <h2 id="whatsapp-success-title">Success</h2>
        <p>{whatsAppSuccessPopup}</p>
        <button type="button" onClick={() => setWhatsAppSuccessPopup("")}>OK</button>
      </div>
    </div>}
    {successPopup && <div className="admin-upload-success-popup" role="status" aria-live="polite">
      <div className="admin-upload-success-popup-icon" aria-hidden="true">✓</div>
      <div>
        <strong>Success</strong>
        <p>{successPopup}</p>
      </div>
      <button type="button" onClick={() => setSuccessPopup("")} aria-label="Close success message">×</button>
    </div>}
    <section className="admin-upload-card">
      <div className="admin-upload-card-head">
        <div>
          <span className="eyebrow">REGISTRATION IMPORT</span>
          <h2>Upload Excel or CSV</h2>
          <p>Upload the Razorpay payment export. QR passes are generated only for captured Participation Fees rows.</p>
        </div>
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
          <div className="admin-upload-file-box">
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
            <small>Accepted: .csv or .xlsx · Maximum 5 MB · Up to 500 rows</small>
          </div>
        </label>

        <button type="submit" disabled={busy || !file || !events.length}>
          {busy ? "Uploading and generating passes…" : "Upload registrations"}
        </button>
      </form>

      {message && <div className={"admin-upload-message" + (rowErrors.length ? " error" : "")} role="status">{message}</div>}

      {rowErrors.length > 0 && <div className="admin-upload-errors">
        {rowErrors.map((item) => <div key={String(item.row) + "-" + item.error}><strong>Row {item.row}</strong><span>{item.error}</span></div>)}
      </div>}
    </section>

    {results.length > 0 && <section className="admin-upload-results">
      <div className="admin-upload-results-head">
        <div>
          <h2>QR passes ready</h2>
          <p>Review the generated pass bundle, then send the pass link through WhatsApp and email.</p>
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
              <td>
                <div className="admin-upload-pass-actions">
                  <button type="button" className="admin-upload-copy" onClick={() => void copyLink(result.passUrl)}>Copy pass link</button>
                  <a
                    className="admin-upload-preview-link"
                    href={result.passUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={"Preview QR passes for " + result.primaryMember}
                    title="Preview QR passes"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.5 12s3.4-5.5 9.5-5.5S21.5 12 21.5 12 18.1 17.5 12 17.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.7"/>
                      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.7"/>
                    </svg>
                  </a>
                </div>
              </td>
              <td>
                <button
                  type="button"
                  className="admin-upload-whatsapp"
                  disabled={sendingId === result.registrationId || !result.canSendPasses}
                  onClick={() => void sendWhatsApp(result)}
                >
                  {sendingId === result.registrationId
                    ? "Sending…"
                    : result.canSendPasses
                      ? result.deliveryStatus === "accepted"
                        ? "Send again"
                        : "Send passes"
                      : "Sent"}
                </button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>}
  </div>;
}
