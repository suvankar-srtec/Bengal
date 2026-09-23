# Razorpay payment demo

The registration confirmation now includes a **Try payment** button. It uses the total saved on the server and opens a checkout demo with UPI, card, and netbanking sample methods. Users can simulate success, failure, or cancellation, then retry. No actual payment credentials are collected by the simulator.

## Default: local simulator

No Razorpay account or API key is required. `PAYMENT_MODE` defaults to `demo`. Apply the database migration and start the app:

```powershell
npm run db:migrate
npm run dev
```

Complete the registration, click **Try payment**, choose a method, and click **Pay … DEMO**. **Simulate failure** and **Cancel payment** exercise the alternate outcomes. Demo order and payment IDs start with `demo_` and are never represented as Razorpay-issued IDs.

`public.bbc_payment_attempts` stores the registration ID, mode, order/payment identifiers, authoritative amount in paise, method, status, and timestamps. Failed and cancelled attempts remain in the history. Retrying order creation or completion does not create duplicate active attempts or payment records.

## Optional: official Razorpay Test Mode

Set these server-only values in `.env.local` and restart the app:

```dotenv
PAYMENT_MODE=razorpay_test
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_TEST_SECRET
```

Use your own test keys from the Razorpay dashboard. Do not commit `.env.local`. This demo rejects live-mode keys and does not support live charges.

In this mode the server creates an order using Razorpay's API. The browser loads official Razorpay Checkout from `checkout.razorpay.com`, prefills the member's details, and returns the payment proof to the server. The server verifies the HMAC signature against its stored order ID, then fetches the payment from Razorpay to verify the order, INR currency, amount, and captured state. Only then is the **test attempt** recorded as successful. A pending capture can be checked again using **Retry test payment verification**.

The test path is implemented but requires your Razorpay test keys for a real provider test. Signature/configuration checks have unit tests. This demo does not implement webhook reconciliation if the browser closes before verification. It is not a production payment integration.

Both modes leave `bbc_event_registrations.payment_status` as `unpaid`, because no real payment has been collected. Test outcomes are stored separately, with `mode` distinguishing the simulator from Razorpay Test Mode.

## Endpoints and checks

- `POST /api/payments/order`: accepts registration ID and the original submission UUID; returns the active/successful attempt or creates one. The amount and mode come from the server.
- `POST /api/payments/complete`: accepts the same registration access values and attempt ID. Simulator outcomes are accepted only for simulator attempts. Razorpay Test Mode requires verified provider proof.
- No public API exposes payment histories or attendee data.

```powershell
npm test
npm run test:integration
npm run test:payments
```

Run `test:payments` against a server in `demo` mode. It inserts a uniquely identified registration, checks concurrency, validation, cancellation, failure, retry, success, persistence, and status isolation, then deletes only its synthetic registration and linked attempts.

Official reference: [Razorpay Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [create orders](https://razorpay.com/docs/api/orders/create/), and [fetch a payment](https://razorpay.com/docs/api/payments/fetch-with-id/).
