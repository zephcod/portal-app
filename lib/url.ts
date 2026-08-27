import { headers } from "next/headers";
import { env } from "./env";

/**
 * Absolute URL for `pathAndQuery` (e.g. "/topup/complete?tx_ref=abc").
 * Prefers APP_URL (set in .env) so links are stable regardless of the
 * host the request came in on; falls back to the request's own
 * host/proto if APP_URL isn't configured. Same logic as the private
 * postUrl() in app/(portal)/posts/[id]/actions.ts, factored out here
 * since the Chapa top-up flow needs it too.
 */
export async function absoluteUrl(pathAndQuery: string): Promise<string> {
  let origin = env.appUrl();
  if (!origin) {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3002";
    const proto =
      h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    origin = `${proto}://${host}`;
  }
  return `${origin}${pathAndQuery}`;
}
