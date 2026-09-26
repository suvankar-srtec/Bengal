# WhatsApp participant passes

Payment completion queues one WhatsApp message containing an individual PNG pass for every participant. The recipient, names, event and meal come from the saved paid registration. Browser previews and downloads use the same images. This app currently uses **manual UPI payment confirmation**; this integration does not verify a bank transaction.

Set these server environment variables locally and on the deployment:

```dotenv
APP_PUBLIC_URL=https://bengal-bbc.vercel.app
WAPMONKEY_API_KEY=your-api-key
WAPMONKEY_DEVICE_TOKEN=your-device-token
```

Never prefix credentials with `NEXT_PUBLIC_` or commit them. Keep the WapMonkey device connected.

Deploy the new code and apply `db/019_whatsapp_pass_delivery.sql` before accepting payments. The normal build migration also includes this table. WapMonkey must be able to fetch `/api/passes/<random-token>/<participant>.png` without a login or deployment-protection screen. Media URLs expire after 30 days, contain a 256-bit random token, and stop working if the registration is no longer paid. Treat the URLs as private bearer links. Billing details, email addresses and submission credentials are not included in passes or sent to WapMonkey.

The provider API is documented at https://panel.wapmonkey.com/api-documentation: `POST https://api.wapmonkey.com/v1/sendmessage`, raw API key in `Authorization`, JSON `device_token`, country-code `numbers`, `message`, and a `media` array of `{url, name, caption}`. It accepts publicly reachable media URLs. A response with `status: 1` and `data.messageId` means accepted/queued, not confirmed delivery to the phone.

The database row is queued in the payment transaction. Next.js `after()` starts delivery after the response, even if the browser closes. An atomic claim prevents concurrent requests from duplicating a send; an accepted delivery is never automatically resent. Known failures can be retried after one minute, up to three attempts. Timeouts, unexpected responses and interrupted sends are marked `unknown` and require checking WapMonkey's message report before any manual resend.

The confirmation screen provides a retry button. To recover pending jobs after a server interruption or retry known failures without the browser, run `npm run whatsapp:retry` with the same server environment (or schedule that command on your worker). No scheduler is installed automatically. This command only processes existing jobs; it does not backfill old paid registrations.

Validation: `npm test`, `npm run test:whatsapp`, `npm run typecheck`. The WhatsApp unit tests use mocked HTTP and never send messages. A live test requires the deployed media route and a recipient who has agreed to receive the test pass.
