/**
 * Idempotent Appwrite schema setup for the Chapa payment top-up feature.
 * Creates `chapa_payments` — a pending-payment ledger, separate from
 * `company_deposits`. A deposit is only ever created once a payment is
 * independently verified as successful (see lib/payments.ts); this
 * collection just tracks what we expect before/while that happens.
 *
 * The document $id IS the tx_ref (set by the caller, not ID.unique()) —
 * that's what makes crediting race-safe without a separate lock
 * collection, so there's no unique index to create here either.
 *
 * Run: npm run db:setup:chapa
 */
import { Client, Databases } from "node-appwrite";

try {
  process.loadEnvFile(".env");
} catch {
  // .env not found — fall back to whatever's already in the environment.
}

const endpoint = process.env.APPWRITE_ENDPOINT!;
const projectId = process.env.APPWRITE_PROJECT_ID!;
const apiKey = process.env.APPWRITE_API_KEY!;
const dbId = process.env.APPWRITE_DATABASE_ID!;

if (!endpoint || !projectId || !apiKey || !dbId) {
  console.error("Missing env vars — check .env for Appwrite config.");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function ignore409<T>(fn: () => Promise<T>, label: string): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (e: unknown) {
    const err = e as { code?: number; message?: string };
    if (err.code === 409) {
      console.log(`  • ${label} (already exists)`);
    } else {
      console.error(`  ✗ ${label}: ${err.message}`);
      throw e;
    }
  }
}

const COL = "chapa_payments";

async function main() {
  console.log("Setting up chapa_payments schema…\n");

  await ignore409(() => databases.createCollection(dbId, COL, "Chapa Payments"), "collection");
  await ignore409(() => databases.createStringAttribute(dbId, COL, "companyId", 36, true), "attr companyId");
  await ignore409(() => databases.createFloatAttribute(dbId, COL, "amount", true), "attr amount");
  await ignore409(() => databases.createStringAttribute(dbId, COL, "currency", 8, true), "attr currency");
  await ignore409(() => databases.createStringAttribute(dbId, COL, "status", 16, true), "attr status");
  await ignore409(() => databases.createStringAttribute(dbId, COL, "chapaReference", 64, false), "attr chapaReference");
  await ignore409(() => databases.createStringAttribute(dbId, COL, "note", 256, false), "attr note");

  console.log("\nDone. No index needed — the document $id is the tx_ref.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
