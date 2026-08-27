/**
 * Thin server-side client for Chapa's Standard/Hosted checkout API.
 * https://developer.chapa.co/ — Standard/Hosted flow: initialize a
 * transaction here, redirect the browser to the returned checkout_url,
 * then independently re-verify server-side before crediting anything
 * (never trust the browser return or the raw webhook payload).
 */
import { env } from "./env";

const BASE = "https://api.chapa.co/v1";

export class ChapaError extends Error {}

export interface InitializeTransactionInput {
  amount: number;
  currency: "ETB";
  tx_ref: string;
  return_url: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  title?: string;
  description?: string;
}

export async function initializeTransaction(
  input: InitializeTransactionInput
): Promise<{ checkoutUrl: string }> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.chapaSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      tx_ref: input.tx_ref,
      return_url: input.return_url,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      customization: {
        title: input.title,
        description: input.description,
      },
    }),
  });

  const json = (await res.json().catch(() => null)) as {
    status?: string;
    message?: string;
    data?: { checkout_url?: string };
  } | null;

  if (!res.ok || json?.status !== "success" || !json.data?.checkout_url) {
    throw new ChapaError(
      `Chapa initialize failed: ${json?.message ?? res.statusText} (HTTP ${res.status})`
    );
  }

  return { checkoutUrl: json.data.checkout_url };
}

export type VerifyTransactionStatus = "success" | "failed" | "pending";

export interface VerifyTransactionResult {
  status: VerifyTransactionStatus;
  tx_ref: string;
  amount: number;
  currency: string;
  chapaReference?: string;
  mode?: string;
}

export async function verifyTransaction(
  txRef: string
): Promise<VerifyTransactionResult> {
  const res = await fetch(
    `${BASE}/transaction/verify/${encodeURIComponent(txRef)}`,
    { headers: { Authorization: `Bearer ${env.chapaSecretKey()}` } }
  );

  // Chapa returns 404 for a transaction that hasn't been paid yet —
  // that's a real "pending" state, not an error.
  if (res.status === 404) {
    return { status: "pending", tx_ref: txRef, amount: 0, currency: "" };
  }

  const json = (await res.json().catch(() => null)) as {
    status?: string;
    data?: {
      status?: string;
      tx_ref?: string;
      amount?: string | number;
      currency?: string;
      reference?: string;
      mode?: string;
    };
  } | null;

  if (!res.ok || json?.status !== "success" || !json.data) {
    throw new ChapaError(`Chapa verify failed (HTTP ${res.status})`);
  }

  const d = json.data;
  const rawStatus = (d.status ?? "").toLowerCase();
  const status: VerifyTransactionStatus =
    rawStatus === "success" ? "success" : rawStatus === "failed" ? "failed" : "pending";

  return {
    status,
    tx_ref: d.tx_ref ?? txRef,
    amount: typeof d.amount === "string" ? parseFloat(d.amount) : d.amount ?? 0,
    currency: d.currency ?? "",
    chapaReference: d.reference,
    mode: d.mode,
  };
}
