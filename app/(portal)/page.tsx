import Link from "next/link";
import { notFound } from "next/navigation";
import { MiniLineChart, type SeriesPoint } from "@/components/MiniLineChart";
import { PlatformIcon } from "@/components/PlatformIcon";
import { RangeSelect } from "@/components/RangeSelect";
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
} from "@/lib/domain";
import { igQueueConfigured } from "@/lib/env";
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

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const rangeKey = range ?? "30d";

  const session = await getSession();
  if (!session) notFound();
  const company = await getCompany(session.cid);
  if (!company) notFound();

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
  const openIssues = issues.filter((i) => i.status === "open" || i.status === "in_progress");

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
    href: string;
    when: number;
    platform: "fb" | "ig";
    label: string;
  }[] = [];
  let awaitingReview = 0;
  let topPosts: PublishedPost[] = [];

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

      if (ig) {
        try {
          [igFollowerAdds, igFollowerAddsPrev, igMedia] = await Promise.all([
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

      // ── Page views: FB only — no IG equivalent for profile views ──
      pageViewsPoints = fbPageViews?.points ?? [];
      pageViewsTotal = fbPageViews?.total ?? 0;
      const pageViewsPrevTotal = fbPageViewsPrev?.total ?? 0;
      pageViewsDelta = pctChange(pageViewsTotal, pageViewsPrevTotal);
      pageViewsAvailable = fbPageViews !== null;

      // ── Engagement: chart is Facebook's native daily series only — IG has
      // no daily engagement metric, only per-post totals — but the headline
      // number below includes IG engagement from recent published media. ──
      engagementPoints = fbEng?.points ?? [];
      const igEngagementInRange = igMedia
        .filter(
          (m) => m.timestamp && m.timestamp.slice(0, 10) >= since && m.timestamp.slice(0, 10) <= until
        )
        .reduce((n, m) => n + igEngagement(m), 0);
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

      // ── Upcoming content (top 3) ──
      upcoming = [
        ...fbScheduled.map((p) => ({
          key: `fb-${p.id}`,
          href: `/posts/${p.id}?source=fb-scheduled`,
          when: p.scheduled_publish_time,
          platform: "fb" as const,
          label: p.message || "(photo post)",
        })),
        ...igQueueItems.map((i) => ({
          key: `ig-${i.$id}`,
          href: `/posts/${i.$id}?source=ig-queue`,
          when: i.scheduledAt,
          platform: "ig" as const,
          label: i.caption || "(image post)",
        })),
      ].sort((a, b) => a.when - b.when);

      // Client hasn't signed off (no "approved" comment) on an upcoming post yet.
      const reviewChecks = await Promise.all(
        upcoming.map(async (u) => {
          const comments = await getPostComments(session.cid, u.key.replace(/^(fb|ig)-/, ""));
          return comments.some((c) => c.status === "approved");
        })
      );
      awaitingReview = reviewChecks.filter((approved) => !approved).length;

      topPosts = [...published].sort((a, b) => fbEngagement(b) - fbEngagement(a)).slice(0, 3);
    } catch (e) {
      organicError = e instanceof Error ? e.message : "Could not load your social data.";
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {greeting()}, <br className="flex md:hidden" /> {company.name} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-warmgray">
            Here&apos;s how your marketing is performing.
          </p>
        </div>
        <RangeSelect />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Page views"
          value={num(pageViewsTotal)}
          delta={pageViewsDelta}
          periodLabel={periodLabel}
          unavailable={
            !organicError && !pageViewsAvailable ? "Not reported by Meta for this page" : undefined
          }
        />
        <StatTile
          label="Engagement"
          value={num(engagementTotal)}
          delta={engagementDelta}
          periodLabel={periodLabel}
        />
        <StatTile
          label="Followers"
          value={`${followersNet >= 0 ? "+" : ""}${num(followersNet)}`}
          delta={followersDelta}
          periodLabel={periodLabel}
          unavailable={
            !organicError && !followersAvailable ? "Not reported by Meta for this page" : undefined
          }
        />
        <StatTile label="Ad leads" value={num(adTotals.leads)} delta={leadsDelta} periodLabel={periodLabel} />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Organic performance</h2>
          {organicError ? (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{organicError}</p>
          ) : (
            <div className="space-y-6">
              <MiniLineChart title="Page views" points={pageViewsPoints} color="#f0a93b" />
              <MiniLineChart
                title="Engagement (Facebook)"
                points={engagementPoints}
                color="#c97d1e"
              />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Ad performance</h2>
          <dl className="divide-y divide-line">
            {[
              ["Spend", money(adTotals.spend, cur)],
              ["Leads", num(adTotals.leads)],
              ["CPL", adTotals.leads ? money(adTotals.cpl, cur) : "—"],
              ["CPR", adTotals.results ? money(adTotals.cpr, cur) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-warmgray">{label}</dt>
                <dd className="font-display font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/advertising"
            className="mt-4 inline-block font-mono text-[11px] text-amber underline"
          >
            View full ad report ↗
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Upcoming content</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-warmgray">
              {organicError ?? "Nothing scheduled right now."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.slice(0, 3).map((u) => (
                <li key={u.key}>
                  <Link
                    href={u.href}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-sm transition-colors hover:bg-mist"
                  >
                    <span aria-hidden>📅</span>
                    <span className="font-mono text-xs text-warmgray">
                      {fmtDateTime(u.when).slice(0, 6)}
                    </span>
                    <PlatformIcon platform={u.platform} />
                    <span className="truncate">{u.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/calendar" className="mt-4 inline-block font-mono text-[11px] text-amber underline">
            View calendar ↗
          </Link>
        </div>

        <div className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Attention needed</h2>
          <ul className="flex flex-col gap-3 text-sm">
            <li>
              <Link href="/issues" className="flex items-center gap-2 hover:underline">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${openIssues.length > 0 ? "bg-red-500" : "bg-green-500"}`}
                  aria-hidden
                />
                {openIssues.length > 0
                  ? `${openIssues.length} open support request${openIssues.length === 1 ? "" : "s"}`
                  : "No open support requests"}
              </Link>
            </li>
            <li>
              <Link href="/calendar" className="flex items-center gap-2 hover:underline">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${awaitingReview > 0 ? "bg-gold" : "bg-green-500"}`}
                  aria-hidden
                />
                {awaitingReview > 0
                  ? `${awaitingReview} post${awaitingReview === 1 ? "" : "s"} awaiting your review`
                  : "All posts reviewed"}
              </Link>
            </li>
            <li>
              <Link href="/advertising" className="flex items-center gap-2 hover:underline">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${activeCampaign ? "bg-green-500" : "bg-gold"}`}
                  aria-hidden
                />
                {activeCampaign ? "Campaign running" : "No active campaign"}
              </Link>
            </li>
          </ul>
          <Link href="/issues" className="mt-4 inline-block font-mono text-[11px] text-amber underline">
            View all ↗
          </Link>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-line bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Top performing content</h2>
        {topPosts.length === 0 ? (
          <p className="text-sm text-warmgray">{organicError ?? "No published posts yet."}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {topPosts.map((p) => (
              <Link
                key={p.id}
                href={`/posts/${p.id}?source=fb-published`}
                className="block rounded-lg border border-line p-3 shadow-sm transition-colors hover:border-gold"
              >
                {p.full_picture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.full_picture}
                    alt=""
                    className="h-32 w-full rounded-md border border-line object-cover"
                  />
                )}
                <p className="mt-2 line-clamp-2 text-sm">
                  {p.message || <span className="text-warmgray italic">(photo post)</span>}
                </p>
                <p className="mt-1.5 font-mono text-[10px] text-warmgray">
                  ♥ {p.reactions?.summary?.total_count ?? 0} · 💬{" "}
                  {p.comments?.summary?.total_count ?? 0} · ↻ {p.shares?.count ?? 0}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
