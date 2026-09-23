# Verification

Verified locally on 23 September 2026 against the supplied Neon PostgreSQL database.

| Check | Result |
| --- | --- |
| Production build and TypeScript | Passed |
| Validation, pricing, and payment-security tests | 7 passed |
| Desktop form | All fields render; no browser errors |
| Mobile form | Verified at 390px; no horizontal overflow |
| Accessibility | axe-core: 0 violations, 0 incomplete checks on the mobile form |
| Required-field feedback | Empty submission displays field errors |
| Browser → API → database → confirmation | Passed with a real browser submission, followed by a database read |
| Prices | 2 participants + 1 standee + presentation = ₹40,710 |
| Concurrent retries | Two requests with the same submission key create exactly one record |
| Tampered totals/payment status | Ignored; server calculates the total and saves `unpaid` |
| Invalid/oversized/cross-origin requests | Rejected |
| Public attendee data access | GET endpoint unavailable |
| Credential isolation | Database password absent from public browser bundles |
| Synthetic database records | Removed after verification using their unique test identifiers |

The confirmation text and filename were verified separately. Actual file saving could not be verified: the automated browser canceled downloads, including a separate plain-text probe unrelated to the app.

Payment collection and email delivery are not implemented. The requested registration data is stored, and the confirmation clearly indicates that no payment was collected.

Desktop and mobile screenshots are in the ignored `artifacts/` directory. See `README.md` for startup instructions and database access.

## Razorpay demo verification

- Production build and TypeScript passed after adding payment routes.
- Payment integration checks passed: registration access, origin/size validation, authoritative totals, concurrent order creation, cancellation, failure, retries, duplicate completion protection, and unchanged real payment status.
- Browser flow passed at desktop and 390px mobile widths: UPI failure, card cancellation with Escape, netbanking success, and confirmation display.
- Database reads confirmed all three browser outcomes, selected methods, amounts, and simulated transaction identifiers. Synthetic registrations and linked payment attempts were removed afterward.
- Checkout accessibility scan: zero violations; the tool left decorative icon contrast for manual review. Icons were visually inspected.
- Official Razorpay Test Mode is implemented but not exercised against the provider because test API keys were not supplied. Live keys are rejected. See PAYMENTS.md for setup and limitations.