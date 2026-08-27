"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import SubmitButton from "@/components/SubmitButton";
import { startTopUp } from "@/app/(portal)/topup/actions";

const MIN_AMOUNT_ETB = 3000;
const MAX_AMOUNT_ETB = 500000;

/**
 * Modal for the "+ Add Budget" trigger on Overview (components/BudgetBalanceCard.tsx),
 * opened via a `?topup=1` URL param rather than a dedicated /topup page — closing it
 * just drops that param, preserving whatever else is in the query string (e.g. `range`).
 * Submitting redirects the whole tab to Chapa's hosted checkout (startTopUp), same as
 * the standalone page did.
 */
export function TopUpModal({ currency }: { currency: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get("topup") === "1";

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("topup");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  if (currency !== "ETB") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-edge bg-card p-4 shadow-lg sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Top up marketing budget</h2>
            <p className="mt-1 text-sm text-muted">
              You&apos;ll be redirected to Chapa&apos;s secure checkout to complete payment.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="shrink-0 rounded-md p-1 text-muted transition hover:bg-app hover:text-fg"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form action={startTopUp} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Amount (ETB)</span>
            <input
              type="number"
              name="amount"
              min={MIN_AMOUNT_ETB}
              max={MAX_AMOUNT_ETB}
              step="0.01"
              required
              autoFocus
              placeholder={`${MIN_AMOUNT_ETB.toLocaleString("en-US")} – ${MAX_AMOUNT_ETB.toLocaleString("en-US")}`}
              className="w-full rounded-md border border-edge bg-input px-3 py-2 text-sm text-fg focus:border-gold focus:outline-none"
            />
            <span className="mt-1.5 block text-xs text-muted">
              Min {MIN_AMOUNT_ETB.toLocaleString("en-US")} ETB, max {MAX_AMOUNT_ETB.toLocaleString("en-US")} ETB.
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Reason</span>
            <input
              type="text"
              name="reason"
              required
              maxLength={128}
              placeholder="e.g. Meskerem Facebook Ads"
              className="w-full rounded-md border border-edge bg-input px-3 py-2 text-sm text-fg focus:border-gold focus:outline-none"
            />
          </label>

          <SubmitButton
            pendingLabel="Redirecting…"
            className="mt-4 w-full rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-card transition hover:bg-green-600 disabled:cursor-wait disabled:opacity-80 dark:bg-green-500 dark:hover:bg-green-400"
          >
            Continue to payment
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
