import { COLLECTIONS, db, DB, ID, listAll, Query, withRetry } from "./appwrite";
import type {
  Campaign,
  CampaignCost,
  Company,
  CostCategory,
  InsightDaily,
  Issue,
  IssueStatus,
} from "./domain";

// ── Companies ─────────────────────────────────────────────

export async function getCompanies(): Promise<Company[]> {
  return listAll<Company>(COLLECTIONS.companies, [Query.orderAsc("name")]);
}

export async function getCompany(id: string): Promise<Company | null> {
  try {
    return (await db().getDocument(
      DB(),
      COLLECTIONS.companies,
      id
    )) as unknown as Company;
  } catch {
    return null;
  }
}

export async function getCompanyByPin(pin: string): Promise<Company | null> {
  const res = await db().listDocuments(DB(), COLLECTIONS.companies, [
    Query.equal("pin", pin),
    Query.equal("active", true),
    Query.limit(1),
  ]);
  return (res.documents[0] as unknown as Company) ?? null;
}

export async function createCompany(
  data: Partial<Omit<Company, "$id" | "$createdAt">> & {
    name: string;
    pin: string;
  }
): Promise<Company> {
  return (await db().createDocument(DB(), COLLECTIONS.companies, ID.unique(), {
    currency: "ETB",
    active: true,
    ...data,
  })) as unknown as Company;
}

export async function updateCompany(
  id: string,
  data: Partial<Omit<Company, "$id" | "$createdAt">>
): Promise<void> {
  await db().updateDocument(DB(), COLLECTIONS.companies, id, data);
}

// ── Campaigns ─────────────────────────────────────────────

export async function getCampaigns(companyId: string): Promise<Campaign[]> {
  return listAll<Campaign>(COLLECTIONS.campaigns, [
    Query.equal("companyId", companyId),
    Query.orderAsc("name"),
  ]);
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  return listAll<Campaign>(COLLECTIONS.campaigns, [Query.orderAsc("name")]);
}

/**
 * Upsert a campaign keyed by metaCampaignId alone. If the campaign already
 * exists, its company assignment is PRESERVED (an admin may have reassigned
 * it to a different company sharing the same ad account) and only metadata
 * is refreshed. Returns the companyId the campaign is assigned to.
 */
export async function upsertCampaign(c: {
  companyId: string;
  metaCampaignId: string;
  adAccountId?: string;
  name: string;
  adCount?: number;
  objective?: string;
  status?: string;
}): Promise<string> {
  const existing = await withRetry(() =>
    db().listDocuments(DB(), COLLECTIONS.campaigns, [
      Query.equal("metaCampaignId", c.metaCampaignId),
      Query.limit(1),
    ])
  );
  if (existing.total > 0) {
    const doc = existing.documents[0] as unknown as Campaign;
    await withRetry(() =>
      db().updateDocument(DB(), COLLECTIONS.campaigns, doc.$id, {
        name: c.name,
        objective: c.objective ?? null,
        status: c.status ?? null,
        ...(c.adAccountId ? { adAccountId: c.adAccountId } : {}),
        ...(c.adCount !== undefined ? { adCount: c.adCount } : {}),
      })
    );
    return doc.companyId;
  }
  await withRetry(() =>
    db().createDocument(DB(), COLLECTIONS.campaigns, ID.unique(), c)
  );
  return c.companyId;
}

/** Set (or clear) a campaign's parent-campaign group label. */
export async function setCampaignParent(
  campaignId: string,
  parentCampaign: string | null
): Promise<void> {
  await withRetry(() =>
    db().updateDocument(DB(), COLLECTIONS.campaigns, campaignId, {
      parentCampaign,
    })
  );
}

/**
 * Move a campaign to another company and migrate its existing daily
 * insight rows so historical data follows the assignment.
 * Returns the number of insight rows migrated.
 */
export async function reassignCampaign(
  campaignId: string,
  newCompanyId: string
): Promise<number> {
  const campaign = (await db().getDocument(
    DB(),
    COLLECTIONS.campaigns,
    campaignId
  )) as unknown as Campaign;
  if (campaign.companyId === newCompanyId) return 0;

  await withRetry(() =>
    db().updateDocument(DB(), COLLECTIONS.campaigns, campaignId, {
      companyId: newCompanyId,
    })
  );

  const rows = await listAll<InsightDaily>(COLLECTIONS.insights, [
    Query.equal("metaCampaignId", campaign.metaCampaignId),
  ]);
  let migrated = 0;
  for (const r of rows) {
    if (r.companyId === newCompanyId) continue;
    await withRetry(() =>
      db().updateDocument(DB(), COLLECTIONS.insights, r.$id, {
        companyId: newCompanyId,
      })
    );
    migrated++;
  }
  return migrated;
}

// ── Daily insights ────────────────────────────────────────

export async function getInsights(
  companyId: string,
  since: string,
  until: string
): Promise<InsightDaily[]> {
  return listAll<InsightDaily>(COLLECTIONS.insights, [
    Query.equal("companyId", companyId),
    Query.greaterThanEqual("date", since),
    Query.lessThanEqual("date", until),
    Query.orderAsc("date"),
  ]);
}

export async function getInsight(id: string): Promise<InsightDaily | null> {
  try {
    return (await db().getDocument(
      DB(),
      COLLECTIONS.insights,
      id
    )) as unknown as InsightDaily;
  } catch {
    return null;
  }
}

/**
 * Upsert a daily insight row keyed by (companyId, metaCampaignId, date).
 * Rows flagged `edited` are preserved unless `force` is set — manual
 * corrections survive subsequent Meta syncs.
 */
export async function upsertInsight(
  row: Omit<InsightDaily, "$id" | "$createdAt" | "$updatedAt" | "edited"> & {
    edited?: boolean;
  },
  opts: { force?: boolean } = {}
): Promise<"created" | "updated" | "skipped"> {
  const existing = await withRetry(() =>
    db().listDocuments(DB(), COLLECTIONS.insights, [
      Query.equal("companyId", row.companyId),
      Query.equal("metaCampaignId", row.metaCampaignId),
      Query.equal("date", row.date),
      Query.limit(1),
    ])
  );
  if (existing.total > 0) {
    const doc = existing.documents[0] as unknown as InsightDaily;
    if (doc.edited && !opts.force) return "skipped";
    await withRetry(() =>
      db().updateDocument(DB(), COLLECTIONS.insights, doc.$id, {
        spend: row.spend,
        impressions: row.impressions,
        reach: row.reach,
        clicks: row.clicks,
        leads: row.leads,
        calls: row.calls ?? 0,
        results: row.results ?? row.leads + (row.calls ?? 0),
        edited: row.edited ?? false,
        ...(row.notes !== undefined ? { notes: row.notes } : {}),
      })
    );
    return "updated";
  }
  await withRetry(() =>
    db().createDocument(DB(), COLLECTIONS.insights, ID.unique(), {
      ...row,
      edited: row.edited ?? false,
    })
  );
  return "created";
}

// ── Additional campaign costs ─────────────────────────────

export async function getCosts(
  companyId: string,
  since?: string,
  until?: string
): Promise<CampaignCost[]> {
  return listAll<CampaignCost>(COLLECTIONS.costs, [
    Query.equal("companyId", companyId),
    ...(since ? [Query.greaterThanEqual("date", since)] : []),
    ...(until ? [Query.lessThanEqual("date", until)] : []),
    Query.orderDesc("date"),
  ]);
}

export async function createCost(data: {
  companyId: string;
  metaCampaignId: string;
  category: CostCategory;
  description?: string;
  amount: number;
  date: string;
}): Promise<CampaignCost> {
  return (await withRetry(() =>
    db().createDocument(DB(), COLLECTIONS.costs, ID.unique(), data)
  )) as unknown as CampaignCost;
}

export async function deleteCost(id: string): Promise<void> {
  await withRetry(() => db().deleteDocument(DB(), COLLECTIONS.costs, id));
}

// ── Issues ────────────────────────────────────────────────

export async function getIssues(companyId?: string): Promise<Issue[]> {
  return listAll<Issue>(COLLECTIONS.issues, [
    ...(companyId ? [Query.equal("companyId", companyId)] : []),
    Query.orderDesc("$createdAt"),
  ]);
}

export async function createIssue(data: {
  companyId: string;
  title: string;
  body: string;
}): Promise<Issue> {
  return (await withRetry(() =>
    db().createDocument(DB(), COLLECTIONS.issues, ID.unique(), {
      ...data,
      status: "open",
    })
  )) as unknown as Issue;
}

export async function updateIssue(
  id: string,
  data: { status?: IssueStatus; response?: string }
): Promise<void> {
  await withRetry(() => db().updateDocument(DB(), COLLECTIONS.issues, id, data));
}

export async function updateInsight(
  id: string,
  data: Partial<
    Pick<
      InsightDaily,
      | "spend"
      | "impressions"
      | "reach"
      | "clicks"
      | "leads"
      | "calls"
      | "results"
      | "notes"
    >
  >
): Promise<void> {
  await db().updateDocument(DB(), COLLECTIONS.insights, id, {
    ...data,
    edited: true,
  });
}
