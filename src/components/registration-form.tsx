"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { calculateTotal, formatMoney, LIMITS, PRICES, registrationSchema, registrationFieldKey, type FieldErrors, type RegistrationReceipt } from "@/lib/registration";
import { Icon } from "./icon";
import { PaymentCheckout } from "./payment-checkout";

function Quantity({ label, value, minimum, maximum, onChange }: {
  label: string; value: number; minimum: number; maximum: number; onChange: (value: number) => void;
}) {
  return <div className="quantity" role="group" aria-label={`${label} quantity`}>
    <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= minimum} onClick={() => onChange(value - 1)}><Icon name="minus" size={14} /></button>
    <output aria-label={`${label} quantity`} aria-live="polite">{value}</output>
    <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= maximum} onClick={() => onChange(value + 1)}><Icon name="plus" size={14} /></button>
  </div>;
}

function loadPassImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function fitPassText(context: CanvasRenderingContext2D, text: string, maxWidth: number, initialSize: number, minimumSize = 24) {
  let size = initialSize;
  while (size > minimumSize) {
    context.font = `700 ${size}px "Segoe UI", Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

async function createParticipantPassImage(input: {
  qrUrl: string;
  participantName: string;
  participantNumber: number;
  passId: string;
  mealLabel: string;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1250;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#c74c40";
  context.fillRect(0, 0, canvas.width, 16);

  context.fillStyle = "#182f46";
  context.font = '700 28px "Segoe UI", Arial, sans-serif';
  context.fillText("BENGAL BUSINESS COUNCIL", 70, 85);

  context.fillStyle = "#c74c40";
  context.font = '700 18px "Segoe UI", Arial, sans-serif';
  context.fillText("AALAP ALOCHONA · EVENT PASS", 70, 127);

  context.strokeStyle = "#e5e8ea";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(70, 160);
  context.lineTo(830, 160);
  context.stroke();

  context.fillStyle = "#626f7b";
  context.font = '600 17px "Segoe UI", Arial, sans-serif';
  context.fillText(`PARTICIPANT ${input.participantNumber}`, 70, 220);

  const nameSize = fitPassText(context, input.participantName, 760, 48);
  context.font = `700 ${nameSize}px "Segoe UI", Arial, sans-serif`;
  context.fillStyle = "#182f46";
  context.fillText(input.participantName, 70, 278);

  context.fillStyle = "#f8f9fa";
  context.fillRect(70, 318, 760, 86);
  context.fillStyle = "#626f7b";
  context.font = '600 15px "Segoe UI", Arial, sans-serif';
  context.fillText("MEAL PREFERENCE", 95, 349);
  context.fillStyle = "#182f46";
  context.font = '700 25px "Segoe UI", Arial, sans-serif';
  context.fillText(input.mealLabel, 95, 383);

  const qrImage = await loadPassImage(input.qrUrl);
  context.fillStyle = "#ffffff";
  context.fillRect(150, 445, 600, 600);
  context.drawImage(qrImage, 180, 475, 540, 540);

  context.fillStyle = "#626f7b";
  context.font = '600 14px "Segoe UI", Arial, sans-serif';
  context.textAlign = "center";
  context.fillText("SCAN THIS PASS AT ENTRY", 450, 1078);

  context.fillStyle = "#182f46";
  context.font = '700 18px "Courier New", monospace';
  context.fillText(input.passId, 450, 1120);

  context.fillStyle = "#626f7b";
  context.font = '500 15px "Segoe UI", Arial, sans-serif';
  context.fillText("29 September 2026 · Bengal Business Council", 450, 1174);

  context.fillStyle = "#c74c40";
  context.font = '700 14px "Segoe UI", Arial, sans-serif';
  context.fillText("INDIVIDUAL PASS · NON-TRANSFERABLE", 450, 1212);

  return canvas.toDataURL("image/png");
}

export function RegistrationForm() {
  const [additionalParticipantNames, setAdditionalParticipantNames] = useState<string[]>([]);
  const [standeeQuantity, setStandeeQuantity] = useState(0);
  const [mealChoice, setMealChoice] = useState<"lunch" | "dinner" | null>(null);
  const [presentationSelected, setPresentationSelected] = useState(false);
  const [fields, setFields] = useState({ memberName: "", email: "", phone: "", billingDetails: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);
  const [qrPasses, setQrPasses] = useState<Array<{ participantNumber: number; participantName: string; passId: string; mealLabel: string; qrUrl: string; passUrl: string }>>([]);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrRetryKey, setQrRetryKey] = useState(0);
  const submission = useRef<{ key: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const participationQuantity = 1 + additionalParticipantNames.length;
  const participantNames = [fields.memberName, ...additionalParticipantNames];
  const total = calculateTotal({ participationQuantity, standeeQuantity, presentationSelected });
  const participantKey = participantNames.map((name) => name.trim()).join("\u001f");

  useEffect(() => {
    if (receipt?.paymentStatus === "paid") confirmationHeading.current?.focus();
  }, [receipt?.paymentStatus]);

  useEffect(() => {
    if (!receipt || receipt.paymentStatus !== "paid") {
      setQrPasses([]);
      setQrGenerating(false);
      setQrError("");
      return;
    }

    let cancelled = false;
    setQrGenerating(true);
    setQrPasses([]);
    setQrError("");

    void (async () => {
      const QRCode = (await import("qrcode")).default;
      const mealLabel = mealChoice === "lunch" ? "Lunch" : mealChoice === "dinner" ? "Dinner" : "No meal";
      const mealCode = mealChoice ?? "none";
      const passes = await Promise.all(participantNames.map(async (participantName, index) => {
        const participantNumber = index + 1;
        const cleanName = participantName.trim();
        const passId = `${receipt.reference}-P${participantNumber}`;
        const payload = `BBC|EVENT:AALAP-ALOCHONA-2026-09-29|REG:${receipt.id}|REF:${receipt.reference}|PARTICIPANT:${participantNumber}|PASS:${passId}|NAME:${encodeURIComponent(cleanName)}|MEAL:${mealCode}`;
        const qrUrl = await QRCode.toDataURL(payload, { width: 720, margin: 2, errorCorrectionLevel: "M" });
        const passUrl = await createParticipantPassImage({
          qrUrl,
          participantName: cleanName,
          participantNumber,
          passId,
          mealLabel,
        });
        return { participantNumber, participantName: cleanName, passId, mealLabel, qrUrl, passUrl };
      }));
      if (!cancelled) setQrPasses(passes);
    })().catch(() => {
      if (!cancelled) setQrError("We couldn’t generate the participant passes. Please retry.");
    }).finally(() => {
      if (!cancelled) setQrGenerating(false);
    });

    return () => { cancelled = true; };
  }, [receipt?.id, receipt?.reference, receipt?.paymentStatus, participantKey, mealChoice, qrRetryKey]);

  function updateField(field: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setErrorMessage("");
  }

  function updateParticipantName(index: number, value: string) {
    setAdditionalParticipantNames((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setErrors((current) => ({ ...current, [`participantName${index + 2}`]: undefined }));
    setErrorMessage("");
  }

  function addParticipantName() {
    if (participationQuantity >= LIMITS.participation) return;
    setAdditionalParticipantNames((current) => [...current, ""]);
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("participantName"))));
    setErrorMessage("");
  }

  function removeParticipantName(index: number) {
    setAdditionalParticipantNames((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("participantName"))));
    setErrorMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setErrorMessage("");
    const values = { ...fields, email: fields.email.trim(), participationQuantity, standeeQuantity, mealChoice, presentationSelected, additionalParticipantNames: participantNames.slice(1) };
    const key = JSON.stringify(values);
    if (!submission.current || submission.current.key !== key) submission.current = { key, id: crypto.randomUUID() };
    const parsed = registrationSchema.safeParse({ ...values, submissionId: submission.current.id });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const name = registrationFieldKey(issue.path);
        nextErrors[name] ??= issue.message;
      }
      setErrors(nextErrors);
      document.getElementById(registrationFieldKey(parsed.error.issues[0].path))?.focus();
      return;
    }
    setErrors({});
    inFlight.current = true;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) {
        setErrors(result.fields ?? {});
        throw new Error(result.error ?? "We couldn’t save your registration. Please try again.");
      }
      setReceipt(result.registration);
    } catch (error) {
      setErrorMessage(error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
        ? error.message
        : "The connection was interrupted. Your details are still here. Please try again; a retry won’t create a duplicate.");
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  function downloadParticipantPass(pass: { participantNumber: number; participantName: string; passId: string; passUrl: string }) {
    const safeName = pass.participantName.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `participant-${pass.participantNumber}`;
    const anchor = document.createElement("a");
    anchor.href = pass.passUrl;
    anchor.download = `${receipt?.reference ?? "BBC"}-P${pass.participantNumber}-${safeName}-pass.png`;
    anchor.click();
  }

  if (receipt && receipt.paymentStatus !== "paid") return <div className="registration-card payment-stage-card">
    <span className="eyebrow">SECURE CHECKOUT</span>
    <h2>Complete payment</h2>
    <p>Complete payment to confirm your event registration.</p>
    <PaymentCheckout autoStart registration={receipt} submissionId={submission.current?.id ?? ""} member={fields} onPaid={() => setReceipt((current) => current ? { ...current, paymentStatus: "paid" } : current)} />
  </div>;

  if (receipt?.paymentStatus === "paid" && (qrGenerating || (!qrError && qrPasses.length !== participantNames.length))) return <div className="registration-card qr-generating-card" role="status" aria-live="polite">
    <span className="qr-loader" aria-hidden="true" />
    <span className="eyebrow">PAYMENT SUCCESSFUL</span>
    <h2>Generating participant passes…</h2>
    <p>Please wait while we create one individual pass with name, meal preference and QR code for each participant.</p>
    <div className="qr-generation-count">{participantNames.length} {participantNames.length === 1 ? "pass" : "passes"} being generated</div>
  </div>;

  if (receipt?.paymentStatus === "paid" && qrError) return <div className="registration-card qr-generating-card">
    <span className="eyebrow">PAYMENT SUCCESSFUL</span>
    <h2>Pass generation needs a retry</h2>
    <div className="error-banner" role="alert">{qrError}</div>
    <button className="submit-button" type="button" onClick={() => setQrRetryKey((value) => value + 1)}>Generate passes again</button>
  </div>;

  if (receipt?.paymentStatus === "paid") return <div className="registration-card success-card qr-ready-card">
    <span className="success-icon"><Icon name="check" size={32} /></span>
    <span className="eyebrow">PARTICIPANT PASSES READY</span>
    <h2 ref={confirmationHeading} tabIndex={-1}>Your passes are ready.</h2>
    <p>Each participant has an individual pass showing their name, meal preference and QR code.</p>
    <div className="qr-pass-grid">
      {qrPasses.map((pass) => <article className="qr-pass-card" key={pass.passId}>
        <div className="qr-pass-image-wrap participant-pass-preview"><img src={pass.passUrl} alt={`Event pass for ${pass.participantName}`} /></div>
        <div className="qr-pass-meta">
          <span>Participant {pass.participantNumber}</span>
          <strong>{pass.participantName}</strong>
          <small>{pass.passId}</small>
          <span className="qr-pass-meal">Meal: {pass.mealLabel}</span>
        </div>
        <button type="button" onClick={() => downloadParticipantPass(pass)}><Icon name="download" size={16} /> Download pass</button>
      </article>)}
    </div>
    <button className="new-registration" type="button" onClick={() => {
      setReceipt(null); setFields({ memberName: "", email: "", phone: "", billingDetails: "" });
      setAdditionalParticipantNames([]); setStandeeQuantity(0); setMealChoice(null); setPresentationSelected(false);
      setQrPasses([]); setQrError(""); submission.current = null;
    }}>Register another member <Icon name="arrow" size={16} /></button>
  </div>;

  return <div className="registration-card">
    <div className="form-heading"><div><span className="eyebrow">JOIN THE CONVERSATION</span><h2>Reserve your place</h2></div><span className="form-heading-icon"><Icon name="spark" size={23} /></span></div>
    <p className="form-intro">A few details. A world of possibilities.</p>

    <form onSubmit={submit} noValidate>
      <fieldset disabled={isSubmitting}>
        <legend className="sr-only">Event registration details</legend>
        <div className="form-section-heading"><span className="step-number">01</span><h3>Your details</h3><span className="required-note">* Required</span></div>
        <div className="fields-grid">
          <div className="field full-width">
            <div className="member-name-label-row">
              <label htmlFor="memberName">Member name <span className="required">*</span></label>
              <button className="member-add-button" type="button" onClick={addParticipantName} disabled={participationQuantity >= LIMITS.participation} aria-label="Add another member name"><Icon name="plus" size={15} /></button>
            </div>
            <input id="memberName" name="memberName" autoComplete="name" placeholder="Your full name" value={fields.memberName} onChange={(event) => updateField("memberName", event.target.value)} maxLength={120} required aria-invalid={Boolean(errors.memberName)} aria-describedby={errors.memberName ? "memberName-error" : undefined} />
            {errors.memberName && <span className="field-error" id="memberName-error">{errors.memberName}</span>}
          </div>
          {participantNames.slice(1).map((name, index) => {
            const fieldId = `participantName${index + 2}` as const;
            return <div className="field full-width participant-name-field" key={fieldId}>
              <div className="member-name-label-row">
                <label htmlFor={fieldId}>Member name {index + 2} <span className="required">*</span></label>
                <button className="member-remove-button" type="button" onClick={() => removeParticipantName(index)} aria-label={`Remove member ${index + 2}`} title="Remove member"><Icon name="minus" size={15} /></button>
              </div>
              <input id={fieldId} name={fieldId} autoComplete="off" placeholder={`Member ${index + 2} full name`} value={name} onChange={(event) => updateParticipantName(index, event.target.value)} maxLength={120} required aria-invalid={Boolean(errors[fieldId])} aria-describedby={errors[fieldId] ? `${fieldId}-error` : undefined} />
              {errors[fieldId] && <span className="field-error" id={`${fieldId}-error`}>{errors[fieldId]}</span>}
            </div>;
          })}
          <div className="field full-width"><label htmlFor="email">Email address <span className="required">*</span></label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={fields.email} onChange={(event) => updateField("email", event.target.value)} maxLength={254} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />{errors.email && <span className="field-error" id="email-error">{errors.email}</span>}</div>
          <div className="field full-width"><label htmlFor="phone">WhatsApp number <span className="required">*</span></label><div className={`phone-input${errors.phone ? " invalid" : ""}`}><span><span className="sr-only">India country code </span>IN <span>+91</span></span><input id="phone" name="phone" type="tel" autoComplete="tel-national" inputMode="numeric" placeholder="10-digit WhatsApp number" value={fields.phone} onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} required aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} /></div>{errors.phone && <span className="field-error" id="phone-error">{errors.phone}</span>}</div>
          <div className="field full-width"><label htmlFor="billingDetails">Billing details <span className="required">*</span></label><input id="billingDetails" name="billingDetails" autoCapitalize="characters" spellCheck={false} placeholder="GST number or PAN number" value={fields.billingDetails} onChange={(event) => updateField("billingDetails", event.target.value.toUpperCase())} maxLength={15} required aria-invalid={Boolean(errors.billingDetails)} aria-describedby={`billing-hint${errors.billingDetails ? " billingDetails-error" : ""}`} /><span className="field-hint" id="billing-hint">Enter your company GSTIN or personal PAN.</span>{errors.billingDetails && <span className="field-error" id="billingDetails-error">{errors.billingDetails}</span>}</div>
        </div>

        <div className="form-section-heading participation-heading"><span className="step-number">02</span><h3>Your participation</h3><span className="currency-label">INR</span></div>
        <div className="fee-options">
          <div className="fee-row"><div><span className="fee-label">Participation fees <span className="required">*</span></span><span className="fee-price">{formatMoney(PRICES.participation)} <small>/ person</small></span></div><div className="participant-fee-count" aria-label="Participant count"><span>{participationQuantity}</span> {participationQuantity === 1 ? "person" : "people"}</div></div>
          <div className="fee-row"><div><span className="fee-label">Standee placement <span className="optional">Optional</span></span><span className="fee-price">{formatMoney(PRICES.standee)} <small>/ standee</small></span></div><Quantity label="Standee" value={standeeQuantity} minimum={0} maximum={LIMITS.standee} onChange={setStandeeQuantity} /></div>
          <div className={`fee-row meal-option${mealChoice ? " selected" : ""}`}>
            <div><span className="fee-label">Meal preference <span className="optional">Optional</span></span></div>
            <div className="meal-radio-group" role="radiogroup" aria-label="Meal preference">
              <label onDoubleClick={() => mealChoice === "lunch" && setMealChoice(null)} title="Double-click the selected option to clear">
                <input type="radio" name="mealChoice" value="lunch" checked={mealChoice === "lunch"} onChange={() => setMealChoice("lunch")} />
                <span>Lunch</span>
              </label>
              <label onDoubleClick={() => mealChoice === "dinner" && setMealChoice(null)} title="Double-click the selected option to clear">
                <input type="radio" name="mealChoice" value="dinner" checked={mealChoice === "dinner"} onChange={() => setMealChoice("dinner")} />
                <span>Dinner</span>
              </label>
            </div>
          </div>
          <label className={`fee-row presentation-option${presentationSelected ? " selected" : ""}`} htmlFor="presentationSelected"><div><span className="fee-label">Company presentation</span><span className="fee-description">20-minute presentation slot</span><span className="fee-price">{formatMoney(PRICES.presentation)}</span></div><input id="presentationSelected" name="presentationSelected" type="checkbox" checked={presentationSelected} onChange={(event) => setPresentationSelected(event.target.checked)} /></label>
        </div>

        <p className="participant-count-hint" role="status">Participant fee is calculated automatically from the {participationQuantity} member {participationQuantity === 1 ? "name" : "names"} above.</p>

        <div className="total-row"><div><span>Total amount</span><small>{participationQuantity} {participationQuantity === 1 ? "participant" : "participants"}{standeeQuantity > 0 ? ` · ${standeeQuantity} ${standeeQuantity === 1 ? "standee" : "standees"}` : ""}{mealChoice === "lunch" ? " · Lunch" : mealChoice === "dinner" ? " · Dinner" : ""}{presentationSelected ? " · Presentation" : ""}</small></div><output aria-label="Total amount" aria-live="polite">{formatMoney(total)}</output></div>
        {errorMessage && <div className="error-banner" role="alert">{errorMessage}</div>}
        <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="spinner" /> Preparing payment…</> : <>Proceed to payment <Icon name="arrow" size={19} /></>}</button>
        <p className="submit-note">Payment opens directly. Your registration is confirmed only after successful payment.</p>
      </fieldset>
    </form>
  </div>;
}
