/**
 * Company account balance — ported from the leadgen app's lib/statement.ts
 * (same `deposits`/`costs`/`insights` collections, same shared database).
 * Balance per parent-campaign group = deposits − lifetime ad spend −
 * additional costs; a positive balance is prepaid credit, negative is an
 * amount owing. Deliberately just the balance calc, not the full
 * statement/VAT/WHT logic — that stays a reports-app-only concern.
 */

import { getAllInsights, getCampaigns, getCompany, getCosts, getDeposits } from "./data";
import {
  DEFAULT_CURRENCY_MULTIPLIER,
  OTHER_PARENT,
  type Campaign,
  type CampaignCost,
} from "./domain";

/**
 * Which parent-campaign group a cost belongs to: its own `parentCampaign`
 * label (current model) if set, else a campaign lookup for legacy rows
 * that only carry `metaCampaignId`.
 */
export function costGroupKey(
  cost: Pick<CampaignCost, "parentCampaign" | "metaCampaignId">,
  campaigns: Campaign[]
): string {
  if (cost.parentCampaign?.trim()) return cost.parentCampaign.trim();
  if (cost.metaCampaignId) {
    const c = campaigns.find((c) => c.metaCampaignId === cost.metaCampaignId);
    if (c?.parentCampaign?.trim()) return c.parentCampaign.trim();
  }
  return OTHER_PARENT;
}

export interface CompanyBalanceGroup {
  parentKey: string;
  parentLabel: string;
  deposits: number;
  adSpend: number;
  costs: number;
  balance: number;
}

export interface CompanyBalance {
  total: number;
  byGroup: CompanyBalanceGroup[];
}

/**
 * Lifetime account balance per parent-campaign group: deposits − ad spend
 * − additional costs. `total` sums every group. A group can exist purely
 * from a logged deposit even before any campaign is assigned to it.
 */
export async function computeCompanyBalance(companyId: string): Promise<CompanyBalance> {
  const company = await getCompany(companyId);
  if (!company) return { total: 0, byGroup: [] };

  const [campaigns, allInsights, allCosts, allDeposits] = await Promise.all([
    getCampaigns(companyId),
    getAllInsights(companyId),
    getCosts(companyId),
    getDeposits(companyId),
  ]);

  const multiplier = company.currencyMultiplier ?? DEFAULT_CURRENCY_MULTIPLIER;
  const groupOf = (v: string | undefined) => v?.trim() || OTHER_PARENT;

  const groupKeys = new Set<string>();
  for (const c of campaigns) groupKeys.add(groupOf(c.parentCampaign));
  for (const c of allCosts) groupKeys.add(costGroupKey(c, campaigns));
  for (const d of allDeposits) groupKeys.add(groupOf(d.parentCampaign));

  const byGroup: CompanyBalanceGroup[] = [...groupKeys].map((key) => {
    const campaignIds = new Set(
      campaigns.filter((c) => groupOf(c.parentCampaign) === key).map((c) => c.metaCampaignId)
    );
    const adSpend = allInsights
      .filter((r) => campaignIds.has(r.metaCampaignId))
      .reduce((n, r) => n + r.spend * multiplier, 0);
    const costs = allCosts
      .filter((c) => costGroupKey(c, campaigns) === key)
      .reduce((n, c) => n + c.amount, 0);
    const deposits = allDeposits
      .filter((d) => groupOf(d.parentCampaign) === key)
      .reduce((n, d) => n + d.amount, 0);
    return {
      parentKey: key,
      parentLabel: key === OTHER_PARENT ? "Other campaigns" : key,
      deposits,
      adSpend,
      costs,
      balance: deposits - adSpend - costs,
    };
  });

  return { total: byGroup.reduce((n, g) => n + g.balance, 0), byGroup };
}
