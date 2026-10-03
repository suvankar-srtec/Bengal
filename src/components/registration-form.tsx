"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { calculateTotal, formatMoney, LIMITS, mealChoicesLabel, registrationSchema, registrationFieldKey, type FieldErrors, type ParticipationPrices, type RegistrationReceipt } from "@/lib/registration";
import { RegistrationPayment } from "./registration-payment";
import { Icon } from "./icon";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";

function Quantity({ label, value, minimum, maximum, onChange }: {
  label: string; value: number; minimum: number; maximum: number; onChange: (value: number) => void;
}) {
  return <div className="quantity" role="group" aria-label={`${label} quantity`}>
    <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= minimum} onClick={() => onChange(value - 1)}><Icon name="minus" size={14} /></button>
    <output aria-label={`${label} quantity`} aria-live="polite">{value}</output>
    <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= maximum} onClick={() => onChange(value + 1)}><Icon name="plus" size={14} /></button>
  </div>;
}

export function RegistrationForm({ eventContentId, prices }: { eventContentId: number | null; prices: ParticipationPrices }) {
  const [additionalParticipants, setAdditionalParticipants] = useState<Array<{ id: number; name: string; email: string; phone: string }>>([]);
  const nextParticipantId = useRef(0);
  const [standeeQuantity, setStandeeQuantity] = useState(0);
  const [presentationSelected, setPresentationSelected] = useState(false);
  const [fields, setFields] = useState({ memberName: "", email: "", phone: "", billingDetails: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);
  const submission = useRef<{ key: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const [paymentSubmissionId, setPaymentSubmissionId] = useState("");
  const storageKey = `bbc-registration-payment-${eventContentId ?? "default"}`;
  const participationQuantity = 1 + additionalParticipants.length;
  const total = calculateTotal({ participationQuantity, standeeQuantity, presentationSelected }, prices);

  const focusAfterReset = useRef(false);
  const resetForm = useCallback(() => {
    focusAfterReset.current = true;
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be disabled. */ }
    setPaymentSubmissionId("");
    setReceipt(null);
    setFields({ memberName: "", email: "", phone: "", billingDetails: "" });
    setAdditionalParticipants([]);
    setStandeeQuantity(0);
    setPresentationSelected(false);
    setErrors({});
    setErrorMessage("");
    setIsSubmitting(false);
    submission.current = null;
    inFlight.current = false;
  }, [storageKey]);

  useEffect(() => {
    if (!receipt) {
      if (focusAfterReset.current) {
        document.getElementById("memberName")?.focus();
        focusAfterReset.current = false;
      }
      return;
    }
  }, [receipt, resetForm]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved && Date.now() - saved.savedAt < 86400000 && typeof saved.submissionId === "string" && saved.receipt?.id) {
        setReceipt(saved.receipt); setPaymentSubmissionId(saved.submissionId);
      }
    } catch { /* Storage is optional; registration still works without it. */ }
  }, [storageKey]);

  function updateField(field: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setErrorMessage("");
  }

  function updateParticipant(index: number, field: "name" | "email" | "phone", value: string) {
    setAdditionalParticipants((current) => current.map((participant, i) => i === index ? { ...participant, [field]: value } : participant));
    const key = `participant${field === "name" ? "Name" : field === "email" ? "Email" : "Phone"}${index + 2}`;
    setErrors((current) => ({ ...current, [key]: undefined }));
    setErrorMessage("");
  }

  function clearParticipantErrors() {
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !/^participant(Name|Email|Phone)/.test(key))));
    setErrorMessage("");
  }

  function addParticipant() {
    const id = nextParticipantId.current++;
    setAdditionalParticipants((current) => current.length < LIMITS.participation - 1 ? [...current, { id, name: "", email: "", phone: "" }] : current);
    clearParticipantErrors();
  }

  function removeParticipant(index: number) {
    setAdditionalParticipants((current) => current.filter((_, i) => i !== index));
    clearParticipantErrors();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setErrorMessage("");
    const values = { eventContentId, ...fields, email: fields.email.trim(), participationQuantity, standeeQuantity, mealChoice: null, presentationSelected, additionalParticipantNames: additionalParticipants.map(({ name }) => name), additionalParticipantContacts: additionalParticipants.map(({ email, phone }) => ({ email, phone })) };
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
      setPaymentSubmissionId(parsed.data.submissionId);
      setReceipt(result.registration);
      try { sessionStorage.setItem(storageKey, JSON.stringify({ receipt: result.registration, submissionId: parsed.data.submissionId, savedAt: Date.now() })); } catch { /* Storage may be disabled. */ }
    } catch (error) {
      setErrorMessage(error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
        ? error.message
        : "The connection was interrupted. Your details are still here. Please try again; a retry won’t create a duplicate.");
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  if (receipt) return <RegistrationPayment receipt={receipt} submissionId={paymentSubmissionId} onReset={resetForm} />;

  return <div className="registration-card">
    <div className="form-heading"><div><span className="eyebrow">JOIN THE CONVERSATION</span><h2>Reserve your place</h2></div><img className="form-heading-logo" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" /></div>
    <p className="form-intro">A few details. A world of possibilities.</p>

    <form onSubmit={submit} noValidate>
      <fieldset disabled={isSubmitting}>
        <legend className="sr-only">Event registration details</legend>
        <div className="form-section-heading"><span className="step-number">01</span><h3>Your details</h3><span className="required-note">* Required</span></div>
        <div className="fields-grid">
          <div className="field full-width">
            <div className="member-name-label-row">
              <label htmlFor="memberName">Member name <span className="required">*</span></label>
              <button className="member-add-button" type="button" onClick={addParticipant} disabled={participationQuantity >= LIMITS.participation} aria-label="Add another participant" title="Add participant with contact details"><Icon name="plus" size={15} /></button>
            </div>
            <input
              id="memberName"
              name="memberName"
              autoComplete="name"
              placeholder="Your full name"
              value={fields.memberName}
              onChange={(event) => updateField("memberName", event.target.value)}
              maxLength={120}
              required
              aria-invalid={Boolean(errors.memberName)}
              aria-describedby={errors.memberName ? "memberName-error" : undefined}
            />
            {errors.memberName && <span className="field-error" id="memberName-error">{errors.memberName}</span>}
          </div>
          <div className="field full-width"><label htmlFor="email">Email address <span className="required">*</span></label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={fields.email} onChange={(event) => updateField("email", event.target.value)} maxLength={254} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />{errors.email && <span className="field-error" id="email-error">{errors.email}</span>}</div>
          <div className="field full-width"><label htmlFor="phone">WhatsApp number <span className="required">*</span></label><div className={`phone-input${errors.phone ? " invalid" : ""}`}><span><span className="sr-only">India country code </span>IN <span>+91</span></span><input id="phone" name="phone" type="tel" autoComplete="tel-national" inputMode="numeric" placeholder="10-digit WhatsApp number" value={fields.phone} onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} required aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} /></div>{errors.phone && <span className="field-error" id="phone-error">{errors.phone}</span>}</div>
          {additionalParticipants.map((participant, index) => {
            const number = index + 2;
            const nameId = `participantName${number}` as const;
            const emailId = `participantEmail${number}` as const;
            const phoneId = `participantPhone${number}` as const;
            return <fieldset className="additional-participant-card full-width" key={participant.id}>
              <legend className="sr-only">Participant {number} details</legend>
              <div className="additional-participant-heading">
                <div><span className="additional-participant-number">{String(number).padStart(2, "0")}</span><strong>Participant {number}</strong></div>
                <button className="member-remove-button" type="button" onClick={() => removeParticipant(index)} aria-label={`Remove participant ${number}`} title="Remove participant"><Icon name="minus" size={15} /></button>
              </div>
              <div className="additional-participant-fields">
                <div className="field">
                  <label htmlFor={nameId}>Full name <span className="required">*</span></label>
                  <input id={nameId} name={nameId} autoFocus autoComplete="off" placeholder="Participant full name" value={participant.name} onChange={(event) => updateParticipant(index, "name", event.target.value)} maxLength={120} required aria-invalid={Boolean(errors[nameId])} aria-describedby={errors[nameId] ? `${nameId}-error` : undefined} />
                  {errors[nameId] && <span className="field-error" id={`${nameId}-error`}>{errors[nameId]}</span>}
                </div>
                <div className="field">
                  <label htmlFor={phoneId}>WhatsApp number <span className="required">*</span></label>
                  <div className={`phone-input${errors[phoneId] ? " invalid" : ""}`}><span><span className="sr-only">India country code </span>IN <span>+91</span></span><input id={phoneId} name={phoneId} type="tel" autoComplete="off" inputMode="numeric" placeholder="10-digit WhatsApp number" value={participant.phone} onChange={(event) => updateParticipant(index, "phone", event.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} required aria-invalid={Boolean(errors[phoneId])} aria-describedby={errors[phoneId] ? `${phoneId}-error` : undefined} /></div>
                  {errors[phoneId] && <span className="field-error" id={`${phoneId}-error`}>{errors[phoneId]}</span>}
                </div>
                <div className="field">
                  <label htmlFor={emailId}>Email address <span className="required">*</span></label>
                  <input id={emailId} name={emailId} type="email" autoComplete="off" placeholder="participant@company.com" value={participant.email} onChange={(event) => updateParticipant(index, "email", event.target.value)} maxLength={254} required aria-invalid={Boolean(errors[emailId])} aria-describedby={errors[emailId] ? `${emailId}-error` : undefined} />
                  {errors[emailId] && <span className="field-error" id={`${emailId}-error`}>{errors[emailId]}</span>}
                </div>
              </div>
            </fieldset>;
          })}
          <div className="field full-width"><label htmlFor="billingDetails">Billing details <span className="optional">Optional</span></label><input id="billingDetails" name="billingDetails" autoCapitalize="characters" spellCheck={false} placeholder="GST number or PAN number" value={fields.billingDetails} onChange={(event) => updateField("billingDetails", event.target.value.toUpperCase())} maxLength={15} aria-invalid={Boolean(errors.billingDetails)} aria-describedby={`billing-hint${errors.billingDetails ? " billingDetails-error" : ""}`} /><span className="field-hint" id="billing-hint">Optional. Enter your company GSTIN or personal PAN if required.</span>{errors.billingDetails && <span className="field-error" id="billingDetails-error">{errors.billingDetails}</span>}</div>
        </div>

        <div className="form-section-heading participation-heading"><span className="step-number">02</span><h3>Your participation</h3><span className="currency-label">INR</span></div>
        <div className="fee-options">
          <div className="fee-row"><div><span className="fee-label">Participation fees <span className="required">*</span></span><span className="fee-description">Includes: {mealChoicesLabel(prices.includedMeals)}</span><span className="fee-price">{formatMoney(prices.participation)} <small>/ person</small></span></div><div className="participant-fee-count" aria-label="Participant count"><span>{participationQuantity}</span> {participationQuantity === 1 ? "person" : "people"}</div></div>
          <div className="fee-row"><div><span className="fee-label">Standee placement <span className="optional">Optional</span></span><span className="fee-price">{formatMoney(prices.standee)} <small>/ standee</small></span></div><Quantity label="Standee" value={standeeQuantity} minimum={0} maximum={LIMITS.standee} onChange={setStandeeQuantity} /></div>
          <label className={`fee-row presentation-option${presentationSelected ? " selected" : ""}`} htmlFor="presentationSelected"><div><span className="fee-label">Company presentation</span><span className="fee-description">20-minute presentation slot</span><span className="fee-price">{formatMoney(prices.presentation)}</span></div><input id="presentationSelected" name="presentationSelected" type="checkbox" checked={presentationSelected} onChange={(event) => setPresentationSelected(event.target.checked)} /></label>
        </div>


        <div className="total-row"><div><span>Total amount</span><small>{participationQuantity} {participationQuantity === 1 ? "participant" : "participants"}{standeeQuantity > 0 ? ` · ${standeeQuantity} ${standeeQuantity === 1 ? "standee" : "standees"}` : ""}{presentationSelected ? " · Presentation" : ""}</small></div><output aria-label="Total amount" aria-live="polite">{formatMoney(total)}</output></div>
        {errorMessage && <div className="error-banner" role="alert">{errorMessage}</div>}
        <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="spinner" /> Saving registration...</> : <>Submit registration <Icon name="arrow" size={19} /></>}</button>
        <p className="submit-note">Your registration details will be saved when you submit this form.</p>
      </fieldset>
    </form>
  </div>;
}
