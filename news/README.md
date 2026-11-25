This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Newsletter delivery

`GET /api/cron/deliver` runs one delivery tick: for every subscriber, each
subscribed letter that is due (cadence covers their local weekday and their
local time passed the send time — the reader's per-letter override, else the
cadence's own time) gets the issue email via Brevo. `letterLastSent` on the
subscriber doc makes ticks idempotent, so the cron can run often.

- `vercel.json` schedules it every 15 minutes on Vercel. Self-hosted instead?
  Point any scheduler at the same URL:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/deliver`
- `CRON_SECRET` — required bearer token in production; unset = open for local dev.
- `DELIVERY_TZ` — fallback zone (default `Asia/Kolkata`) for subscribers who
  never picked a time; picked times store the browser's own zone.
- `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` — transport.
- `SITE_URL` — links inside the emails.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
