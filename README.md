# Awaj ET — Client Portal

Standalone, client-only portal (PIN login, read-only) combining:

- **Dashboard** — Meta ad campaign report (spend, reach, clicks, leads,
  CPL/CPR, daily trend, campaign table with drill-down `/c/[id]`,
  additional charges) — ported from the reports app's client view
- **Posts** — upcoming scheduled posts (FB + IG queue) and recently
  published, from the scheduler's data
- **Calendar** — month grid of scheduled + published posts
- **Insights** — social reach/engagement charts and top posts
- **Issues** — clients raise issues/requests; Awaj ET replies show up
  here (admin side stays in the reports app). New issues ping the team
  on Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in .env;
  best-effort — Telegram being down never blocks the client)

On a queued (pending/approved) post's detail page, clients can approve
it, reschedule it, or edit its caption — the portal's only writes to
the scheduler's `fb_queue`/`ig_queue`, each checked against the
client's own queue keys (`lib/clientpage.ts`) and pinged to Telegram.
Approval is a sign-off only (pending and approved both publish on
schedule); a caption edit resets the post to pending. Media changes
and publishing stay with the team in the scheduler.

**Planned posts (no page linked yet).** The team can plan content for
companies without `fbPageId` — the scheduler stores it in the same
queues under the key `co:<companyId>` with status `planned` /
`planned_ok`, which its publishers never pick up (`lib/planned.ts`).
Those clients still get Calendar, Posts and Overview "Upcoming"; each
planned post's page offers per-file downloads (Appwrite `/download`
URL), Copy caption, the same approve/reschedule/edit controls, and —
once it's due — "I posted this" (`posted_manually`). When `fbPageId` is
later set, the scheduler auto-moves still-future planned posts onto
the real page (its `lib/promote.ts`); past-due ones stay manual. The
portal reads both keys after linking, and picks up a newly set
`fbPageId` live, without a re-login.

No other admin features exist in this app. Clients log in with the **same PIN
as the reports app** (`companies` collection, shared Appwrite database);
the session is an HMAC-signed cookie scoped to their company + FB page
(`fbPageId` attribute on the company doc — see the scheduler's
`setup-client-portal.mjs`). Companies without `fbPageId` can still use
Dashboard, Issues and their planned posts; Insights shows a "not linked"
notice. This
`fbPageId` field is also the sole source of truth for which Facebook
Pages the app is allowed to fetch (see `lib/pages.ts`); there's no
separate page-id allowlist to keep in sync.

## Setup

```bash
cp .env.example .env   # Appwrite (required), AUTH_SECRET (required),
                       # FB_SYSTEM_USER_TOKEN (social pages — page ids
                       # come from each company's fbPageId in Appwrite)
npm install
npm run dev            # http://localhost:3002
```

Data is written by the other apps — the reports app syncs ad insights
into `insights_daily`, the scheduler owns posting/queues and nightly
syncs organic (Page + IG Insights) stats into `organic_stats_daily`
(its lib/organicStats.ts, cron via GitHub Actions — see its
`organic-stats-cron.yml`). This portal only reads (plus creating issue
documents), so it needs no cron jobs of its own.

Organic Insights has a "Sync from Meta" button (linked pages only) that
calls the scheduler's `/api/cron/organic-stats?company=<id>&days=3` for
the client's own company — the scheduler still does the actual Meta
calls and writes. It needs `SCHEDULER_URL` (scheduler origin, no
trailing slash) and `SCHEDULER_CRON_SECRET` (the scheduler's
`CRON_SECRET`) in `.env`; without them the button is hidden. One
manual sync per company per 15 minutes.

Overview and Insights read `organic_stats_daily` for their stat
tiles/charts (fast — no live Meta calls, but only ever covers through
yesterday); "Upcoming"/"Recently published"/"Top posts" content sections
still call the Graph API live on every request, since that data isn't
cached.

## Relationship to the other Awaj apps

| App        | Port | Role                                              |
| ---------- | ---- | ------------------------------------------------- |
| leadgen    | 3000 | Team: leads, contacts, email                      |
| reports    | 3001 | Team admin + legacy client report view            |
| scheduler  | 3000 | Team: FB/IG posting (its /client view can retire) |
| **portal** | 3002 | **Clients: everything in one place**              |
