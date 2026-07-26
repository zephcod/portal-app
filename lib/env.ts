function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

export const env = {
  // ── Meta Graph API (social pages) ──
  systemToken: () => process.env.FB_SYSTEM_USER_TOKEN ?? "",
  pageIds: (): string[] => {
    const raw = process.env.FB_PAGE_IDS ?? process.env.FB_PAGE_ID ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
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
};

export function fbConfigured(): boolean {
  const multi = Boolean(env.systemToken()) && env.pageIds().length > 0;
  const legacy = Boolean(env.legacyPageId() && env.legacyPageToken());
  return multi || legacy;
}

/** IG queue shares the Appwrite database, which the portal requires anyway. */
export function igQueueConfigured(): boolean {
  return Boolean(
    process.env.APPWRITE_ENDPOINT &&
      process.env.APPWRITE_PROJECT_ID &&
      process.env.APPWRITE_API_KEY &&
      process.env.APPWRITE_DATABASE_ID
  );
}
