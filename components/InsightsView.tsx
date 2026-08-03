import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import { Suspense } from "react";
import { InfoTip } from "@/components/InfoTip";
import { PlatformIcon } from "@/components/PlatformIcon";
import { ShowTopContentButton } from "@/components/ShowTopContentButton";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrganicStats } from "@/lib/data";
import {
  addDaysYmd,
  pctChange,
  yesterdayYmd,
  type OrganicStatsDaily,
} from "@/lib/domain";
import { fbQueueConfigured, igQueueConfigured } from "@/lib/env";
import { listFbQueue } from "@/lib/fbqueue";
import { listPublishedPosts, type PublishedPost } from "@/lib/facebook";
import { listIgQueue } from "@/lib/igqueue";
import type { MetricSeries } from "@/lib/insights";
import { getIgAccount, listIgMedia, type IgMedia } from "@/lib/instagram";
import type { ManagedPage } from "@/lib/pages";

type NumericStatKey =
  | "fbPageViews"
  | "fbEngagement"
  | "fbVideoViews"
  | "igReach"
  | "igFollowerAdds"
  | "postsPublishedCount";

// ── Tiny server-rendered bar chart ──
function BarChart({ series }: { series: MetricSeries }) {
  const max = Math.max(...series.points.map((p) => p.value), 1);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
          {series.title}
        </span>
        <span className="font-display text-lg font-bold">
          {series.total.toLocaleString()}
        </span>
      </div>
      <div className="mt-2 flex h-24 items-end gap-px">
        {series.points.map((p) => (
          <div
            key={p.date}
            title={`${p.date}: ${p.value.toLocaleString()}`}
            className="min-w-0 flex-1 rounded-t-sm bg-gold/70 hover:bg-amber"
            style={{ height: `${Math.max((p.value / max) * 100, 2)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted">
        <span>{series.points[0]?.date.slice(5)}</span>
        <span>{series.points.at(-1)?.date.slice(5)}</span>
      </div>
    </div>
  );
}

/**
 * `delta` is % change vs the immediately preceding period of equal length
 * ("prior Nd"). Omit it for snapshot metrics that don't have a meaningful
 * period-over-period baseline (e.g. total follower counts).
 */
function StatCard({
  label,
  value,
  delta,
  tip,
}: {
  label: string;
  value: string;
  delta?: number | null;
  /** One-line plain-language explanation, shown via a tap-to-open info icon. */
  tip?: string;
}) {
  const dir = !delta ? null : delta > 0 ? "up" : "down";
  const color =
    dir === null
      ? "text-muted"
      : dir === "up"
        ? "text-green-700 dark:text-green-400"
        : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded-lg border border-edge bg-card px-4 py-3 shadow-sm">
      <p className="flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {delta !== undefined && (
        <p className="mt-1 text-xs">
          {delta === null ? (
            <span className="text-muted">vs prior period</span>
          ) : (
            <>
              <span className={`font-semibold ${color}`}>
                {dir === "up" ? "↑" : "↓"} {Math.abs(delta).toFixed(0)}%
              </span>{" "}
              <span className="text-muted">vs prior period</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

const fbEngagement = (p: PublishedPost) =>
  (p.reactions?.summary?.total_count ?? 0) +
  (p.comments?.summary?.total_count ?? 0) +
  (p.shares?.count ?? 0);

const igEngagement = (m: IgMedia) =>
  (m.like_count ?? 0) + (m.comments_count ?? 0);

/**
 * Insights dashboard for one page — stat cards, daily charts, top posts.
 * Stat cards/charts read pre-aggregated numbers from `organic_stats_daily`
 * (nightly Meta sync — see the scheduler app's lib/organicStats.ts) and
 * the scheduling queues (Appwrite) — no live Meta calls, so they render
 * as part of this component directly. Top posts are the one thing that
 * still needs a live Graph call (listPublishedPosts / listIgMedia) and
 * stream in via a nested Suspense instead of blocking the stats above.
 */
export default async function InsightsView({
  page,
  error: externalError,
  days,
  companyId,
  showTop,
}: {
  page: ManagedPage | null;
  error?: string | null;
  days: number;
  /** Needed to look up cached stats — omit to skip the stat cards/charts entirely. */
  companyId?: string;
  /** Reveals the Top posts section (live Graph calls) — suppressed until the user asks for it. */
  showTop: boolean;
}) {
  let error: string | null = externalError ?? null;
  let fanCount: number | undefined;
  let igFollowers: number | undefined;
  let fbPageViews: MetricSeries | null = null;
  let fbPageViewsDelta: number | null = null;
  let igReach: MetricSeries | null = null;
  let igReachDelta: number | null = null;
  const fbCharts: MetricSeries[] = [];
  const igCharts: MetricSeries[] = [];
  let postsLastWeek = 0;
  let postsLastWeekDelta: number | null = null;
  let scheduledAhead = 0;

  if (!error && page) {
    try {
      fanCount = page.fanCount;

      // Scheduled ahead: pending fb_queue + ig_queue items — a real-time
      // Appwrite queue count, not a historical metric. Facebook's native
      // scheduler is being phased out entirely, so it's not counted here.
      if (fbQueueConfigured()) {
        try {
          scheduledAhead += (await listFbQueue(page.id)).filter(
            (i) => i.status === "pending" || i.status === "approved" || i.status === "publishing"
          ).length;
        } catch {
          // queue unreachable — IG count still shown
        }
      }
      if (igQueueConfigured()) {
        try {
          scheduledAhead += (await listIgQueue(page.id)).filter(
            (i) => i.status === "pending" || i.status === "approved" || i.status === "publishing"
          ).length;
        } catch {
          // queue unreachable — FB count still shown
        }
      }

      // Cached stats — one Appwrite read per window instead of ~7 live
      // Graph calls. Only ever covers through yesterday.
      if (companyId) {
        const untilYmd = yesterdayYmd();
        const sinceYmd = addDaysYmd(untilYmd, -(days - 1));
        const prevUntilYmd = addDaysYmd(sinceYmd, -1);
        const prevSinceYmd = addDaysYmd(prevUntilYmd, -(days - 1));
        // Cadence ("posts last week" / "the week before") is always a
        // real trailing-14-days-through-yesterday window, independent of
        // the days toggle above — a steady weekly rhythm check, not
        // whatever range is being charted.
        const cadenceSinceYmd = addDaysYmd(untilYmd, -13);

        const [curRows, prevRows, cadenceRows] = await Promise.all([
          getOrganicStats(companyId, sinceYmd, untilYmd),
          getOrganicStats(companyId, prevSinceYmd, prevUntilYmd),
          getOrganicStats(companyId, cadenceSinceYmd, untilYmd),
        ]);

        const sumBy = (rows: OrganicStatsDaily[], key: NumericStatKey) =>
          rows.reduce((n, r) => n + r[key], 0);
        const toSeries = (key: NumericStatKey, metric: string, title: string): MetricSeries => ({
          metric,
          title,
          points: curRows.map((r) => ({ date: r.date, value: r[key] })),
          total: sumBy(curRows, key),
        });

        if (curRows.length > 0) {
          fbPageViews = toSeries("fbPageViews", "page_views_total", `Page views (${days}d)`);
          fbPageViewsDelta = pctChange(sumBy(curRows, "fbPageViews"), sumBy(prevRows, "fbPageViews"));
          fbCharts.push(fbPageViews);
          fbCharts.push(toSeries("fbEngagement", "page_post_engagements", `Post engagements (${days}d)`));
          fbCharts.push(toSeries("fbVideoViews", "page_video_views", `Video views (${days}d)`));

          // IG connection is read from the cache (not a live check) so
          // this whole block stays Appwrite-only.
          if (curRows.some((r) => r.igConnected)) {
            igReach = toSeries("igReach", "reach", `IG reach (${days}d)`);
            igReachDelta = pctChange(sumBy(curRows, "igReach"), sumBy(prevRows, "igReach"));
            igCharts.push(igReach);
            igCharts.push(toSeries("igFollowerAdds", "follower_count", `New IG followers (${days}d)`));
            igFollowers = [...curRows]
              .reverse()
              .find((r) => r.igFollowersCount != null)?.igFollowersCount ?? undefined;
          }
        }

        const weekAgoYmd = addDaysYmd(untilYmd, -6);
        postsLastWeek = cadenceRows
          .filter((r) => r.date >= weekAgoYmd)
          .reduce((n, r) => n + r.postsPublishedCount, 0);
        const priorWeekCount = cadenceRows
          .filter((r) => r.date < weekAgoYmd)
          .reduce((n, r) => n + r.postsPublishedCount, 0);
        postsLastWeekDelta = pctChange(postsLastWeek, priorWeekCount);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load insights.";
    }
  }

  return (
    <div>
      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {!error && (
        <>
          {/* Stat cards */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {typeof fanCount === "number" && (
              <StatCard label="FB followers" value={fanCount.toLocaleString()} />
            )}
            {typeof igFollowers === "number" && (
              <StatCard label="IG followers" value={igFollowers.toLocaleString()} />
            )}
            {fbPageViews && (
              <StatCard
                label={`FB page views (${days}d)`}
                value={fbPageViews.total.toLocaleString()}
                delta={fbPageViewsDelta}
                tip="Meta retired page-level reach for most Pages — this is the closest metric it still reports: how many times people visited your Facebook Page."
              />
            )}
            {igReach && (
              <StatCard
                label={`IG reach (${days}d)`}
                value={igReach.total.toLocaleString()}
                delta={igReachDelta}
                tip="Number of unique Instagram accounts that saw your content, at least once, in this period."
              />
            )}
            <StatCard
              label="Posts last week"
              value={postsLastWeek.toLocaleString()}
              delta={postsLastWeekDelta}
            />
            <StatCard
              label="Scheduled ahead"
              value={scheduledAhead.toLocaleString()}
            />
          </div>

          {/* Charts */}
          {(fbCharts.length > 0 || igCharts.length > 0) && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[...fbCharts, ...igCharts].map((s) => (
                <div
                  key={s.metric}
                  className="rounded-lg border border-edge bg-card p-4 shadow-sm"
                >
                  <BarChart series={s} />
                </div>
              ))}
            </div>
          )}
          {fbCharts.length === 0 && (
            <p className="mt-6 font-mono text-[11px] text-muted">
              No stats synced yet for this range — stats update once daily.
            </p>
          )}

          <p className="mt-6 font-mono text-[10px] text-muted">
            Charts show daily values; totals are sums over the range.
          </p>

          {page &&
            (showTop ? (
              <Suspense fallback={<TopPostsSkeleton />}>
                <TopPostsSection page={page} />
              </Suspense>
            ) : (
              <div className="mt-8 rounded-lg border border-dashed border-edge bg-card/60 p-6 text-center">
                <p className="mb-4 text-sm text-muted">
                  Loads your top Facebook and Instagram posts by engagement, live from Meta.
                </p>
                <ShowTopContentButton label="Show top posts" />
              </div>
            ))}
        </>
      )}
    </div>
  );
}

/**
 * Top posts by engagement — the one part of this page that still needs
 * live Graph calls (listPublishedPosts, getIgAccount + listIgMedia), so
 * it's kept in its own nested Suspense rather than blocking the stat
 * cards/charts above, which are Appwrite-only.
 */
async function TopPostsSection({ page }: { page: ManagedPage }) {
  let topFb: PublishedPost[] = [];
  let topIg: IgMedia[] = [];
  let igUsername = "";

  try {
    const posts = await listPublishedPosts(page);
    topFb = [...posts].sort((a, b) => fbEngagement(b) - fbEngagement(a)).slice(0, 5);
  } catch {
    // Top FB posts unavailable — IG side below still renders.
  }

  try {
    const ig = await getIgAccount(page);
    if (ig) {
      igUsername = ig.username ?? "";
      try {
        const media = await listIgMedia(page, ig.id, 25);
        topIg = [...media].sort((a, b) => igEngagement(b) - igEngagement(a)).slice(0, 5);
      } catch {
        // Top IG posts unavailable — FB side above still renders.
      }
    }
  } catch {
    // No IG account resolvable at all.
  }

  return (
    <>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-1.5 font-mono text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            <PlatformIcon platform="fb" /> Top Facebook posts
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {topFb.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-edge bg-card p-3 shadow-sm"
              >
                <a
                  href={p.permalink_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <p className="line-clamp-2 text-sm">
                    {p.message || (
                      <span className="text-muted italic">(photo)</span>
                    )}
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
                    · {p.created_time.slice(0, 10)}
                  </p>
                </a>
              </li>
            ))}
            {topFb.length === 0 && (
              <li className="text-sm text-muted">No posts yet.</li>
            )}
          </ul>
        </div>
        <div>
          <h2 className="flex items-center gap-1.5 font-mono text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            <PlatformIcon platform="ig" /> Top Instagram posts
            {igUsername && ` · @${igUsername}`}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {topIg.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-edge bg-card p-3 shadow-sm"
              >
                <a
                  href={m.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3"
                >
                  {(m.thumbnail_url ?? m.media_url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.thumbnail_url ?? m.media_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-md border border-edge object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm">
                      {m.caption || (
                        <span className="text-muted italic">(image)</span>
                      )}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1 font-mono text-[10px] text-muted">
                      <span className="inline-flex items-center gap-0.5">
                        <Heart className="h-3 w-3" /> {m.like_count ?? 0}
                      </span>
                      ·
                      <span className="inline-flex items-center gap-0.5">
                        <MessageCircle className="h-3 w-3" /> {m.comments_count ?? 0}
                      </span>
                      · {(m.timestamp ?? "").slice(0, 10)}
                    </p>
                  </div>
                </a>
              </li>
            ))}
            {topIg.length === 0 && (
              <li className="text-sm text-muted">
                No Instagram media (or no IG account linked).
              </li>
            )}
          </ul>
        </div>
      </div>

      <p className="mt-6 font-mono text-[10px] text-muted">
        Top posts ranked by engagement across the 25 most recent posts per
        platform.
      </p>
    </>
  );
}

function TopPostsSkeleton() {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i}>
          <Skeleton className="h-3 w-36" />
          <div className="mt-3 flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="rounded-lg border border-edge bg-card p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
