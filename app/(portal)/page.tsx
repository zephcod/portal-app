import { ArrowUpRight, CalendarDays, Heart, MessageCircle, Repeat2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BudgetBalanceCard } from "@/components/BudgetBalanceCard";
import { InfoTip } from "@/components/InfoTip";
import { MiniLineChart, type SeriesPoint } from "@/components/MiniLineChart";
import { PlatformIcon } from "@/components/PlatformIcon";
import { RangeSelect } from "@/components/RangeSelect";
import { ShowTopContentButton } from "@/components/ShowTopContentButton";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/StatTile";
import { getClientPage } from "@/lib/clientpage";
import {
  getCampaigns,
  getCompany,
  getInsights,
  getIssues,
  getOrganicStats,
  getPostComments,
} from "@/lib/data";
import {
  addDaysYmd,
  computeTotals,
  DEFAULT_CURRENCY_MULTIPLIER,
  money,
  num,
  pctChange,
  previousRange,
  RANGE_PRESETS,
  rangeToDates,
  yesterdayYmd,
  type Company,
  type OrganicStatsDaily,
} from "@/lib/domain";
import { fbQueueConfigured, igQueueConfigured } from "@/lib/env";
import { listFbQueue } from "@/lib/fbqueue";
import { listPublishedPosts, type PublishedPost } from "@/lib/facebook";
import { fmtDateTime } from "@/lib/format";
import { listIgQueue } from "@/lib/igqueue";
import type { ManagedPage } from "@/lib/pages";
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

/** Sum a window of cached daily rows into range totals. */
function sumOrganicRows(rows: OrganicStatsDaily[]) {
  return rows.reduce(
    (acc, r) => ({
      // IG only for now — Meta retired page-level reach reporting for
      // Facebook Pages, so there's no fbReach field to add in here.
      reach: acc.reach + r.igReach,
      pageViews: acc.pageViews + r.fbPageViews + r.igProfileViews,
      engagement: acc.engagement + r.fbEngagement + r.igEngagement,
      followersNet: acc.followersNet + (r.fbFollows - r.fbUnfollows) + r.igFollowerAdds,
    }),
    { reach: 0, pageViews: 0, engagement: 0, followersNet: 0 }
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; top?: string }>;
}) {
  const { range, top } = await searchParams;
  const rangeKey = range ?? "30d";
  const showTop = Boolean(top);

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
        <OverviewBody session={session} company={company} rangeKey={rangeKey} showTop={showTop} />
      </Suspense>
    </div>
  );
}

async function OverviewBody({
  session,
  company,
  rangeKey,
  showTop,
}: {
  session: ClientSession;
  company: Company;
  rangeKey: string;
  showTop: boolean;
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
  let reachTotal = 0;
  let reachDelta: number | null = null;
  let pageViewsTotal = 0;
  let pageViewsDelta: number | null = null;
  let pageViewsPoints: SeriesPoint[] = [];
  let engagementTotal = 0;
  let engagementDelta: number | null = null;
  let engagementPoints: SeriesPoint[] = [];
  let followersNet = 0;
  let followersDelta: number | null = null;
  let statsNotSynced = false;
  let upcoming: {
    key: string;
    postId: string;
    href: string;
    when: number;
    platform: "fb" | "ig";
    label: string;
  }[] = [];
  let awaitingReview = 0;
  // Cadence gap: zero organic posts (FB + IG combined) in the trailing 7
  // days — an early-warning signal, not an error, so it's a quiet dot in
  // "Attention needed" rather than a banner.
  let postsLastWeekCount = 0;
  let page: ManagedPage | null = null;

  if (!ctx) {
    organicError =
      "Your account isn't linked to a page yet — contact your Awaj ET account manager.";
  } else {
    // Everything in this block is Appwrite-only (organic-stats cache,
    // scheduling queues, comment lookups) — no live Meta Graph calls, so
    // it resolves fast and renders as part of this same Suspense-gated
    // body. "Top performing content" below is the one section that still
    // needs a live Graph call (listPublishedPosts) and streams in via its
    // own nested Suspense instead of blocking everything above it.
    page = ctx.page;
    try {
      const cappedUntil = until < yesterdayYmd() ? until : yesterdayYmd();
      const cappedPrevUntil = prev.until < yesterdayYmd() ? prev.until : yesterdayYmd();

      const [curRows, prevRows] = await Promise.all([
        since <= cappedUntil ? getOrganicStats(session.cid, since, cappedUntil) : Promise.resolve([]),
        prev.since <= cappedPrevUntil
          ? getOrganicStats(session.cid, prev.since, cappedPrevUntil)
          : Promise.resolve([]),
      ]);

      let igQueueItems: Awaited<ReturnType<typeof listIgQueue>> = [];
      if (igQueueConfigured()) {
        try {
          igQueueItems = (await listIgQueue(page.id)).filter(
            (i) => i.status === "pending" || i.status === "approved" || i.status === "publishing"
          );
        } catch {
          // queue unreachable — FB upcoming content still shown
        }
      }
      let fbQueueItems: Awaited<ReturnType<typeof listFbQueue>> = [];
      if (fbQueueConfigured()) {
        try {
          fbQueueItems = (await listFbQueue(page.id)).filter(
            (i) => i.status === "pending" || i.status === "approved" || i.status === "publishing"
          );
        } catch {
          // queue unreachable — FB upcoming content still shown
        }
      }

      statsNotSynced = curRows.length === 0;

      pageViewsPoints = curRows.map((r) => ({ date: r.date, value: r.fbPageViews + r.igProfileViews }));
      engagementPoints = curRows.map((r) => ({ date: r.date, value: r.fbEngagement + r.igEngagement }));

      const curTotals = sumOrganicRows(curRows);
      const prevTotals = sumOrganicRows(prevRows);
      reachTotal = curTotals.reach;
      reachDelta = pctChange(curTotals.reach, prevTotals.reach);
      pageViewsTotal = curTotals.pageViews;
      pageViewsDelta = pctChange(curTotals.pageViews, prevTotals.pageViews);
      engagementTotal = curTotals.engagement;
      engagementDelta = pctChange(curTotals.engagement, prevTotals.engagement);
      followersNet = curTotals.followersNet;
      followersDelta = pctChange(curTotals.followersNet, prevTotals.followersNet);

      // ── Upcoming content (top 3) ── Appwrite-only: FB scheduling now
      // runs through fb_queue, not Facebook's native scheduler (being
      // phased out entirely, so it's no longer read here at all).
      upcoming = [
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

      // Cadence: real trailing-7-days-through-yesterday, independent of
      // the selected range — always a subset of curRows since every
      // range preset spans at least 7 days.
      const weekAgoDate = addDaysYmd(cappedUntil, -6);
      postsLastWeekCount = curRows
        .filter((r) => r.date >= weekAgoDate)
        .reduce((n, r) => n + r.postsPublishedCount, 0);
    } catch (e) {
      organicError = e instanceof Error ? e.message : "Could not load your social data.";
    }
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Reach"
          value={num(reachTotal)}
          delta={reachDelta}
          periodLabel={periodLabel}
          unavailable={!organicError && statsNotSynced ? "Not synced yet" : undefined}
          tip="Unique accounts reached — Instagram only for now. Meta retired page-level reach reporting for Facebook Pages."
        />
        <StatTile
          label="Page views"
          value={num(pageViewsTotal)}
          delta={pageViewsDelta}
          periodLabel={periodLabel}
          unavailable={!organicError && statsNotSynced ? "Not synced yet" : undefined}
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
          unavailable={!organicError && statsNotSynced ? "Not synced yet" : undefined}
          tip="Net new followers this period. New follows minus unfollows, across Facebook and Instagram."
        />
      </section>

      <BudgetBalanceCard companyId={session.cid} currency={cur} />

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

      {organicError ? (
        <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <h2 className="font-display mb-4 text-lg font-semibold">Top performing content</h2>
          <p className="text-sm text-muted">{organicError}</p>
        </section>
      ) : showTop ? (
        <Suspense fallback={<TopPerformingSkeleton />}>
          <TopPerformingContent page={page} />
        </Suspense>
      ) : (
        <section className="mt-8 rounded-xl border border-dashed border-edge bg-card/60 p-4 text-center shadow-sm sm:p-6">
          <h2 className="font-display mb-2 text-lg font-semibold">Top performing content</h2>
          <p className="mb-4 text-sm text-muted">
            Loads your top Facebook posts by engagement, live from Meta.
          </p>
          <ShowTopContentButton label="Show top performing content" />
        </section>
      )}
    </>
  );
}

/**
 * The one section on Overview that still needs a live Graph call
 * (listPublishedPosts) — kept in its own nested Suspense so the rest of
 * the page (all Appwrite-sourced: KPIs, charts, upcoming, attention
 * needed) never waits on it.
 */
async function TopPerformingContent({ page }: { page: ManagedPage | null }) {
  let topPosts: PublishedPost[] = [];
  let error: string | null = null;
  if (page) {
    try {
      const published = await listPublishedPosts(page);
      topPosts = [...published].sort((a, b) => fbEngagement(b) - fbEngagement(a)).slice(0, 3);
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load top posts.";
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
      <h2 className="font-display mb-4 text-lg font-semibold">Top performing content</h2>
      {topPosts.length === 0 ? (
        <p className="text-sm text-muted">{error ?? "No published posts yet."}</p>
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
  );
}

function TopPerformingSkeleton() {
  return (
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

      <div className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-6 w-32" />
          </div>
        </div>
      </div>

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

      <TopPerformingSkeleton />
    </>
  );
}
