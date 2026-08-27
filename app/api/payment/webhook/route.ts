import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyTransaction } from "@/lib/chapa";
import { fulfillPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

function hmacHex(key: string, message: string): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Chapa signs webhooks two ways depending on setup:
 * - `x-chapa-signature`: HMAC-SHA256 of the raw request body, keyed with
 *   the webhook secret from the dashboard.
 * - `chapa-signature`: HMAC-SHA256 of the secret key itself (message ==
 *   key, a documented Chapa quirk — not the payload), keyed with the
 *   secret key.
 * Either one verifying is sufficient.
 */
function isValidSignature(rawBody: string, headers: Headers): boolean {
  const xChapaSig = headers.get("x-chapa-signature");
  if (xChapaSig) {
    const expected = hmacHex(env.chapaWebhookSecret(), rawBody);
    if (safeEqual(xChapaSig, expected)) return true;
  }

  const chapaSig = headers.get("chapa-signature");
  if (chapaSig) {
    const secret = env.chapaSecretKey();
    const expected = hmacHex(secret, secret);
    if (safeEqual(chapaSig, expected)) return true;
  }

  return false;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  if (!isValidSignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; tx_ref?: string } | null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // No payout handling in this app, and nothing actionable without a tx_ref.
  if (!event || event.type === "Payout" || !event.tx_ref) {
    return NextResponse.json({ ok: true });
  }

  try {
    // Never trust the webhook payload's own status/amount — re-verify
    // directly with Chapa before crediting anything.
    const verified = await verifyTransaction(event.tx_ref);
    await fulfillPayment(verified);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Chapa webhook fulfil error:", e);
    // 500 so Chapa retries instead of the event being silently lost.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
