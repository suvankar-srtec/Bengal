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

export function RegistrationForm() {
  const [participationQuantity, setParticipationQuantity] = useState(1);
  const [additionalParticipantNames, setAdditionalParticipantNames] = useState<string[]>([]);
  const [standeeQuantity, setStandeeQuantity] = useState(0);
  const [presentationSelected, setPresentationSelected] = useState(false);
  const [fields, setFields] = useState({ memberName: "", email: "", phone: "", billingDetails: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);
  const submission = useRef<{ key: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const participantNames = [fields.memberName, ...Array.from(
    { length: participationQuantity - 1 }, (_, index) => additionalParticipantNames[index] ?? "",
  )];
  const total = calculateTotal({ participationQuantity, standeeQuantity, presentationSelected });

  useEffect(() => {
    if (receipt) confirmationHeading.current?.focus();
  }, [receipt]);

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

  function updateParticipationQuantity(value: number) {
    setParticipationQuantity(value);
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("participantName"))));
    setErrorMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setErrorMessage("");
    const values = { ...fields, email: fields.email.trim(), participationQuantity, standeeQuantity, presentationSelected, additionalParticipantNames: participantNames.slice(1) };
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

  function downloadReceipt() {
    if (!receipt) return;
    const text = ["BENGAL BUSINESS COUNCIL", "Aalap Alochona · 29 September 2026", "Registration confirmation", "",
      `Reference: ${receipt.reference}`, `Member: ${fields.memberName.trim()}`, `Email: ${fields.email.trim()}`,
      `Phone: +91 ${fields.phone}`, `GSTIN / PAN: ${fields.billingDetails.trim().toUpperCase()}`, "",
      ...participantNames.map((name, index) => `Participant ${index + 1}: ${name.trim()}`), "",
      `Participation: ${participationQuantity} × ${formatMoney(PRICES.participation)}`,
      `Standee placement: ${standeeQuantity} × ${formatMoney(PRICES.standee)}`,
      `Company presentation (20 minutes): ${presentationSelected ? formatMoney(PRICES.presentation) : "Not selected"}`,
      `Total: ${formatMoney(receipt.totalPaise)}`, "Payment status: Unpaid", "",
      "This confirms that your registration was saved. This is not a payment receipt."].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${receipt.reference}.txt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (receipt) return <div className="registration-card success-card">
    <span className="success-icon"><Icon name="check" size={32} /></span>
    <span className="eyebrow">SEE YOU AT AALAP ALOCHONA</span>
    <h2 ref={confirmationHeading} tabIndex={-1}>You’re registered.</h2>
    <p>Your details have been saved, {fields.memberName.trim().split(" ")[0]}. We look forward to the conversation.</p>
    <div className="receipt-details"><span>REGISTRATION REFERENCE</span><strong className="reference">{receipt.reference}</strong><div><span>Total amount</span><strong>{formatMoney(receipt.totalPaise)}</strong></div><div><span>Payment status</span><span className="unpaid-badge">Unpaid</span></div></div>
    {participantNames.length > 1 && <div className="confirmed-participants"><strong>Participants</strong><ol>{participantNames.map((name, index) => <li key={index}>{name.trim()}</li>)}</ol></div>}
    <p className="payment-note">Registration is saved. You can now try the payment demo below.</p>
    <PaymentCheckout registration={receipt} submissionId={submission.current?.id ?? ""} member={fields} />
    <button className="submit-button registration-download" type="button" onClick={downloadReceipt}><Icon name="download" size={18} /> Download confirmation</button>
    <button className="new-registration" type="button" onClick={() => {
      setReceipt(null); setFields({ memberName: "", email: "", phone: "", billingDetails: "" });
      setAdditionalParticipantNames([]); setParticipationQuantity(1); setStandeeQuantity(0); setPresentationSelected(false); submission.current = null;
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
          <div className="field full-width"><label htmlFor="memberName">Member name <span className="required">*</span></label><input id="memberName" name="memberName" autoComplete="name" placeholder="Your full name" value={fields.memberName} onChange={(event) => updateField("memberName", event.target.value)} maxLength={120} required aria-invalid={Boolean(errors.memberName)} aria-describedby={errors.memberName ? "memberName-error" : undefined} />{errors.memberName && <span className="field-error" id="memberName-error">{errors.memberName}</span>}</div>
          {participantNames.slice(1).map((name, index) => {
            const fieldId = `participantName${index + 2}` as const;
            return <div className="field full-width participant-name-field" key={fieldId}>
              <label htmlFor={fieldId}>Participant {index + 2} name <span className="required">*</span></label>
              <input id={fieldId} name={fieldId} autoComplete="off" placeholder={`Participant ${index + 2} full name`} value={name} onChange={(event) => updateParticipantName(index, event.target.value)} maxLength={120} required aria-invalid={Boolean(errors[fieldId])} aria-describedby={errors[fieldId] ? `${fieldId}-error` : undefined} />
              {errors[fieldId] && <span className="field-error" id={`${fieldId}-error`}>{errors[fieldId]}</span>}
            </div>;
          })}
          <div className="field full-width"><label htmlFor="email">Email address <span className="required">*</span></label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={fields.email} onChange={(event) => updateField("email", event.target.value)} maxLength={254} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />{errors.email && <span className="field-error" id="email-error">{errors.email}</span>}</div>
          <div className="field full-width"><label htmlFor="phone">Phone number <span className="required">*</span></label><div className={`phone-input${errors.phone ? " invalid" : ""}`}><span><span className="sr-only">India country code </span>IN <span>+91</span></span><input id="phone" name="phone" type="tel" autoComplete="tel-national" inputMode="numeric" placeholder="10-digit mobile number" value={fields.phone} onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} required aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} /></div>{errors.phone && <span className="field-error" id="phone-error">{errors.phone}</span>}</div>
          <div className="field full-width"><label htmlFor="billingDetails">Billing details <span className="required">*</span></label><input id="billingDetails" name="billingDetails" autoCapitalize="characters" spellCheck={false} placeholder="GST number or PAN number" value={fields.billingDetails} onChange={(event) => updateField("billingDetails", event.target.value.toUpperCase())} maxLength={15} required aria-invalid={Boolean(errors.billingDetails)} aria-describedby={`billing-hint${errors.billingDetails ? " billingDetails-error" : ""}`} /><span className="field-hint" id="billing-hint">Enter your company GSTIN or personal PAN.</span>{errors.billingDetails && <span className="field-error" id="billingDetails-error">{errors.billingDetails}</span>}</div>
        </div>

        <div className="form-section-heading participation-heading"><span className="step-number">02</span><h3>Your participation</h3><span className="currency-label">INR</span></div>
        <div className="fee-options">
          <div className="fee-row"><div><span className="fee-label">Participation fees <span className="required">*</span></span><span className="fee-price">{formatMoney(PRICES.participation)} <small>/ person</small></span></div><Quantity label="Participation" value={participationQuantity} minimum={1} maximum={LIMITS.participation} onChange={updateParticipationQuantity} /></div>
          <div className="fee-row"><div><span className="fee-label">Standee placement <span className="optional">Optional</span></span><span className="fee-price">{formatMoney(PRICES.standee)} <small>/ standee</small></span></div><Quantity label="Standee" value={standeeQuantity} minimum={0} maximum={LIMITS.standee} onChange={setStandeeQuantity} /></div>
          <label className={`fee-row presentation-option${presentationSelected ? " selected" : ""}`} htmlFor="presentationSelected"><div><span className="fee-label">Company presentation</span><span className="fee-description">20-minute presentation slot</span><span className="fee-price">{formatMoney(PRICES.presentation)}</span></div><input id="presentationSelected" name="presentationSelected" type="checkbox" checked={presentationSelected} onChange={(event) => setPresentationSelected(event.target.checked)} /></label>
        </div>

        {participationQuantity > 1 && <p className="participant-count-hint" role="status">Add all {participationQuantity} participant names in Your details above.</p>}

        <div className="total-row"><div><span>Total amount</span><small>{participationQuantity} {participationQuantity === 1 ? "participant" : "participants"}{standeeQuantity > 0 ? ` · ${standeeQuantity} ${standeeQuantity === 1 ? "standee" : "standees"}` : ""}{presentationSelected ? " · Presentation" : ""}</small></div><output aria-label="Total amount" aria-live="polite">{formatMoney(total)}</output></div>
        {errorMessage && <div className="error-banner" role="alert">{errorMessage}</div>}
        <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="spinner" /> Saving registration…</> : <>Save & continue to payment <Icon name="arrow" size={19} /></>}</button>
        <p className="submit-note">Your registration is saved first. Try a demo payment in the next step.</p>
      </fieldset>
    </form>
  </div>;
}
