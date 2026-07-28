import { InfoTip } from "@/components/InfoTip";

/**
 * Stat-tile contract: label, big value, and a signed delta vs a named
 * prior period. `deltaGoodDirection` lets a metric where "down is good"
 * (e.g. cost-per-lead) still color correctly — defaults to "up is good".
 * `tip` adds a plain-language explainer next to the label for jargon-y
 * metrics that non-marketer clients may not recognize.
 */
export function StatTile({
  label,
  value,
  delta,
  periodLabel,
  deltaGoodDirection = "up",
  unavailable,
  tip,
}: {
  label: string;
  value: string;
  /** % change vs the prior period, or null when there's no baseline to compare. */
  delta: number | null;
  periodLabel: string;
  deltaGoodDirection?: "up" | "down";
  /** Set when the metric couldn't be fetched at all — shows "—" instead of a
   *  misleading zero, with a short reason instead of the period comparison. */
  unavailable?: string;
  /** One-line plain-language explanation, shown via a tap-to-open info icon. */
  tip?: string;
}) {
  const dir = delta === null || delta === 0 ? null : delta > 0 ? "up" : "down";
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
      <p className="flex items-center gap-1 font-mono text-[10px] font-medium tracking-wide text-muted uppercase">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-fg">
        {unavailable ? "—" : value}
      </p>
      <p className="mt-1 text-xs">
        {unavailable ? (
          <span className="text-muted">{unavailable}</span>
        ) : delta === null ? (
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
    </div>
  );
}
