export type PaymentMode = "demo" | "razorpay_test";
export type DemoMethod = "upi" | "card" | "netbanking";
export type PaymentAttempt = {
  id: string;
  mode: PaymentMode;
  orderId: string;
  paymentId: string | null;
  amountPaise: number;
  status: "created" | "succeeded" | "failed" | "cancelled";
  method: string | null;
};
export type CheckoutOrder = PaymentAttempt & { paymentUri?: string };
export type RazorpayProof = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
