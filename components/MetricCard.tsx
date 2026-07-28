import { InfoTip } from "@/components/InfoTip";

/**
 * `delta`/`periodLabel` mirror StatTile's period-over-period comparison —
 * pass both to show "+12% vs prior 30 days" under the value instead of (or
 * alongside) `sub`. `deltaGoodDirection` lets cost metrics (CPL, CPR, CPC —
 * where a drop is the win) still color correctly; defaults to "up is good".
 * `tip` adds a plain-language explainer next to the label for jargon-y
 * metrics (CPL, CPR, reach, …) that non-marketer clients may not recognize.
 */
export function MetricCard({
  label,
  value,
  sub,
  delta,
  periodLabel,
  deltaGoodDirection = "up",
  tip,
}: {
  label: string;
  value: string;
  sub?: string;
  /** % change vs the prior period. Omit (or pass null) when there's no comparison to show. */
  delta?: number | null;
  /** Required alongside `delta` — e.g. "prior 30 days". */
  periodLabel?: string;
  deltaGoodDirection?: "up" | "down";
  /** One-line plain-language explanation, shown via a tap-to-open info icon. */
  tip?: string;
}) {
  const hasDelta = delta !== undefined && periodLabel !== undefined;
  const dir = delta === null || delta === 0 ? null : delta && delta > 0 ? "up" : "down";
  const isGood = dir === null ? null : dir === deltaGoodDirection;
  const color =
    isGood === null
      ? "text-muted"
      : isGood
        ? "text-green-700 dark:text-green-400"
        : "text-red-600 dark:text-red-400";
  const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "";

  return (
    <div className="rounded-xl border border-edge bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-fg">
        {value}
      </p>
      {hasDelta ? (
        <p className="mt-0.5 text-xs">
          {delta === null ? (
            <span className="text-muted">vs {periodLabel}</span>
          ) : (
            <>
              <span className={`font-semibold ${color}`}>
                {arrow} {Math.abs(delta).toFixed(0)}%
              </span>{" "}
              <span className="text-muted">vs {periodLabel}</span>
            </>
          )}
        </p>
      ) : (
        sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>
      )}
    </div>
  );
}
