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
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
    };
  }
}

export function ManagerQrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("Start the camera and point it at an event QR pass.");
  const [result, setResult] = useState<ScanResult | null>(null);

  async function verify(value: string) {
    if (!value.trim() || scanningRef.current) return;
    scanningRef.current = true;
    setMessage("Verifying pass…");

    try {
      const response = await fetch("/api/pass/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Invalid QR pass.");
      setResult(data);
      setMessage("Pass verified successfully.");
      stopCamera();
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : "Unable to verify QR pass.");
      window.setTimeout(() => { scanningRef.current = false; }, 1200);
      return;
    }

    scanningRef.current = false;
  }

  async function startCamera() {
    setResult(null);
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
        ? <button type="button" onClick={() => void startCamera()}>Start camera</button>
        : <button type="button" className="secondary" onClick={stopCamera}>Stop camera</button>}
    </div>

    <div className="manager-scanner-layout">
      <div className="manager-scanner-camera">
        <video ref={videoRef} playsInline muted />
        {!active && <div className="manager-scanner-placeholder">
          <span>▣</span>
          <strong>Camera scanner</strong>
          <small>{supported ? "Use the device camera to scan a QR pass." : "Camera scanning unavailable in this browser."}</small>
        </div>}
        {active && <div className="manager-scanner-frame" aria-hidden="true" />}
      </div>

      <div className="manager-scanner-side">
        <div className="manager-scanner-status">{message}</div>

        {result && <div className="manager-scan-result success">
          <span>VALID PASS</span>
          <h3>{result.participantName}</h3>
          <dl>
            <div><dt>Event</dt><dd>{result.eventName}</dd></div>
            <div><dt>Participant</dt><dd>#{result.participantNumber}</dd></div>
            <div><dt>Reference</dt><dd>{result.reference}</dd></div>
            <div><dt>Payment</dt><dd>{result.paymentStatus === "paid" ? "Paid" : result.paymentStatus}</dd></div>
            <div><dt>Meals</dt><dd>{result.meals.length ? result.meals.map((meal) => meal[0].toUpperCase() + meal.slice(1)).join(", ") : "None"}</dd></div>
          </dl>
        </div>}
      </div>
    </div>
  </div>;
}
