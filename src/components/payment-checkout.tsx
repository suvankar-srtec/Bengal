"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney, type RegistrationReceipt } from "@/lib/registration";
import type { CheckoutOrder, DemoMethod, PaymentAttempt, RazorpayProof } from "@/lib/payment-types";
import { Icon } from "./icon";

type RazorpayInstance = { open: () => void; on: (event: string, handler: () => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string; order_id: string; amount: number; currency: string; name: string; description: string;
      prefill: { name: string; email: string; contact: string }; theme: { color: string };
      handler: (proof: RazorpayProof) => void; modal: { ondismiss: () => void };
    }) => RazorpayInstance;
  }
}

let sdkPromise: Promise<void> | undefined;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!sdkPromise) sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => { clearTimeout(timer); script.remove(); sdkPromise = undefined; reject(new Error("Razorpay checkout could not load. Check your connection and retry.")); };
    const timer = setTimeout(fail, 15000);
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => { clearTimeout(timer); if (window.Razorpay) resolve(); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return sdkPromise;
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/payments/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Checkout could not continue. Please try again.");
  return result as T;
}

function errorText(error: unknown) {
  return error instanceof Error && !["TypeError", "TimeoutError"].includes(error.name)
    ? error.message : "The connection was interrupted. Please retry; the same attempt will not be recorded twice.";
}

const methods: { id: DemoMethod; label: string; symbol: string }[] = [
  { id: "upi", label: "UPI", symbol: "↗" },
  { id: "card", label: "Card", symbol: "▤" },
  { id: "netbanking", label: "Netbanking", symbol: "⌂" },
];

export function PaymentCheckout({ registration, submissionId, member }: {
  registration: RegistrationReceipt;
  submissionId: string;
  member: { memberName: string; email: string; phone: string };
}) {
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [result, setResult] = useState<PaymentAttempt | null>(null);
  const [method, setMethod] = useState<DemoMethod>("upi");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingProof, setPendingProof] = useState<RazorpayProof | null>(null);
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const access = { registrationId: registration.id, submissionId };

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  async function verifyTestPayment(checkoutOrder: CheckoutOrder, proof: RazorpayProof) {
    setBusy(true);
    inFlight.current = true;
    setPendingProof(proof);
    setError("");
    try {
      const response = await api<{ payment: PaymentAttempt }>("complete", { ...access, attemptId: checkoutOrder.id, ...proof });
      setResult(response.payment);
      setPendingProof(null);
      setNotice("");
    } catch (failure) { setError(errorText(failure)); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    let externalOpened = false;
    try {
      const response = await api<{ order: CheckoutOrder }>("order", access);
      const checkoutOrder = response.order;
      setOrder(checkoutOrder);
      if (checkoutOrder.status === "succeeded") { setResult(checkoutOrder); return; }
      if (checkoutOrder.mode === "demo") { setOpen(true); return; }

      await loadRazorpay();
      if (!window.Razorpay || !checkoutOrder.keyId) throw new Error("Razorpay Test Mode is not configured.");
      let settled = false;
      const checkout = new window.Razorpay({
        key: checkoutOrder.keyId, order_id: checkoutOrder.orderId, amount: checkoutOrder.amountPaise,
        currency: "INR", name: "Bengal Business Council", description: "Aalap Alochona · Test payment",
        prefill: { name: member.memberName, email: member.email, contact: `+91${member.phone}` },
        theme: { color: "#c74c40" },
        handler: (proof) => { settled = true; void verifyTestPayment(checkoutOrder, proof); },
        modal: { ondismiss: () => {
          if (!settled) { inFlight.current = false; setBusy(false); setNotice("Test checkout closed. Your registration is saved; you can reopen checkout."); }
        } },
      });
      checkout.on("payment.failed", () => setNotice("The test payment failed. Retry in checkout or close it to try later."));
      checkout.open();
      externalOpened = true;
    } catch (failure) { setError(errorText(failure)); }
    finally { if (!externalOpened) { inFlight.current = false; setBusy(false); } }
  }

  async function finish(outcome: "succeeded" | "failed" | "cancelled") {
    if (!order || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api<{ payment: PaymentAttempt }>("complete", { ...access, attemptId: order.id, outcome, method });
      setResult(response.payment);
      setOpen(false);
    } catch (failure) { setError(errorText(failure)); }
    finally { inFlight.current = false; setBusy(false); }
  }

  const completed = result?.status === "succeeded";

  return <section className="payment-panel" aria-label="Payment demo">
    <div className="payment-panel-heading"><strong>Razorpay payment demo</strong><span className="demo-pill">NO REAL MONEY</span></div>
    <p>Try checkout with your registration total. Demo and test payments never charge real money.</p>
    {completed ? <div className="payment-result payment-result-success" role="status">
      <span className="payment-result-title"><Icon name="check" size={18} /> {result.mode === "demo" ? "Demo payment successful" : "Razorpay test payment verified"}</span>
      <span>{formatMoney(result.amountPaise)} · {result.method?.toUpperCase()}</span>
      <code>{result.paymentId}</code>
      <small>{result.mode === "demo" ? "Simulated transaction saved. No money was charged." : "Test transaction verified and saved. No real money was charged."}</small>
    </div> : <>
      {result?.status === "failed" && <p className="payment-feedback" role="status">Demo payment failed as requested. Your registration is saved. Try again to see a successful payment.</p>}
      {result?.status === "cancelled" && <p className="payment-feedback" role="status">Checkout cancelled. Your registration is saved and you can retry.</p>}
      {notice && <p className="payment-feedback" role="status">{notice}</p>}
      {!open && error && <div className="error-banner" role="alert">{error}</div>}
      <button type="button" className="submit-button payment-launch" disabled={busy} onClick={() => {
        if (pendingProof && order) void verifyTestPayment(order, pendingProof); else void start();
      }}>{busy ? <><span className="spinner" /> Please wait…</> : pendingProof ? "Retry test payment verification" : <>{result ? "Retry" : "Try"} payment · {formatMoney(registration.totalPaise)} <Icon name="arrow" size={16} /></>}</button>
    </>}

    <dialog className="checkout-dialog" ref={dialog} aria-labelledby="checkout-title" aria-describedby="checkout-description" onCancel={(event) => { event.preventDefault(); if (!busy) void finish("cancelled"); }}>
      <div className="checkout-banner"><span>SIMULATED CHECKOUT</span><span>No real money</span></div>
      <div className="checkout-header"><div className="checkout-merchant-mark" aria-hidden="true">b.</div><div><h2 id="checkout-title">Bengal Business Council</h2><p>Aalap Alochona · 29 September</p></div><button type="button" className="checkout-close" aria-label="Cancel checkout" disabled={busy} onClick={() => void finish("cancelled")}>×</button></div>
      <div className="checkout-content">
        <div className="checkout-amount"><span>Amount to pay</span><strong>{formatMoney(order?.amountPaise ?? registration.totalPaise)}</strong></div>
        <p className="checkout-description" id="checkout-description">A Razorpay-style demo. Choose a sample payment method to explore the flow.</p>
        <fieldset className="payment-methods" disabled={busy}><legend>Payment method</legend><div className="payment-method-options">{methods.map((option) => <label key={option.id} className={method === option.id ? "active" : ""}><input type="radio" name="demo-method" value={option.id} checked={method === option.id} onChange={() => setMethod(option.id)} /><span aria-hidden="true">{option.symbol}</span>{option.label}</label>)}</div></fieldset>

        <div className="sample-payment" aria-live="polite">
          {method === "upi" && <><span className="sample-label">SAMPLE UPI ACCOUNT</span><strong>demo@razorpay</strong><p>A simulated UPI approval. No payment app will open.</p></>}
          {method === "card" && <><span className="sample-label">SAMPLE CARD</span><strong className="sample-card-number">4111 1111 1111 1111</strong><div className="sample-card-details"><span>DEMO MEMBER</span><span>12/30 · CVV •••</span></div><p>Sample details only. No card information is collected.</p></>}
          {method === "netbanking" && <><span className="sample-label">SAMPLE NETBANKING</span><strong>Demo Bank</strong><p>A simulated bank approval. No bank login is needed.</p></>}
        </div>

        {open && error && <div className="error-banner" role="alert">{error}</div>}
        <button type="button" className="submit-button checkout-pay" disabled={busy} onClick={() => void finish("succeeded")}>{busy ? <><span className="spinner" /> Saving result…</> : <>Pay {formatMoney(order?.amountPaise ?? registration.totalPaise)} <span>DEMO</span></>}</button>
        <div className="checkout-secondary"><button type="button" disabled={busy} onClick={() => void finish("failed")}>Simulate failure</button><button type="button" disabled={busy} onClick={() => void finish("cancelled")}>Cancel payment</button></div>
      </div>
      <div className="checkout-footer"><Icon name="lock" size={13} /><span>Demo only · No real money or payment credentials</span></div>
    </dialog>
  </section>;
}
