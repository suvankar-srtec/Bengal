import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { paymentConfiguration, verifyPaymentSignature } from "../src/lib/payment-security";

test("uses the simulator by default and requires explicit test-mode configuration", () => {
  assert.equal(paymentConfiguration({}).mode, "demo");
  assert.equal(paymentConfiguration({ RAZORPAY_KEY_ID: "rzp_live_example" }).mode, "demo");
  assert.throws(() => paymentConfiguration({ PAYMENT_MODE: "live" }));
  assert.throws(() => paymentConfiguration({ PAYMENT_MODE: "razorpay_test" }));
  assert.throws(() => paymentConfiguration({ PAYMENT_MODE: "razorpay_test", RAZORPAY_KEY_ID: "rzp_live_example", RAZORPAY_KEY_SECRET: "example" }));
  assert.equal(paymentConfiguration({ PAYMENT_MODE: "razorpay_test", RAZORPAY_KEY_ID: "rzp_test_example", RAZORPAY_KEY_SECRET: "example" }).mode, "razorpay_test");
});

test("payment signatures bind the stored order, payment ID, and server secret", () => {
  const secret = "unit-test-secret-not-a-real-key";
  const signature = createHmac("sha256", secret).update("order_unit|pay_unit").digest("hex");
  assert.equal(verifyPaymentSignature("order_unit", "pay_unit", signature, secret), true);
  assert.equal(verifyPaymentSignature("order_other", "pay_unit", signature, secret), false);
  assert.equal(verifyPaymentSignature("order_unit", "pay_other", signature, secret), false);
  assert.equal(verifyPaymentSignature("order_unit", "pay_unit", signature, "incorrect"), false);
  for (const malformed of ["", "x".repeat(64), "0".repeat(63), "0".repeat(65)]) {
    assert.equal(verifyPaymentSignature("order_unit", "pay_unit", malformed, secret), false);
  }
});
