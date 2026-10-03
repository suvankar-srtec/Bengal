"use client";

import { ChangeEvent, useRef, useState } from "react";

type Props = {
  token: string;
  participantName: string;
  alreadyUploaded: boolean;
};

export function ParticipantPhotoUploader({ token, participantName, alreadyUploaded }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(alreadyUploaded);
  const [message, setMessage] = useState("");

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] || null;
    if (!next) return;
    if (next.size > 5 * 1024 * 1024) {
      setMessage("Choose a photo up to 5 MB.");
      event.target.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setMessage("");
  }

  async function submit() {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("photo", file);
      const response = await fetch(`/api/participant-photo/${encodeURIComponent(token)}`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The photo could not be uploaded.");
      setUploaded(true);
      setMessage("Photo uploaded successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The photo could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  const passUrl = `/api/participant-photo/${encodeURIComponent(token)}/pass`;

  return (
    <section className="participant-photo-card">
      <div className="participant-photo-title">
        <span>PARTICIPANT PHOTO</span>
        <h1>Add your photo</h1>
        <p>{participantName}</p>
      </div>

      {uploaded && !file ? (
        <div className="participant-photo-success">
          <strong>Photo uploaded successfully</strong>
          <p>Your QR pass is ready.</p>
          <div className="participant-photo-actions">
            <a href={passUrl} target="_blank" rel="noreferrer">View / Download Pass</a>
            <button type="button" onClick={() => setUploaded(false)}>Replace photo</button>
          </div>
        </div>
      ) : (
        <>
          <div className="participant-photo-options">
            <input
              ref={cameraRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              onChange={choose}
            />
            <input
              ref={uploadRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={choose}
            />
            <button type="button" onClick={() => cameraRef.current?.click()}>Take Photo</button>
            <span>or</span>
            <button type="button" onClick={() => uploadRef.current?.click()}>Upload Photo</button>
          </div>

          {preview && (
            <div className="participant-photo-preview">
              <img src={preview} alt={`Preview for ${participantName}`} />
              <div className="participant-photo-actions">
                <button type="button" onClick={() => uploadRef.current?.click()} disabled={busy}>Choose another</button>
                <button type="button" className="primary" onClick={() => void submit()} disabled={busy}>
                  {busy ? "Uploading..." : "Submit photo"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {message && <p className={uploaded ? "participant-photo-message success" : "participant-photo-message"} role="status">{message}</p>}

      {uploaded && file && (
        <div className="participant-photo-success compact">
          <strong>Photo uploaded successfully</strong>
          <p>Your QR pass is ready.</p>
          <a href={passUrl} target="_blank" rel="noreferrer">View / Download Pass</a>
        </div>
      )}

      <p className="participant-photo-help">Use a clear, front-facing photo. JPG, PNG and WebP are accepted up to 5 MB.</p>
    </section>
  );
}
