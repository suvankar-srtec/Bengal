"use client";

import { useEffect, useRef, useState } from "react";

type ScanResult = {
  participantName: string;
  participantNumber: number;
  reference: string;
  eventName: string;
  eventDate: string;
  paymentStatus: string;
  meals: string[];
  providedMeals: string[];
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
    };
  }
}

function mealLabel(meal: string) {
  return meal ? meal[0].toUpperCase() + meal.slice(1) : meal;
}

export function ManagerQrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("Start the camera and point it at an event QR pass.");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scannedValue, setScannedValue] = useState("");
  const [savingMeal, setSavingMeal] = useState<string | null>(null);
  const [mealMessage, setMealMessage] = useState("");

  async function verify(value: string) {
    if (!value.trim() || scanningRef.current) return;
    scanningRef.current = true;
    setMessage("Verifying pass…");
    setMealMessage("");

    try {
      const response = await fetch("/api/pass/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Invalid QR pass.");

      setScannedValue(value);
      setResult({
        ...data,
        providedMeals: Array.isArray(data.providedMeals) ? data.providedMeals : [],
      });
      setMessage("Pass verified successfully.");
      stopCamera();
    } catch (error) {
      setResult(null);
      setScannedValue("");
      setMessage(error instanceof Error ? error.message : "Unable to verify QR pass.");
      window.setTimeout(() => { scanningRef.current = false; }, 1200);
      return;
    }

    scanningRef.current = false;
  }

  async function provideMeal(meal: string) {
    if (!scannedValue || savingMeal) return;
    setSavingMeal(meal);
    setMealMessage("");

    try {
      const response = await fetch("/api/pass/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: scannedValue, meal }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update meal.");

      setResult((current) => current ? {
        ...current,
        providedMeals: Array.isArray(data.providedMeals) ? data.providedMeals : current.providedMeals,
      } : current);

      setMealMessage(data.status === "already_provided"
        ? `${mealLabel(meal)} already provided.`
        : `${mealLabel(meal)} marked as provided.`);
    } catch (error) {
      setMealMessage(error instanceof Error ? error.message : "Unable to update meal.");
    } finally {
      setSavingMeal(null);
    }
  }

  async function startCamera() {
    setResult(null);
    setScannedValue("");
    setMealMessage("");
    setMessage("Starting camera…");

    if (!navigator.mediaDevices?.getUserMedia || !window.BarcodeDetector) {
      setSupported(false);
      setMessage("Camera QR scanning is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      setMessage("Point the camera at the QR pass.");
    } catch {
      setMessage("Camera permission was not granted. Allow camera access and try again.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }

  function closeMealPopup() {
    stopCamera();
    setResult(null);
    setScannedValue("");
    setMealMessage("");
    setMessage("Start the camera and point it at an event QR pass.");
  }

  useEffect(() => {
    if (!active || !videoRef.current || !window.BarcodeDetector) return;

    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    let cancelled = false;
    let frame = 0;

    async function scanFrame() {
      if (cancelled || !videoRef.current || !active) return;

      try {
        const codes = await detector.detect(videoRef.current);
        const value = codes[0]?.rawValue;
        if (value) {
          await verify(value);
          return;
        }
      } catch {
        // Keep scanning; transient camera frames can fail.
      }

      frame = window.requestAnimationFrame(scanFrame);
    }

    frame = window.requestAnimationFrame(scanFrame);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [active]);

  useEffect(() => () => stopCamera(), []);

  return <div className="manager-scanner-card">
    <div className="manager-scanner-heading">
      <div>
        <span className="eyebrow">QR PASS SCANNER</span>
        <h2>Scan participant pass</h2>
        <p>Only passes for your assigned event will be accepted.</p>
      </div>
      {!active
        ? <button type="button" onClick={() => void startCamera()}>{result ? "Scan another pass" : "Start camera"}</button>
        : <button type="button" className="secondary" onClick={stopCamera}>Stop camera</button>}
    </div>

    <div className="manager-scanner-layout">
      <div className="manager-scanner-camera">
        <video ref={videoRef} playsInline muted />
        {!active && <div className="manager-scanner-placeholder">
          <span>▣</span>
          <strong>{result ? "Pass scanned" : "Camera scanner"}</strong>
          <small>{supported ? "Use the device camera to scan a QR pass." : "Camera scanning unavailable in this browser."}</small>
        </div>}
        {active && <div className="manager-scanner-frame" aria-hidden="true" />}
      </div>

      <div className="manager-scanner-side">
        <div className="manager-scanner-status">{message}</div>

        {result && <div className="manager-meal-popup-backdrop" role="presentation">
          <section className="manager-meal-popup" role="dialog" aria-modal="true" aria-labelledby="meal-popup-title">
            <button
              className="manager-meal-popup-close"
              type="button"
              aria-label="Close meal popup"
              title="Close"
              onClick={closeMealPopup}
            >
              <span aria-hidden="true">×</span>
            </button>
            <span className="manager-meal-popup-badge">VALID PASS</span>
            <h3 id="meal-popup-title">{result.participantName}</h3>
            <p>{result.eventName} · Participant #{result.participantNumber}</p>

            <div className="manager-meal-list">
              {result.meals.length ? result.meals.map((meal) => {
                const provided = result.providedMeals.includes(meal);
                return <div className={`manager-meal-row ${provided ? "provided" : "available"}`} key={meal}>
                  <div>
                    <strong>{mealLabel(meal)}</strong>
                    <span>{provided ? "Meal provided" : "Available"}</span>
                  </div>
                  <button
                    type="button"
                    disabled={provided || savingMeal === meal}
                    onClick={() => void provideMeal(meal)}
                  >
                    {provided ? "Provided" : savingMeal === meal ? "Saving…" : "Mark provided"}
                  </button>
                </div>;
              }) : <div className="manager-no-meal">No meal is included with this pass.</div>}
            </div>

            {mealMessage && <div className="manager-meal-message">{mealMessage}</div>}

            <div className="manager-meal-popup-actions">
              <button type="button" onClick={() => void startCamera()}>Scan next pass</button>
            </div>
          </section>
        </div>}
      </div>
    </div>
  </div>;
}
