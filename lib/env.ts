function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

export const env = {
  // ── Public app origin (for building absolute links, e.g. in comment titles) ──
  appUrl: () => (process.env.APP_URL ?? "").replace(/\/+$/, ""),

  // ── Scheduler app (owns the Meta → organic_stats_daily sync) ──
  // Used by the Insights "Sync now" button, which calls the scheduler's
  // /api/cron/organic-stats?company=<id>. Optional: unset hides the button.
  schedulerUrl: () => (process.env.SCHEDULER_URL ?? "").replace(/\/+$/, ""),
  schedulerCronSecret: () => process.env.SCHEDULER_CRON_SECRET ?? "",

  // ── Meta Graph API (social pages) ──
  // Which pages are in scope is derived live from each company's
  // fbPageId in Appwrite (see lib/pages.ts) — no id list here.
  systemToken: () => process.env.FB_SYSTEM_USER_TOKEN ?? "",
  legacyPageId: () => process.env.FB_PAGE_ID ?? "",
  legacyPageToken: () => process.env.FB_PAGE_ACCESS_TOKEN ?? "",
  graphVersion: () => process.env.FB_GRAPH_VERSION ?? "v23.0",

  // ── Appwrite (companies, report data, IG queue) — required ──
  appwriteEndpoint: () => req("APPWRITE_ENDPOINT"),
  appwriteProjectId: () => req("APPWRITE_PROJECT_ID"),
  appwriteApiKey: () => req("APPWRITE_API_KEY"),
  databaseId: () => req("APPWRITE_DATABASE_ID"),
  // Alias used by libs shared with the scheduler app.
  appwriteDatabaseId: () => req("APPWRITE_DATABASE_ID"),

  // ── Chapa payment gateway (marketing budget top-ups) — required ──
  chapaSecretKey: () => req("CHAPA_SECRET_KEY"),
  chapaWebhookSecret: () => req("CHAPA_WEBHOOK_SECRET"),
  chapaMode: (): "test" | "live" => {
    const v = (process.env.CHAPA_MODE ?? "").toLowerCase();
    if (v !== "test" && v !== "live") {
      throw new Error('Missing/invalid CHAPA_MODE env var (expected "test" or "live")');
    }
    return v;
  },
};

/** IG queue shares the Appwrite database, which the portal requires anyway. */
export function igQueueConfigured(): boolean {
  return Boolean(
    process.env.APPWRITE_ENDPOINT &&
      process.env.APPWRITE_PROJECT_ID &&
      process.env.APPWRITE_API_KEY &&
      process.env.APPWRITE_DATABASE_ID
  );
}

/** FB queue shares the Appwrite database, which the portal requires anyway. */
export function fbQueueConfigured(): boolean {
  return Boolean(
    process.env.APPWRITE_ENDPOINT &&
      process.env.APPWRITE_PROJECT_ID &&
      process.env.APPWRITE_API_KEY &&
      process.env.APPWRITE_DATABASE_ID
  );
}
