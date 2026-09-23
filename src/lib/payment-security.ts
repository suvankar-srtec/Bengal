import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMode } from "./payment-types";

export function paymentConfiguration(env: Record<string, string | undefined>) {
  const mode = env.PAYMENT_MODE ?? "demo";
  if (mode === "demo") return { mode: "demo" as PaymentMode, keyId: "", secret: "" };
  if (mode !== "razorpay_test") throw new Error("PAYMENT_MODE must be demo or razorpay_test.");
  if (!env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Configure Razorpay test keys. Live keys are not supported by this demo.");
  }
  return { mode: "razorpay_test" as PaymentMode, keyId: env.RAZORPAY_KEY_ID, secret: env.RAZORPAY_KEY_SECRET };
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
