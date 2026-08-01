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

No admin features exist in this app. Clients log in with the **same PIN
as the reports app** (`companies` collection, shared Appwrite database);
the session is an HMAC-signed cookie scoped to their company + FB page
(`fbPageId` attribute on the company doc — see the scheduler's
`setup-client-portal.mjs`). Companies without `fbPageId` can still use
Dashboard and Issues; the social pages show a "not linked" notice.

## Setup

```bash
cp .env.example .env   # Appwrite (required), AUTH_SECRET (required),
                       # FB_SYSTEM_USER_TOKEN + FB_PAGE_IDS (social pages)
npm install
npm run dev            # http://localhost:3002
```

Data is written by the other apps — the reports app syncs ad insights
into `insights_daily`, the scheduler owns posting/queues and nightly
syncs organic (Page + IG Insights) stats into `organic_stats_daily`
(its lib/organicStats.ts, cron via GitHub Actions — see its
`organic-stats-cron.yml`). This portal only reads (plus creating issue
documents), so it needs no cron jobs of its own.

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
