# Bengal Business Council registration

A responsive registration form for Aalap Alochona, 29 September 2026. Built with Next.js, React, TypeScript, and PostgreSQL. It includes every input visible in the reference: participation quantity, standee quantity, a 20-minute company presentation option, member name, email, Indian phone number, and GSTIN/PAN billing details.

## Run locally

Requires Node.js 22 or newer.

```powershell
npm install
# On a fresh checkout, copy .env.example to .env.local and set DATABASE_URL.
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:3000. The provided database connection is configured in the ignored `.env.local` file. Keep it private. Set `DATABASE_URL` in the server environment when deploying; never use a `NEXT_PUBLIC_` variable for database credentials.

```powershell
npm test
npm run typecheck
npm run build
npm start
```

## Database

`npm run db:migrate` applies the SQL files in `db/` in order, within a transaction. It creates `public.bbc_event_registrations`, `public.bbc_payment_attempts`, and their indexes. It does not alter unrelated tables. The migrations can be run again safely.

Each registration stores all form fields, the event name/date, unit prices and total in integer paise, INR currency, a unique reference, submission key, payment status, and creation timestamp. Phone numbers are stored in E.164 format in one column, for example `+917980729034`. The server uses parameterized queries, validates inputs, calculates authoritative totals, and prevents duplicate inserts when the same submission is retried. Database connections use verified TLS and channel binding.

Use the Neon SQL editor to view registrations:

```sql
SELECT reference, member_name, participant_names, email, phone,
       billing_details, participation_quantity, standee_quantity,
       presentation_selected, total_paise / 100.0 AS total_inr,
       payment_status, created_at
FROM public.bbc_event_registrations
ORDER BY created_at DESC;
```

`POST /api/registrations` accepts validated form submissions. There is no public API for listing or reading attendees' personal details. A matching retry returns the existing confirmation. Reusing a submission key with different values returns HTTP 409.

## Prices and payment

- Participation: ₹1,180 per person; 1–20 people per registration.
- Standee placement: ₹2,950 per standee; 0–10 per registration.
- Company presentation: ₹35,400 for a 20-minute slot.

Prices come from the supplied screenshot and are configured in `src/lib/registration.ts`. The quantity limits are configurable application defaults. The form stores the pending registration data, opens payment directly, and shows the registration confirmation only after a successful payment. Successful demo/test payments mark the registration `paid` and enable a downloadable QR code. See [PAYMENTS.md](PAYMENTS.md) for configuration, database details, and test commands.

## Integration verification

With the app running and `.env.local` configured:

```powershell
npm run test:integration
```

This creates a uniquely identified synthetic registration in the configured database, reads it back to verify every field, tests validation and concurrent retry protection, and deletes only that test record in a `finally` block. To target another local port, set `TEST_BASE_URL` first.

## Participant names

Your details appears before Your participation. The member name is participant 1 and the primary contact. Increasing participation adds required name fields for participants 2 onward; reducing it hides the extra fields. Previously typed names remain available if the count is increased again, but only names for the current quantity are submitted.

The server requires exactly one valid name per selected participant. All names are stored in order in `bbc_event_registrations.participant_names` and included in the confirmation and downloadable registration summary. `member_name` remains the primary contact for checkout. Migration `003_participant_names.sql` preserves the known primary name on older registrations; it does not invent names that were never collected.