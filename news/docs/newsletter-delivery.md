# Newsletter delivery — root cause, architecture, deployment

## Root cause of the missed deliveries

Analysis of the previous implementation (`src/lib/delivery.ts`, `src/app/api/cron/deliver/route.ts`, `vercel.json`):

1. **Trigger gap.** `vercel.json` scheduled `*/15 * * * *` → `/api/cron/deliver`. Vercel cron only runs on Vercel (and on Hobby only once per day). On Hostinger — or any non-Vercel host — nothing ever called the endpoint. No trigger = no sends.
2. **No cross-day catch-up.** `deliverDueNewsletters` sent only when `local.time >= dueTime` **and** `letterSendsOn(cadence, local.weekday)` was true *at that moment*. A tick landing before the send time or after the day ended skipped permanently — no record, no retry.
3. **Synchronous fan-out.** One `for await` loop over every subscriber × letter with a live Brevo HTTP call each. A function timeout — or one hung `fetch` (no timeout was configured) — aborted the run mid-cursor, deterministically skipping the tail of the list every run.
4. **No retry semantics.** `429`/5xx/timeout all collapsed to `"failed"`. No `Retry-After`, no backoff; `letterLastSent` was the only dedupe, so an ambiguous provider timeout could resend an already-accepted email.
5. **Observability gaps.** Brevo `messageId` was discarded; no suppression list; `recordDelivery` errors were swallowed; issue emails had no unsubscribe link.

Subscribers whose slot never coincided with a healthy tick simply got nothing — silently.

## What was built

A durable, MongoDB-backed delivery system. No Redis or new infrastructure.

- **Scheduler** — `src/lib/scheduler.ts`: pure, testable schedule math (daily / weekdays / weekly / trading-day / event), per-recipient `HH:MM` overrides with per-subscriber timezone (default `Asia/Kolkata`), due-slot computation with a catch-up horizon.
- **Engine** — `src/lib/deliveryEngine.ts`: `runSchedulerTick()` plans editions, creates delivery rows via a unique `(editionId, subscriptionId)` index (idempotent — safe for overlapping ticks), marks past-window rows `MISSED` with an explicit reason (never silently dropped), claims work with expiring leases (`findOneAndUpdate` atomicity prevents double-sends across workers), sends with provider `messageId` capture, exponential backoff, `Retry-After` honouring, pre-send revalidation (still subscribed, not suppressed, premium still valid), and heartbeat + run logging.
- **Editions** — `letterEditions` store a frozen snapshot (subject, article slugs, rendered-at) so retries resend the intended edition, not whatever is newest.
- **Deliveries** — `letterDeliveries` + `deliveryAttempts` hold the full lifecycle (`SCHEDULED → QUEUED → PROCESSING → SENT → DELIVERED`, plus `FAILED, MISSED, DELAYED, BOUNCED, SKIPPED, SUPPRESSED, CANCELLED, UNKNOWN`). Ambiguous provider timeouts become `UNKNOWN` and reconcile via webhooks, never blind resends.
- **Webhooks** — `POST /api/webhooks/brevo?token=…` persists raw events first (`webhookEvents`), dedupes, tolerates out-of-order delivery, updates deliveries by `message-id`/`X-Delivery-Id` tag, and auto-suppresses hard bounces and spam complaints (`suppressions`).
- **Templates** — `letterTemplates` collection; the original six are mirrored and the twelve new letters are seeded **inactive** via `$setOnInsert` (safe to re-run; admin edits are never overwritten). `scripts/seed-newsletters.mjs` runs the same seed standalone.
- **Admin** — `/admin/newsletters` with seven tabs (Overview, Templates, Editions, Subscribers, Delivery centre, Scheduler & logs, Settings), recipient-level filtering/pagination/CSV export (`/api/admin/deliveries.csv`), single & bulk retry (queued, not synchronous), run-now and reconcile actions — all gated to `admin`/`editor`, audited in `auditLog`.
- **Reader prefs** — `NewsletterCard` shows the effective send time (override or template default), a one-click restore-to-default, the reader's timezone, and the next edition date. Every issue email carries a signed unsubscribe link (`/unsubscribe`) plus `List-Unsubscribe`/`List-Unsubscribe-Post` headers served by `POST /api/unsubscribe` (RFC 8058).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `CRON_SECRET` | Bearer token for `GET /api/cron/deliver`. When unset the endpoint is open (local dev convenience — **set it in production**). |
| `BREVO_API_KEY` | Brevo transactional API key (existing). |
| `BREVO_SENDER_NAME` / `BREVO_SENDER_EMAIL` | From-name/address (existing). |
| `BREVO_WEBHOOK_SECRET` | Shared token checked as `?token=` on `/api/webhooks/brevo`. |
| `UNSUBSCRIBE_SECRET` | HMAC secret for unsubscribe links (falls back to `CRON_SECRET`, then `BREVO_API_KEY`). |
| `EMAIL_DRY_RUN` | `true` renders and records everything but never calls Brevo — use for dev/CI smoke tests. |
| `SITE_URL` | Base URL for unsubscribe/manage links in email footers. |

## Database

New collections (created + indexed automatically in `src/lib/db.ts` `connect()`):
`letterTemplates`, `letterEditions`, `letterDeliveries` (unique `editionId+subscriptionId`), `deliveryAttempts`, `webhookEvents` (unique `eventId+receivedAt`-style dedupe key), `schedulerRuns`, `schedulerState`, `suppressions`, `auditLog`.

No migration needed for existing data — the seed uses `$setOnInsert` only.

Optional explicit seed: `MONGODB_URI=… MONGODB_DB=… node scripts/seed-newsletters.mjs`

## Cron / scheduler configuration

The tick is trigger-agnostic; anything that can hit the endpoint every minute works.

- **Hostinger cron job** (hPanel → Advanced → Cron Jobs):
  `* * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/deliver >/dev/null 2>&1`
- **cron-job.org / EasyCron** — same request, 1-minute interval.
- **Vercel** — `vercel.json` now declares `* * * * *` (Pro tier; Hobby runs daily at most).

The engine is idempotent and lease-guarded, so overlapping triggers or multiple hosts are safe.

## Brevo webhook setup

Brevo dashboard → Transactional → Webhooks → add:

- URL: `https://<host>/api/webhooks/brevo?token=$BREVO_WEBHOOK_SECRET`
- Events: sent, delivered, deferred/delayed, hard bounce, soft bounce, blocked, spam complaint, unsubscribe (opens/clicks optional).

Delivered/bounce events update `letterDeliveries`; hard bounces and complaints write to `suppressions` and are excluded from all future sends.

## Test results

- `tsc --noEmit`: clean. `eslint`: clean (one pre-existing warning in `src/app/page/page.jsx`). `next build`: all routes compile, `/unsubscribe` prerenders via Suspense.
- Live tick: `plannedEditions 14, claimed 13, sent 13, missedMarked 93` — past-window slots recorded `MISSED` with reason "Send window expired before the scheduler ran."; in-window sends captured real Brevo message IDs.
- Webhook endpoint returns per-event results, dedupes unknown message-ids.
- `/api/unsubscribe` POST: valid signed token → `{ok:true}`; bad token → 400. `/unsubscribe` confirm page renders the letter name.
- `/api/admin/deliveries.csv` → 401 unauthenticated; `/admin/newsletters` redirects anonymous users to `/signin`.

## Important: real sends during verification

The first live smoke test ran with a real `BREVO_API_KEY` in `.env.local` and **13 real emails were sent** to existing subscriber addresses (all appear to be test mailboxes). Deliveries and attempts were recorded correctly. `EMAIL_DRY_RUN=true` now prevents this; keep it set in non-production environments.

## Known limitations

- Trading-day schedules skip weekends and configured holidays; Indian market-holiday calendars must be maintained in the schedule config (no auto-fetch).
- Open/click tracking is wired only if enabled in Brevo webhooks.
- One-minute ticks rely on an external trigger on Hostinger; if the host's cron stalls, the heartbeat in Scheduler & logs goes `STALLED` and catch-up marks appropriately on recovery.
- Bulk retry is queued in batches; very large backlogs are processed across successive ticks (max claimed per tick is bounded).
