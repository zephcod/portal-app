import { HandCoins } from "lucide-react";
import { AddBudgetButton } from "@/components/AddBudgetButton";
import { computeCompanyBalance } from "@/lib/balance";
import { money } from "@/lib/domain";

type Status = "owing" | "low" | "credit" | "settled";

/** Balances above 0 but at or under this are flagged amber, not green — running low. */
const LOW_BALANCE_THRESHOLD = 2000;

const STATUS_STYLE: Record<Status, { badge: string; amountColor: string; label: string }> = {
  owing: {
    badge: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    amountColor: "text-red-600 dark:text-red-400",
    label: "Due marketing credit",
  },
  low: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    amountColor: "text-amber-600 dark:text-amber-400",
    label: "Low marketing budget",
  },
  credit: {
    badge: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300",
    amountColor: "text-green-700 dark:text-green-400",
    label: "Available marketing budget",
  },
  settled: {
    badge: "bg-charcoal/10 text-muted",
    amountColor: "",
    label: "Settled",
  },
};

const STATUS_MESSAGE: Record<Status, string> = {
  owing: "Please contact your Awaj account manager and add funds to avoid campaign interruptions.",
  low: "Your marketing budget is running low. Contact your Awaj account manager.",
  credit: "Recent campaign transactions.",
  settled: "No outstanding balance. Your account is fully settled.",
};

/**
 * Lifetime marketing-budget balance, at a glance: deposits − ad spend −
 * additional costs (lib/balance.ts, ported from the leadgen app's
 * per-company account balance). Appwrite-only — no live Meta calls — so
 * it renders as part of Overview's fast tier, not behind "Show top
 * content".
 */
export async function BudgetBalanceCard({
  companyId,
  currency,
}: {
  companyId: string;
  currency: string;
}) {
  const balance = await computeCompanyBalance(companyId);
  const total = balance.total;
  // Ignore sub-unit rounding dust so a balance that nets to ~0 reads as "Settled".
  const status: Status =
    total < -0.5
      ? "owing"
      : total <= 0.5
        ? "settled"
        : total <= LOW_BALANCE_THRESHOLD
          ? "low"
          : "credit";
  const { badge, amountColor, label } = STATUS_STYLE[status];

  // Only worth breaking down when more than one group actually carries a balance.
  const groupBreakdown = balance.byGroup.filter((g) => Math.abs(g.balance) > 0.5);

  return (
    <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap min-w-0 items-center gap-3">
          <AddBudgetButton />
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${badge}`}
          >
            <HandCoins className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
              {label}
            </p>
            <p className={`font-display truncate text-2xl font-bold ${amountColor}`}>
              {money(Math.abs(total), currency)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="max-w-sm min-w-0 text-sm text-muted">{STATUS_MESSAGE[status]}</p>
        </div>
      </div>

      {groupBreakdown.length > 1 && (
        <ul className="mt-4 flex min-w-0 flex-col gap-1.5 border-t border-edge pt-3 text-sm">
          {groupBreakdown.map((g) => (
            <li key={g.parentKey} className="flex min-w-0 items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-muted">{g.parentLabel}</span>
              <span
                className={`shrink-0 font-semibold ${
                  g.balance >= 0
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {g.balance >= 0 ? "+" : "−"}
                {money(Math.abs(g.balance), currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
