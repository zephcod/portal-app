import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/server-session";
import { MetricCard } from "@/components/MetricCard";
import { RangeSelect } from "@/components/RangeSelect";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { getCampaigns, getCompany, getCosts, getInsights } from "@/lib/data";
import {
  computeTotals,
  COST_CATEGORY_LABELS,
  DEFAULT_CURRENCY_MULTIPLIER,
  money,
  num,
  rangeToDates,
} from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { campaignId } = await params;
  const { range } = await searchParams;
  const session = await getSession();
  if (!session) notFound();
  const companyId = session.cid;
  const company = await getCompany(companyId);
  if (!company) notFound();

  const campaigns = await getCampaigns(companyId);
  // The campaign must belong to this company (assignments are per company).
  const campaign = campaigns.find((c) => c.metaCampaignId === campaignId);
  if (!campaign) notFound();

  const { since, until } = rangeToDates(range ?? "30d");
  const [allRows, allCosts] = await Promise.all([
    getInsights(companyId, since, until),
    getCosts(companyId, since, until),
  ]);

  const multiplier = company.currencyMultiplier ?? DEFAULT_CURRENCY_MULTIPLIER;
  const rows = allRows
    .filter((r) => r.metaCampaignId === campaignId)
    .map((r) => ({ ...r, spend: r.spend * multiplier }));
  const costs = allCosts.filter((c) => c.metaCampaignId === campaignId);

  const totals = computeTotals(rows);
  const costTotal = costs.reduce((n, c) => n + c.amount, 0);
  const totalInvestment = totals.spend + costTotal;
  const cur = company.currency || "ETB";

  const trend: TrendPoint[] = rows
    .map((r) => ({ date: r.date, spend: r.spend, clicks: r.clicks, leads: r.leads }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/advertising"
            className="flex items-center gap-1 text-sm text-muted hover:text-fg"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All campaigns
          </Link>
          <h1 className="mt-1 truncate text-3xl font-bold">{campaign.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {[campaign.objective, campaign.status].filter(Boolean).join(" · ")}
            {campaign.objective || campaign.status ? " · " : ""}
            {since} → {until}
          </p>
        </div>
        <RangeSelect />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Ad spend" value={money(totals.spend, cur)} />
        <MetricCard label="Impressions" value={num(totals.impressions)} />
        <MetricCard label="Reach" value={num(totals.reach)} />
        <MetricCard
          label="Clicks"
          value={num(totals.clicks)}
          sub={`CPC ${money(totals.cpc, cur)}`}
        />
        <MetricCard label="Leads" value={num(totals.leads)} />
        <MetricCard
          label="Cost per lead"
          value={totals.leads ? money(totals.cpl, cur) : "—"}
        />
        <MetricCard label="Services" value={money(costTotal, cur)} />
        <MetricCard label="Total investment" value={money(totalInvestment, cur)} />
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Daily performance</h2>
        <TrendChart data={trend} currency={cur} />
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card shadow-sm">
        <h2 className="px-4 pt-5 text-lg font-semibold sm:px-6">Daily breakdown</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-muted">
                {["Date", "Spend", "Impressions", "Reach", "Clicks", "Leads", "Calls", "CPR"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 font-medium sm:px-6">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted">
                    No data for this period yet.
                  </td>
                </tr>
              )}
              {[...rows]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((r) => (
                  <tr key={r.$id} className="border-b border-edge/60 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs sm:px-6">{r.date}</td>
                    <td className="px-4 py-3 sm:px-6">{money(r.spend, cur)}</td>
                    <td className="px-4 py-3 sm:px-6">{num(r.impressions)}</td>
                    <td className="px-4 py-3 sm:px-6">{num(r.reach)}</td>
                    <td className="px-4 py-3 sm:px-6">{num(r.clicks)}</td>
                    <td className="px-4 py-3 sm:px-6">{num(r.leads)}</td>
                    <td className="px-4 py-3 sm:px-6">{num(r.calls ?? 0)}</td>
                    <td className="px-4 py-3 sm:px-6">
                      {(() => {
                        const res = r.results ?? r.leads + (r.calls ?? 0);
                        return res ? money(r.spend / res, cur) : "—";
                      })()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {costs.length > 0 && (
        <section className="mt-8 rounded-xl border border-edge bg-card shadow-sm">
          <h2 className="px-4 pt-5 text-lg font-semibold sm:px-6">
            Additional charges
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-muted">
                  {["Date", "Service", "Amount"].map((h) => (
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
    </div>
  );
}
