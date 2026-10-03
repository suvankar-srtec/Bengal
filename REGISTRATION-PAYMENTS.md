# Registration verification and payment review

Spot registrations do not require OTP verification. They are saved as Unpaid. Verification codes are required only when a manager changes a registered WhatsApp number: send a code to the new number, then enter it and choose **Verify & save**. The existing number stays unchanged until the code is correct. Codes are bound to the manager, browser session, registration, and exact old/new numbers. The next screen offers Cash, Bank transfer, and a disabled Razorpay option. Cash requires admin confirmation; Bank requires a JPG, PNG, or PDF receipt (maximum 3 MB). Payment totals are computed from the stored registration, never from the browser.

Admins use **Notification** (a separate menu below Report) to download private receipts, approve payment, or reject with a reason. Managers cannot review payments or access receipts. Approval marks the registration Paid and queues QR pass links independently for WhatsApp and email. A failed channel does not resend an already accepted channel. Provider acceptance is not a delivery/read receipt.

## Setup before deployment

Apply `db/031_verification_and_payment_review.sql` `db/032_manager_phone_verification.sql`, and `db/033_notification_read_state.sql` before deploying the code, or run the existing `npm run db:migrate`. The migration runner replays all numbered migrations; migration 029 now preserves form payments approved through this workflow. Existing unpaid form records stay unpaid. Imports retain their existing paid status.

Configure these server-only settings in the live server environment and `.env.local` for development:

- `CONTACT_VERIFICATION_SECRET`: at least 32 random characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it private and consistent across application instances.
- Existing `WAPMONKEY_API_KEY`, `WAPMONKEY_DEVICE_TOKEN`, and `APP_PUBLIC_URL` (the public HTTPS app origin).
- `EMAIL_PROVIDER=smtp`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT=465` (TLS) or `587` (STARTTLS), `SMTP_USER`, and `SMTP_PASSWORD`.
- Alternatively, `EMAIL_PROVIDER=resend`, `EMAIL_FROM` on a verified sender domain, and `RESEND_API_KEY`.

The local verification secret has been generated, but no email credentials were provided during implementation. Spot registration and manager WhatsApp verification do not depend on an email sender. Configure and test the email sender to enable QR pass emails. No live email or WhatsApp test messages were sent.

The organizer provides bank account details directly to participants; the form asks them to upload proof after transferring. Razorpay is only a disabled choice; there is no checkout integration. The old public simulator endpoints now return HTTP 410 so they cannot bypass admin review.

## Delivery and retries

Pass email contains the same private page link as WhatsApp, allowing all participant QR images to be viewed and downloaded. The link normally expires after 30 days. Receipts are stored in PostgreSQL, not a public upload folder. Receipt downloads require an admin session and use attachment/no-store headers. Images are validated and re-encoded; PDFs are downloaded as attachments.

`npm run passes:retry` processes up to 25 existing queued deliveries. On the live server, schedule it every minute for durable retries after restarts. It does not create delivery requests for old registrations. There are up to three attempts with a one-minute delay. Unknown provider outcomes are not automatically resent; check the provider dashboard first. Admins can also retry pending/failed channels from an approved payment card. Existing import/report buttons now send through both channels.

Manager verification codes expire after 10 minutes and are consumed atomically when the number is saved. Five wrong guesses lock a challenge. Limits: one code per destination every 60 seconds, five per hour, 20 per manager per hour, and 60 per IP per hour. Only assigned managers can request or use a code. No public OTP endpoint is exposed. The reverse proxy must overwrite X-Real-IP/X-Forwarded-For rather than trusting incoming client values. Configure suitable edge/request limits for public endpoints. Expired challenge rows may be removed after one day; retain at least the last hour for rate limits.

## Verification

- `npm test`
- `npm run test:verification`
- `npm run test:whatsapp`
- With the local server running: `npm run test:notifications`
- Start the local server on 127.0.0.1:3000, then `npm run test:integration`.
- `npm run typecheck` and `npm run build`.

The integration test creates uniquely named temporary records, verifies OTP-free public submission and manager code expiry/session/number binding/attempt limits, checks private receipts and admin authorization, and exercises concurrent approval and channel-specific retries. It prevents delivery for those records when testing HTTP approval, then mocks provider HTTP calls in its own process. Cleanup removes only its own records.

SMTP reference: https://nodemailer.com/smtp
Resend idempotency reference: https://resend.com/docs/dashboard/emails/idempotency-keys

## Notification indicators

Blue means new unread payment requests; orange means requests still awaiting approval. Both dots can appear together. Opening Notification marks only the displayed records as read, clearing their blue indicator while pending requests keep the orange indicator. Approving or rejecting removes that request from the pending count. Read state is stored in PostgreSQL for the shared admin account, so it survives reloads and browser changes. Counts refresh every 20 seconds while the page is visible, on focus, and after reviewing a request. Use Refresh notifications to load new records into the list. Filtered-out records and later pages remain unread until displayed. The previous /report/payments link redirects to /notifications.
