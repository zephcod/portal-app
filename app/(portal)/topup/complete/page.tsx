import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle, TriangleAlert } from "lucide-react";
import { getSession } from "@/lib/server-session";
import { verifyTransaction } from "@/lib/chapa";
import { fulfillPayment, getPaymentByTxRef } from "@/lib/payments";
import { money } from "@/lib/domain";

export const dynamic = "force-dynamic";

type Outcome =
  | { kind: "success"; amount: number }
  | { kind: "pending" }
  | { kind: "failed" }
  | { kind: "error" };

export default async function TopUpCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ tx_ref?: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { tx_ref: txRef } = await searchParams;
  if (!txRef) notFound();

  const payment = await getPaymentByTxRef(txRef);
  // Ownership check: a tx_ref belongs to exactly one company. Without this,
  // a guessed or shared tx_ref in the URL could leak another company's
  // payment status. Crediting itself is unaffected — fulfillPayment always
  // credits the payment's own companyId regardless of who's viewing.
  if (!payment || payment.companyId !== session.cid) notFound();

  let outcome: Outcome;
  try {
    const verified = await verifyTransaction(txRef);
    if (verified.status === "pending") {
      outcome = { kind: "pending" };
    } else if (verified.status === "failed") {
      outcome = { kind: "failed" };
    } else {
      const result = await fulfillPayment(verified);
      outcome =
        result === "credited" || result === "already-credited"
          ? { kind: "success", amount: payment.amount }
          : { kind: "error" };
    }
  } catch {
    outcome = { kind: "error" };
  }

  const content = {
    success: {
      icon: <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden />,
      title: "Payment received",
      body:
        outcome.kind === "success"
          ? `${money(outcome.amount, "ETB")} has been added to your marketing budget.`
          : "",
    },
    pending: {
      icon: <Clock className="h-8 w-8 text-amber-600" aria-hidden />,
      title: "Payment processing",
      body: "We haven't received confirmation from Chapa yet. This page will reflect your balance once payment clears — refresh in a moment.",
    },
    failed: {
      icon: <XCircle className="h-8 w-8 text-red-600" aria-hidden />,
      title: "Payment not completed",
      body: "This payment didn't go through. No funds were added.",
    },
    error: {
      icon: <TriangleAlert className="h-8 w-8 text-amber-600" aria-hidden />,
      title: "Couldn't confirm payment",
      body: "We couldn't reach Chapa to confirm this payment right now. If you completed checkout, your balance will update shortly — check back in a few minutes.",
    },
  }[outcome.kind];

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-edge bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-charcoal/10">
          {content.icon}
        </div>
        <h1 className="font-display mt-4 text-xl font-bold">{content.title}</h1>
        <p className="mt-2 text-sm text-muted">{content.body}</p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/"
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-card transition hover:bg-green-600 dark:bg-green-500 dark:hover:bg-green-400"
          >
            Back to Overview
          </Link>
          {outcome.kind === "failed" && (
            <Link
              href="/?topup=1"
              className="rounded-md border border-edge px-4 py-2 text-sm font-medium text-fg transition hover:border-gold/50"
            >
              Try again
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
