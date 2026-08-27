/**
 * Chapa top-up payment ledger + the idempotent credit step.
 *
 * Race safety: a payment's $id IS its tx_ref, and the deposit it produces
 * gets $id = `dep_${txRef}`. fulfillPayment() can be called twice for the
 * same payment (once from the customer's browser landing on
 * /topup/complete, once from Chapa's webhook, in either order or racing)
 * — whichever caller's createDeposit() wins gets "credited"; Appwrite's
 * document-uniqueness constraint turns the loser's call into a 409, which
 * we treat as proof the credit already happened ("already-credited"), not
 * an error. No separate lock collection, so there's no lock to get stuck.
 */
import { AppwriteException } from "node-appwrite";
import { env } from "./env";
import { createDeposit, getCompany } from "./data";
import { COLLECTIONS, db, DB, withRetry } from "./appwrite";
import type { VerifyTransactionResult } from "./chapa";

export type ChapaPaymentStatus = "pending" | "success" | "failed";

export interface ChapaPayment {
  $id: string;
  $createdAt: string;
  companyId: string;
  amount: number;
  currency: "ETB";
  status: ChapaPaymentStatus;
  chapaReference?: string;
  note?: string;
}

function randomToken(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** "tup_<company8>_<random16>" — Appwrite document-id safe (a-z0-9_. only, <=36 chars). */
export function generateTxRef(companyId: string): string {
  const companyPart = companyId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  return `tup_${companyPart}_${randomToken(16)}`;
}

export async function createPendingPayment(data: {
  txRef: string;
  companyId: string;
  amount: number;
  note?: string;
}): Promise<ChapaPayment> {
  return (await withRetry(() =>
    db().createDocument(DB(), COLLECTIONS.chapaPayments, data.txRef, {
      companyId: data.companyId,
      amount: data.amount,
      currency: "ETB",
      status: "pending" as ChapaPaymentStatus,
      ...(data.note !== undefined ? { note: data.note } : {}),
    })
  )) as unknown as ChapaPayment;
}

export async function getPaymentByTxRef(txRef: string): Promise<ChapaPayment | null> {
  try {
    return (await withRetry(() =>
      db().getDocument(DB(), COLLECTIONS.chapaPayments, txRef)
    )) as unknown as ChapaPayment;
  } catch {
    return null;
  }
}

export async function markPaymentStatus(
  txRef: string,
  status: ChapaPaymentStatus,
  chapaReference?: string
): Promise<void> {
  await withRetry(() =>
    db().updateDocument(DB(), COLLECTIONS.chapaPayments, txRef, {
      status,
      ...(chapaReference !== undefined ? { chapaReference } : {}),
    })
  );
}

export type FulfillOutcome = "credited" | "already-credited" | "ignored" | "mismatch";

/**
 * Credit the account for a verified transaction. Idempotent and safe to
 * call from multiple racing callers (see file header). Only ever trusts
 * `verified` — the result of an explicit server-side Chapa verify call,
 * never a client-supplied or raw-webhook status/amount.
 */
export async function fulfillPayment(verified: VerifyTransactionResult): Promise<FulfillOutcome> {
  if (verified.status !== "success") return "ignored";

  const payment = await getPaymentByTxRef(verified.tx_ref);
  if (!payment) return "ignored";
  if (payment.status === "success") return "already-credited";

  const company = await getCompany(payment.companyId);
  if (!company) return "ignored";

  const amountMatches = Math.abs(verified.amount - payment.amount) < 0.01;
  const currencyMatches = verified.currency === payment.currency;
  const modeMatches = !verified.mode || verified.mode === env.chapaMode();
  if (!amountMatches || !currencyMatches || !modeMatches) {
    return "mismatch";
  }

  try {
    await createDeposit(
      {
        companyId: payment.companyId,
        amount: payment.amount,
        date: new Date().toISOString().slice(0, 10),
        note: `Chapa top-up (${payment.$id})`,
        // The client's "reason" input, stored on the payment — used as the
        // deposit's parent-campaign group so the top-up shows under it on
        // the balance breakdown instead of defaulting to "Other campaigns".
        ...(payment.note?.trim() ? { parentCampaign: payment.note.trim() } : {}),
      },
      `dep_${payment.$id}`
    );
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 409) {
      return "already-credited";
    }
    throw e;
  }

  await markPaymentStatus(payment.$id, "success", verified.chapaReference);
  return "credited";
}
