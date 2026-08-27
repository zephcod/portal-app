"use server";

import { redirect } from "next/navigation";
import { getCompany } from "@/lib/data";
import { getSession } from "@/lib/server-session";
import { initializeTransaction } from "@/lib/chapa";
import { createPendingPayment, generateTxRef } from "@/lib/payments";
import { absoluteUrl } from "@/lib/url";

const MIN_AMOUNT_ETB = 3_000;
const MAX_AMOUNT_ETB = 500_000;

export async function startTopUp(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const companyId = session.cid;
  if (!companyId) throw new Error("Missing company");

  const company = await getCompany(companyId);
  if (!company) throw new Error("Company not found");
  if (company.currency !== "ETB") {
    throw new Error("Online top-up is only available for ETB accounts right now. Contact your Awaj account manager.");
  }

  const rawAmount = Number(formData.get("amount"));
  if (!Number.isFinite(rawAmount) || rawAmount < MIN_AMOUNT_ETB || rawAmount > MAX_AMOUNT_ETB) {
    throw new Error(`Enter an amount between ${MIN_AMOUNT_ETB} and ${MAX_AMOUNT_ETB.toLocaleString("en-US")} ETB`);
  }
  const amount = Math.round(rawAmount * 100) / 100;

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 128);
  if (!reason) throw new Error("Enter a reason for this top-up");

  const txRef = generateTxRef(companyId);
  await createPendingPayment({ txRef, companyId, amount, note: reason });

  const returnUrl = await absoluteUrl(`/topup/complete?tx_ref=${encodeURIComponent(txRef)}`);

  const [firstName, ...rest] = (company.name || "Client").trim().split(/\s+/);

  const { checkoutUrl } = await initializeTransaction({
    amount,
    currency: "ETB",
    tx_ref: txRef,
    return_url: returnUrl,
    first_name: firstName,
    last_name: rest.join(" ") || undefined,
    title: "Awaj ET Top-up",
    description: "Marketing budget top-up",
  });

  redirect(checkoutUrl);
}
