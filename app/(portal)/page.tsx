import { ArrowUpRight, CalendarDays, Heart, MessageCircle, Repeat2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InfoTip } from "@/components/InfoTip";
import { MiniLineChart, type SeriesPoint } from "@/components/MiniLineChart";
import { PlatformIcon } from "@/components/PlatformIcon";
import { RangeSelect } from "@/components/RangeSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/StatTile";
import { getClientPage } from "@/lib/clientpage";
import {
  getCampaigns,
  getCompany,
  getInsights,
  getIssues,
  getPostComments,
} from "@/lib/data";
import {
  computeTotals,
  DEFAULT_CURRENCY_MULTIPLIER,
  money,
  num,
  pctChange,
  previousRange,
  RANGE_PRESETS,
  rangeToDates,
  type Company,
} from "@/lib/domain";
import { fbQueueConfigured, igQueueConfigured } from "@/lib/env";
import { listFbQueue } from "@/lib/fbqueue";
import {
  listPublishedPosts,
  listScheduledPosts,
  type PublishedPost,
} from "@/lib/facebook";
import { fmtDateTime } from "@/lib/format";
import { listIgQueue } from "@/lib/igqueue";
import { getIgAccount, listIgMedia, type IgMedia } from "@/lib/instagram";
import { fbMetricSeries, igMetricSeries, type MetricSeries } from "@/lib/insights";
import { getSession } from "@/lib/server-session";
import type { ClientSession } from "@/lib/clientsession";

export const dynamic = "force-dynamic";

function greeting(): string {
  // Ethiopia time (EAT, UTC+3) — consistent with the rest of the portal.
  const eatHour = (new Date().getUTCHours() + 3) % 24;
  if (eatHour < 12) return "Good morning";
  if (eatHour < 18) return "Good afternoon";
  return "Good evening";
}

const fbEngagement = (p: PublishedPost) =>
  (p.reactions?.summary?.total_count ?? 0) +
  (p.comments?.summary?.total_count ?? 0) +
  (p.shares?.count ?? 0);

const igEngagement = (m: IgMedia) => (m.like_count ?? 0) + (m.comments_count ?? 0);

const unixOf = (ymd: string, endOfDay = false) =>
  Math.floor(new Date(`${ymd}T${endOfDay ? "23:59:59" : "00:00:00"}Z`).getTime() / 1000);

/** Sum two daily series by date (union of both sets of dates), sorted ascending. */
function sumSeries(a: SeriesPoint[], b: SeriesPoint[]): SeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const p of a) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
  for (const p of b) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((x, y) => x.date.localeCompare(y.date));
}

/** Fold per-item {date, value} entries (e.g. one per IG post) into one point per day. */
function bucketByDay(items: { date: string; value: number }[]): SeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const it of items) byDate.set(it.date, (byDate.get(it.date) ?? 0) + it.value);
  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((x, y) => x.date.localeCompare(y.date));
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const rangeKey = range ?? "30d";

  // Fast, Appwrite-only lookups — render the greeting immediately, then
  // stream in everything else (several Meta Graph API calls) below it.
  const session = await getSession();
  if (!session) notFound();
  const company = await getCompany(session.cid);
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {greeting()}, <br className="flex md:hidden" /> {company.name}{" "}
            <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Here&apos;s how your marketing is performing.
          </p>
        </div>
        <RangeSelect />
      </header>

      <Suspense fallback={<OverviewBodySkeleton />}>
        <OverviewBody session={session} company={company} rangeKey={rangeKey} />
      </Suspense>
    </div>
  );
}

async function OverviewBody({
  session,
  company,
  rangeKey,
}: {
  session: ClientSession;
  company: Company;
  rangeKey: string;
}) {
  const { since, until } = rangeToDates(rangeKey);
  const prev = previousRange(since, until);
  const presetLabel = RANGE_PRESETS.find((p) => p.key === rangeKey)?.label ?? "last 30 days";
  const periodLabel = `prior ${presetLabel.replace(/^last /i, "")}`;

  const cur = company.currency || "ETB";
  const multiplier = company.currencyMultiplier ?? DEFAULT_CURRENCY_MULTIPLIER;

  const [adRows, adRowsPrev, campaigns, issues, ctx] = await Promise.all([
    getInsights(session.cid, since, until),
    getInsights(session.cid, prev.since, prev.until),
    getCampaigns(session.cid),
    getIssues(session.cid),
    getClientPage(),
  ]);

  const adTotals = computeTotals(adRows.map((r) => ({ ...r, spend: r.spend * multiplier })));
  const adTotalsPrev = computeTotals(
    adRowsPrev.map((r) => ({ ...r, spend: r.spend * multiplier }))
  );
  const leadsDelta = pctChange(adTotals.leads, adTotalsPrev.leads);

  const activeCampaign = campaigns.find((c) => (c.status ?? "").toUpperCase() === "ACTIVE");
  const openIssues = issues.filter((i) => i.status === "open" || i.status === "in_review");

  let organicError: string | null = null;
  let pageViewsTotal = 0;
  let pageViewsDelta: number | null = null;
  let pageViewsPoints: SeriesPoint[] = [];
  let pageViewsAvailable = false;
  let engagementTotal = 0;
  let engagementDelta: number | null = null;
  let engagementPoints: SeriesPoint[] = [];
  let followersNet = 0;
  let followersDelta: number | null = null;
  let followersAvailable = false;
  let upcoming: {
    key: string;
    postId: string;
    href: string;
    when: number;
    platform: "fb" | "ig";
    label: string;
  }[] = [];
  let awaitingReview = 0;
  let topPosts: PublishedPost[] = [];
  // Cadence gap: zero organic posts (FB + IG combined) in the trailing 7
  // days — an early-warning signal, not an error, so it's a quiet dot in
  // "Attention needed" rather than a banner.
  let postsLastWeekCount = 0;

  if (!ctx) {
    organicError =
      "Your account isn't linked to a page yet — contact your Awaj ET account manager.";
  } else {
    // Everything here is best-effort — any single Graph API hiccup (a
    // permission scope gap, a deprecated metric) degrades to the "not
    // linked" message rather than crashing the whole dashboard.
    try {
      const { page } = ctx;
      const [sinceUnix, untilUnix, prevSinceUnix, prevUntilUnix] = [
        unixOf(since),
        unixOf(until, true),
        unixOf(prev.since),
        unixOf(prev.until, true),
      ];

      // Meta deprecated page-level reach/impressions metrics entirely
      // ("page_impressions_unique", "page_impressions" et al. now error as
      // invalid metric names across every page on this API version) —
      // "page_views_total" (profile views of the Page) is the closest
      // still-live substitute, so the tile is labeled "Page views" rather
      // than "Reach" to stay honest about what it measures.
      // Followers similarly lost "page_fan_adds"; the still-live
      // replacement is follows-minus-unfollows per day.
      const [
        fbEng,
        fbEngPrev,
        fbPageViews,
        fbPageViewsPrev,
        fbFollows,
        fbFollowsPrev,
        fbUnfollows,
        fbUnfollowsPrev,
        ig,
        fbScheduled,
        published,
      ] = await Promise.all([
        fbMetricSeries(page, "page_post_engagements", "Engagement", sinceUnix, untilUnix),
        fbMetricSeries(page, "page_post_engagements", "Engagement", prevSinceUnix, prevUntilUnix),
        fbMetricSeries(page, "page_views_total", "Page views", sinceUnix, untilUnix),
        fbMetricSeries(page, "page_views_total", "Page views", prevSinceUnix, prevUntilUnix),
        fbMetricSeries(page, "page_daily_follows_unique", "New follows", sinceUnix, untilUnix),
        fbMetricSeries(
          page,
          "page_daily_follows_unique",
          "New follows",
          prevSinceUnix,
          prevUntilUnix
        ),
        fbMetricSeries(page, "page_daily_unfollows_unique", "Unfollows", sinceUnix, untilUnix),
        fbMetricSeries(
          page,
          "page_daily_unfollows_unique",
          "Unfollows",
          prevSinceUnix,
          prevUntilUnix
        ),
        getIgAccount(page),
        listScheduledPosts(page),
        listPublishedPosts(page),
      ]);

      let igFollowerAdds: MetricSeries | null = null;
      let igFollowerAddsPrev: MetricSeries | null = null;
      let igMedia: IgMedia[] = [];
      let igQueueItems: Awaited<ReturnType<typeof listIgQueue>> = [];
      // "profile_views" is Instagram's closest equivalent to Facebook's
      // "page_views_total" — combined below so the Page views tile
      // reflects visits across both platforms, not Facebook alone.
      let igProfileViews: MetricSeries | null = null;
      let igProfileViewsPrev: MetricSeries | null = null;

      if (ig) {
        try {
          [igFollowerAdds, igFollowerAddsPrev, igMedia, igProfileViews, igProfileViewsPrev] =
            await Promise.all([
              igMetricSeries(page, ig.id, "follower_count", "IG followers", sinceUnix, untilUnix),
              igMetricSeries(
                page,
                ig.id,
                "follower_count",
                "IG followers",
                prevSinceUnix,
                prevUntilUnix
              ),
              listIgMedia(page, ig.id, 25),
              igMetricSeries(page, ig.id, "profile_views", "Profile views", sinceUnix, untilUnix),
              igMetricSeries(
                page,
                ig.id,
                "profile_views",
                "Profile views",
                prevSinceUnix,
                prevUntilUnix
              ),
            ]);
        } catch {
          // IG section is optional — FB-only data still renders.
        }
      }
      if (igQueueConfigured()) {
        try {
          igQueueItems = (await listIgQueue(page.id)).filter(
            (i) => i.status === "pending" || i.status === "publishing"
          );
        } catch {
          // queue unreachable — FB upcoming content still shown
        }
      }
      let fbQueueItems: Awaited<ReturnType<typeof listFbQueue>> = [];
      if (fbQueueConfigured()) {
        try {
          fbQueueItems = (await listFbQueue(page.id)).filter(
            (i) => i.status === "pending" || i.status === "publishing"
          );
        } catch {
          // queue unreachable — FB upcoming content still shown
        }
      }

      // ── Page views: Facebook "page_views_total" + Instagram "profile_views"
      // — Instagram's closest equivalent to Meta's now-retired page-level
      // reach metrics — summed per day so both the headline number and the
      // chart reflect visits across every connected platform. ──
      pageViewsPoints = sumSeries(fbPageViews?.points ?? [], igProfileViews?.points ?? []);
      pageViewsTotal = (fbPageViews?.total ?? 0) + (igProfileViews?.total ?? 0);
      const pageViewsPrevTotal = (fbPageViewsPrev?.total ?? 0) + (igProfileViewsPrev?.total ?? 0);
      pageViewsDelta = pctChange(pageViewsTotal, pageViewsPrevTotal);
      pageViewsAvailable = fbPageViews !== null || igProfileViews !== null;

      // ── Engagement: Facebook's native daily series + Instagram's
      // per-post engagement bucketed into the same daily buckets (IG has
      // no daily engagement metric, only per-post totals) — combined per
      // day so the chart matches the "all platforms" headline number. ──
      const igEngagementByDay = bucketByDay(
        igMedia
          .filter(
            (m) => m.timestamp && m.timestamp.slice(0, 10) >= since && m.timestamp.slice(0, 10) <= until
          )
          .map((m) => ({ date: m.timestamp!.slice(0, 10), value: igEngagement(m) }))
      );
      engagementPoints = sumSeries(fbEng?.points ?? [], igEngagementByDay);
      const igEngagementInRange = igEngagementByDay.reduce((n, p) => n + p.value, 0);
      const igEngagementPrevRange = igMedia
        .filter(
          (m) =>
            m.timestamp &&
            m.timestamp.slice(0, 10) >= prev.since &&
            m.timestamp.slice(0, 10) <= prev.until
        )
        .reduce((n, m) => n + igEngagement(m), 0);
      engagementTotal = (fbEng?.total ?? 0) + igEngagementInRange;
      const engagementPrevTotal = (fbEngPrev?.total ?? 0) + igEngagementPrevRange;
      engagementDelta = pctChange(engagementTotal, engagementPrevTotal);

      // ── Followers: net new adds this period vs prior period ──
      const fbFollowersNet = (fbFollows?.total ?? 0) - (fbUnfollows?.total ?? 0);
      const fbFollowersPrevNet = (fbFollowsPrev?.total ?? 0) - (fbUnfollowsPrev?.total ?? 0);
      followersNet = fbFollowersNet + (igFollowerAdds?.total ?? 0);
      const followersPrevNet = fbFollowersPrevNet + (igFollowerAddsPrev?.total ?? 0);
      followersDelta = pctChange(followersNet, followersPrevNet);
      followersAvailable = fbFollows !== null || igFollowerAdds !== null;

      // ── Upcoming content (top 3) ── FB scheduling now runs through
      // fb_queue (Appwrite), not Facebook's own scheduler — fbScheduled
      // only surfaces posts scheduled before that migration.
      upcoming = [
        ...fbScheduled.map((p) => ({
          key: `fb-${p.id}`,
          postId: p.id,
          href: `/posts/${p.id}?source=fb-scheduled`,
          when: p.scheduled_publish_time,
          platform: "fb" as const,
          label: p.message || "(photo post)",
        })),
        ...fbQueueItems.map((item) => ({
          key: `fbq-${item.$id}`,
          postId: item.$id,
          href: `/posts/${item.$id}?source=fb-queue`,
          when: item.scheduledAt,
          platform: "fb" as const,
          label: item.caption || "(no caption)",
        })),
        ...igQueueItems.map((i) => ({
          key: `ig-${i.$id}`,
          postId: i.$id,
          href: `/posts/${i.$id}?source=ig-queue`,
          when: i.scheduledAt,
          platform: "ig" as const,
          label: i.caption || "(image post)",
        })),
      ].sort((a, b) => a.when - b.when);

      // Client hasn't signed off (no "approved" comment) on an upcoming post yet.
      const reviewChecks = await Promise.all(
        upcoming.map(async (u) => {
          const comments = await getPostComments(session.cid, u.postId);
          return comments.some((c) => c.status === "approved");
        })
      );
      awaitingReview = reviewChecks.filter((approved) => !approved).length;

      topPosts = [...published].sort((a, b) => fbEngagement(b) - fbEngagement(a)).slice(0, 3);

      const weekAgoMs = Date.now() - 7 * 86400 * 1000;
      postsLastWeekCount =
        published.filter((p) => new Date(p.created_time).getTime() >= weekAgoMs).length +
        igMedia.filter((m) => m.timestamp && new Date(m.timestamp).getTime() >= weekAgoMs).length;
    } catch (e) {
      organicError = e instanceof Error ? e.message : "Could not load your social data.";
    }
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Page views"
          value={num(pageViewsTotal)}
          delta={pageViewsDelta}
          periodLabel={periodLabel}
          unavailable={
            !organicError && !pageViewsAvailable ? "Not reported by Meta for this page" : undefined
          }
          tip="Profile/page visits across Facebook and Instagram combined. This mertic shows the most intent."
        />
        <StatTile
          label="Engagement"
          value={num(engagementTotal)}
          delta={engagementDelta}
          periodLabel={periodLabel}
          tip="Reactions, comments, and shares on your posts across Facebook and Instagram, combined."
        />
        <StatTile
          label="Followers"
          value={`${followersNet >= 0 ? "+" : ""}${num(followersNet)}`}
          delta={followersDelta}
          periodLabel={periodLabel}
          unavailable={
            !organicError && !followersAvailable ? "Not reported by Meta for this page" : undefined
          }
          tip="Net new followers this period. New follows minus unfollows, across Facebook and Instagram."
        />
        <StatTile label="Ad leads" value={num(adTotals.leads)} delta={leadsDelta} periodLabel={periodLabel} />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <h2 className="font-display mb-4 text-lg font-semibold">Organic performance</h2>
          {organicError ? (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{organicError}</p>
          ) : (
            <div className="space-y-6">
              <MiniLineChart title="Page views" points={pageViewsPoints} color="#f0a93b" />
              <MiniLineChart title="Engagement" points={engagementPoints} color="#c97d1e" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <h2 className="font-display mb-4 text-lg font-semibold">Ad performance</h2>
          <dl className="divide-y divide-line">
            {(
              [
                {
                  label: "Spend",
                  value: money(adTotals.spend, cur),
                  delta: pctChange(adTotals.spend, adTotalsPrev.spend),
                  goodDir: "down" as const,
                  tip: undefined as string | undefined,
                },
                {
                  label: "Leads",
                  value: num(adTotals.leads),
                  delta: leadsDelta,
                  goodDir: "up" as const,
                  tip: undefined as string | undefined,
                },
                {
                  label: "CPL",
                  value: adTotals.leads ? money(adTotals.cpl, cur) : "—",
                  delta:
                    adTotals.leads && adTotalsPrev.leads
                      ? pctChange(adTotals.cpl, adTotalsPrev.cpl)
                      : null,
                  goodDir: "down" as const,
                  tip: "Ad spend divided by number of leads generated — lower is better.",
                },
                {
                  label: "CPR",
                  value: adTotals.results ? money(adTotals.cpr, cur) : "—",
                  delta:
                    adTotals.results && adTotalsPrev.results
                      ? pctChange(adTotals.cpr, adTotalsPrev.cpr)
                      : null,
                  goodDir: "down" as const,
                  tip: "Ad spend divided by total results (leads + calls) — lower is better.",
                },
              ] satisfies {
                label: string;
                value: string;
                delta: number | null;
                goodDir: "up" | "down";
                tip?: string;
              }[]
            ).map(({ label, value, delta, goodDir, tip }) => {
              const dir = delta === null || delta === 0 ? null : delta > 0 ? "up" : "down";
              const isGood = dir === null ? null : dir === goodDir;
              const deltaColor =
                isGood === null
                  ? "text-muted"
                  : isGood
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-600 dark:text-red-400";
              return (
                <div key={label} className="flex items-center justify-between py-2.5 text-sm">
                  <dt className="flex items-center gap-1 text-muted">
                    {label}
                    {tip && <InfoTip text={tip} />}
                  </dt>
                  <dd className="flex items-baseline gap-1.5">
                    <span className="font-display font-semibold">{value}</span>
                    {delta !== null && (
                      <span className={`font-mono text-[10px] font-semibold ${deltaColor}`}>
                        {dir === "up" ? "↑" : "↓"} {Math.abs(delta).toFixed(0)}%
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <Link
            href="/advertising"
            className="mt-4 flex items-center gap-1 font-mono text-[11px] text-amber underline"
          >
            View full ad report
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <section className="mt-8 grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <h2 className="font-display mb-4 text-lg font-semibold">Upcoming content</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">
              {organicError ?? "Nothing scheduled right now."}
            </p>
          ) : (
            <ul className="flex min-w-0 flex-col gap-2">
              {upcoming.slice(0, 3).map((u) => (
                <li key={u.key} className="min-w-0">
                  <Link
                    href={u.href}
                    className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-sm transition-colors hover:bg-app"
                  >
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {fmtDateTime(u.when).slice(0, 6)}
                    </span>
                    <PlatformIcon platform={u.platform} />
                    <span className="min-w-0 flex-1 truncate">{u.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/calendar" className="mt-4 flex items-center gap-1 font-mono text-[11px] text-amber underline">
            View calendar
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="min-w-0 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <h2 className="font-display mb-4 text-lg font-semibold">Attention needed</h2>
          <ul className="flex min-w-0 flex-col gap-3 text-sm">
            <li className="min-w-0">
              <Link href="/issues" className="flex min-w-0 items-center gap-2 hover:underline">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${openIssues.length > 0 ? "bg-red-500" : "bg-green-500"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  {openIssues.length > 0
                    ? `${openIssues.length} open support request${openIssues.length === 1 ? "" : "s"}`
                    : "No open support requests"}
                </span>
              </Link>
            </li>
            <li className="min-w-0">
              <Link href="/calendar" className="flex min-w-0 items-center gap-2 hover:underline">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${awaitingReview > 0 ? "bg-gold" : "bg-green-500"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  {awaitingReview > 0
                    ? `${awaitingReview} post${awaitingReview === 1 ? "" : "s"} awaiting your review`
                    : "All posts reviewed"}
                </span>
              </Link>
            </li>
            <li className="min-w-0">
              <Link href="/advertising" className="flex min-w-0 items-center gap-2 hover:underline">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${activeCampaign ? "bg-green-500" : "bg-gold"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  {activeCampaign ? "Campaign running" : "No active campaign"}
                </span>
              </Link>
            </li>
            {!organicError && (
              <li className="min-w-0">
                <Link href="/calendar" className="flex min-w-0 items-center gap-2 hover:underline">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${postsLastWeekCount === 0 ? "bg-red-500" : "bg-green-500"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {postsLastWeekCount === 0
                      ? "No posts in the last 7 days"
                      : `${postsLastWeekCount} post${postsLastWeekCount === 1 ? "" : "s"} in the last 7 days`}
                  </span>
                </Link>
              </li>
            )}
          </ul>
          <Link href="/issues" className="mt-4 flex items-center gap-1 font-mono text-[11px] text-amber underline">
            View all
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <h2 className="font-display mb-4 text-lg font-semibold">Top performing content</h2>
        {topPosts.length === 0 ? (
          <p className="text-sm text-muted">{organicError ?? "No published posts yet."}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {topPosts.map((p) => (
              <Link
                key={p.id}
                href={`/posts/${p.id}?source=fb-published`}
                className="block rounded-lg border border-edge p-3 shadow-sm transition-colors hover:border-gold"
              >
                {p.full_picture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.full_picture}
                    alt=""
                    className="h-32 w-full rounded-md border border-edge object-cover"
                  />
                )}
                <p className="mt-2 line-clamp-2 text-sm">
                  {p.message || <span className="text-muted italic">(photo post)</span>}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1 font-mono text-[10px] text-muted">
                  <span className="inline-flex items-center gap-0.5">
                    <Heart className="h-3 w-3" /> {p.reactions?.summary?.total_count ?? 0}
                  </span>
                  ·
                  <span className="inline-flex items-center gap-0.5">
                    <MessageCircle className="h-3 w-3" /> {p.comments?.summary?.total_count ?? 0}
                  </span>
                  ·
                  <span className="inline-flex items-center gap-0.5">
                    <Repeat2 className="h-3 w-3" /> {p.shares?.count ?? 0}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function OverviewBodySkeleton() {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-edge bg-card p-4 shadow-sm">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-20" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="mt-6 h-32 w-full" />
        </div>
        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <Skeleton className="mb-4 h-5 w-32" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <Skeleton className="mb-4 h-5 w-40" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="mt-2 h-6 w-full" />
          ))}
        </div>
        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <Skeleton className="mb-4 h-5 w-40" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="mt-3 h-4 w-full" />
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <Skeleton className="mb-4 h-5 w-56" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="mt-2 h-3.5 w-full" />
              <Skeleton className="mt-1.5 h-3 w-2/3" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
