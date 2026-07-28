import { Fragment, Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/MetricCard";
import { RangeSelect } from "@/components/RangeSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { getCampaigns, getCompany, getCosts, getInsights } from "@/lib/data";
import {
  computeTotals,
  COST_CATEGORY_LABELS,
  DEFAULT_CURRENCY_MULTIPLIER,
  money,
  num,
  pctChange,
  previousRange,
  RANGE_PRESETS,
  rangeToDates,
  type Company,
  type InsightDaily,
} from "@/lib/domain";
import { getSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

function toTrend(rows: InsightDaily[]): TrendPoint[] {
  const byDate = new Map<string, TrendPoint>();
  for (const r of rows) {
    const p = byDate.get(r.date) ?? {
      date: r.date,
      spend: 0,
      clicks: 0,
      leads: 0,
    };
    p.spend += r.spend;
    p.clicks += r.clicks;
    p.leads += r.leads;
    byDate.set(r.date, p);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const rangeKey = range ?? "30d";

  // Fast, Appwrite-only lookups — render the header immediately, then
  // stream in the metric cards/chart/tables below it.
  const session = await getSession();
  if (!session) notFound();
  const company = await getCompany(session.cid);
  if (!company) notFound();

  const { since, until } = rangeToDates(rangeKey);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-sm font-semibold text-amber">
            Awaj ET · Campaign Report
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold">{company.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {since} → {until}
          </p>
        </div>
        <RangeSelect />
      </header>

      <Suspense fallback={<ReportBodySkeleton />}>
        <ReportBody
          companyId={session.cid}
          company={company}
          rangeKey={rangeKey}
          range={range}
        />
      </Suspense>
    </div>
  );
}

async function ReportBody({
  companyId,
  company,
  rangeKey,
  range,
}: {
  companyId: string;
  company: Company;
  rangeKey: string;
  range?: string;
}) {
  const { since, until } = rangeToDates(rangeKey);
  const prev = previousRange(since, until);
  const periodLabel = `prior ${(
    RANGE_PRESETS.find((p) => p.key === rangeKey)?.label ?? "last 30 days"
  ).replace(/^last /i, "")}`;

  const [rawRows, prevRawRows, campaigns, costs] = await Promise.all([
    getInsights(companyId, since, until),
    getInsights(companyId, prev.since, prev.until),
    getCampaigns(companyId),
    getCosts(companyId, since, until),
  ]);

  // Convert synced spend into the report currency (e.g. USD → ETB).
  const multiplier = company.currencyMultiplier ?? DEFAULT_CURRENCY_MULTIPLIER;
  const rows = rawRows.map((r) => ({ ...r, spend: r.spend * multiplier }));
  const prevRows = prevRawRows.map((r) => ({ ...r, spend: r.spend * multiplier }));

  const totals = computeTotals(rows);
  const prevTotals = computeTotals(prevRows);
  const trend = toTrend(rows);
  const cur = company.currency || "ETB";
  const campaignName = new Map(campaigns.map((c) => [c.metaCampaignId, c.name]));

  // Per-campaign aggregation
  const byCampaign = new Map<string, InsightDaily[]>();
  for (const r of rows) {
    const list = byCampaign.get(r.metaCampaignId) ?? [];
    list.push(r);
    byCampaign.set(r.metaCampaignId, list);
  }
  const campaignRows = [...byCampaign.entries()]
    .map(([id, list]) => ({
      id,
      name: campaignName.get(id) ?? id,
      totals: computeTotals(list),
    }))
    .sort((a, b) => b.totals.spend - a.totals.spend);

  const costTotal = costs.reduce((n, c) => n + c.amount, 0);
  const totalInvestment = totals.spend + costTotal;

  // ── Group campaigns by their parent-campaign label ──
  const parentOf = new Map(
    campaigns.map((c) => [c.metaCampaignId, c.parentCampaign?.trim() || null])
  );
  const groupMap = new Map<string | null, typeof campaignRows>();
  for (const row of campaignRows) {
    const parent = parentOf.get(row.id) ?? null;
    const list = groupMap.get(parent) ?? [];
    list.push(row);
    groupMap.set(parent, list);
  }
  const groups = [...groupMap.entries()]
    .map(([parent, rows]) => ({
      parent,
      rows,
      spend: rows.reduce((n, r) => n + r.totals.spend, 0),
      leads: rows.reduce((n, r) => n + r.totals.leads, 0),
    }))
    // Named groups by spend desc; ungrouped campaigns last.
    .sort((a, b) => {
      if (a.parent === null) return 1;
      if (b.parent === null) return -1;
      return b.spend - a.spend;
    });
  const hasGroups = groups.some((g) => g.parent !== null);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Ad Spend"
          value={money(totals.spend, cur)}
          delta={pctChange(totals.spend, prevTotals.spend)}
          periodLabel={periodLabel}
          deltaGoodDirection="down"
        />
        <MetricCard
          label="Impressions"
          value={num(totals.impressions)}
          delta={pctChange(totals.impressions, prevTotals.impressions)}
          periodLabel={periodLabel}
          tip="Total number of times your ads were displayed, including repeat views by the same person."
        />
        <MetricCard
          label="Reach"
          value={num(totals.reach)}
          delta={pctChange(totals.reach, prevTotals.reach)}
          periodLabel={periodLabel}
          tip="Number of unique people who saw your ads at least once."
        />
        <MetricCard
          label="Clicks"
          value={num(totals.clicks)}
          sub={`CPC ${money(totals.cpc, cur)}`}
          delta={pctChange(totals.clicks, prevTotals.clicks)}
          periodLabel={periodLabel}
        />
        <MetricCard
          label="Leads"
          value={num(totals.leads)}
          delta={pctChange(totals.leads, prevTotals.leads)}
          periodLabel={periodLabel}
        />
        <MetricCard
          label="Cost per lead"
          value={totals.leads ? money(totals.cpl, cur) : "—"}
          delta={totals.leads && prevTotals.leads ? pctChange(totals.cpl, prevTotals.cpl) : undefined}
          periodLabel={periodLabel}
          deltaGoodDirection="down"
          tip="Ad spend divided by number of leads generated — lower is better."
        />
        <MetricCard
          label="CPR"
          value={totals.results ? money(totals.cpr, cur) : "—"}
          delta={totals.results && prevTotals.results ? pctChange(totals.cpr, prevTotals.cpr) : undefined}
          periodLabel={periodLabel}
          deltaGoodDirection="down"
          tip="Ad spend divided by total results (leads + calls) — lower is better."
        />
        <MetricCard
          label="CPC"
          value={totals.clicks ? money(totals.cpc, cur) : "—"}
          delta={totals.clicks && prevTotals.clicks ? pctChange(totals.cpc, prevTotals.cpc) : undefined}
          periodLabel={periodLabel}
          deltaGoodDirection="down"
          tip="Ad spend divided by number of clicks — lower is better."
        />
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <h2 className="font-display mb-4 text-lg font-semibold">Daily performance</h2>
        <TrendChart data={trend} currency={cur} />
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card shadow-sm">
        <h2 className="font-display px-4 pt-5 text-lg font-semibold sm:px-6">Campaigns</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-muted">
                {["Campaign", "Spend", "Impressions", "Clicks", "CPC", "Leads", "CPL", "CPR"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 font-medium sm:px-6">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {campaignRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted">
                    No campaign data for this period yet.
                  </td>
                </tr>
              )}
              {groups.map((group) => (
                <Fragment key={group.parent ?? "__ungrouped__"}>
                  {hasGroups && (
                    <tr className="border-b border-edge bg-app/70">
                      <td
                        colSpan={8}
                        className="px-4 py-2.5 sm:px-6"
                      >
                        <span className="font-display text-sm font-semibold">
                          {group.parent ?? "Other campaigns"}
                        </span>
                        <span className="ml-3 text-xs text-muted">
                          {money(group.spend, cur)} · {num(group.leads)} lead
                          {group.leads === 1 ? "" : "s"}
                        </span>
                      </td>
                    </tr>
                  )}
                  {group.rows.map((c) => (
                    <tr key={c.id} className="border-b border-edge/60 last:border-0">
                      <td className="max-w-64 truncate px-4 py-3 font-medium sm:px-6">
                        <Link
                          href={`/c/${c.id}${range ? `?range=${range}` : ""}`}
                          className="text-fg transition-colors hover:text-amber hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 sm:px-6">{money(c.totals.spend, cur)}</td>
                      <td className="px-4 py-3 sm:px-6">{num(c.totals.impressions)}</td>
                      <td className="px-4 py-3 sm:px-6">{num(c.totals.clicks)}</td>
                      <td className="px-4 py-3 sm:px-6">
                        {c.totals.clicks ? money(c.totals.cpc, cur) : "—"}
                      </td>
                      <td className="px-4 py-3 sm:px-6">{num(c.totals.leads)}</td>
                      <td className="px-4 py-3 sm:px-6">
                        {c.totals.leads ? money(c.totals.cpl, cur) : "—"}
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        {c.totals.results ? money(c.totals.cpr, cur) : "—"}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {costs.length > 0 && (
        <section className="mt-8 rounded-xl border border-edge bg-card shadow-sm">
          <h2 className="font-display px-4 pt-5 text-lg font-semibold sm:px-6">
            Additional charges
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-muted">
                  {["Date", "Campaign", "Service", "Amount"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium sm:px-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costs.map((cost) => (
                  <tr key={cost.$id} className="border-b border-edge/60 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs sm:px-6">{cost.date}</td>
                    <td className="max-w-56 truncate px-4 py-3 sm:px-6">
                      {campaignName.get(cost.metaCampaignId) ?? cost.metaCampaignId}
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      {COST_CATEGORY_LABELS[cost.category]}
                      {cost.description && (
                        <span className="text-muted"> — {cost.description}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 sm:px-6">{money(cost.amount, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Totals bar — outside the horizontal-scroll area so it's always
              fully visible on mobile. */}
          <div className="rounded-b-xl border-t border-edge bg-app/60 px-4 py-3 sm:px-6">
            <dl className="flex flex-col gap-1.5 text-sm sm:flex-row sm:justify-end sm:gap-8">
              <div className="flex items-baseline justify-between gap-4 sm:justify-start">
                <dt className="text-muted">Services</dt>
                <dd>{money(costTotal, cur)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 sm:justify-start">
                <dt className="text-muted">Ad spend</dt>
                <dd>{money(totals.spend, cur)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 font-semibold sm:justify-start">
                <dt>Total investment</dt>
                <dd className="text-amber">{money(totalInvestment, cur)}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      <footer className="mt-10 text-center text-xs text-muted">
        Prepared by{" "}
        {company.accountManager ? `${company.accountManager} · Awaj ET` : "Awaj ET"}
      </footer>
    </>
  );
}

function ReportBodySkeleton() {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="rounded-xl border border-edge bg-card p-4 shadow-sm"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-16" />
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <Skeleton className="mb-4 h-5 w-40" />
        <Skeleton className="h-56 w-full" />
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card shadow-sm">
        <div className="px-4 pt-5 sm:px-6">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="mt-4 flex flex-col gap-3 px-4 pb-6 sm:px-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </section>
    </>
  );
}
