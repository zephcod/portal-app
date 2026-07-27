/**
 * Stat-tile contract: label, big value, and a signed delta vs a named
 * prior period. `deltaGoodDirection` lets a metric where "down is good"
 * (e.g. cost-per-lead) still color correctly — defaults to "up is good".
 */
export function StatTile({
  label,
  value,
  delta,
  periodLabel,
  deltaGoodDirection = "up",
  unavailable,
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
}) {
  const dir = delta === null || delta === 0 ? null : delta > 0 ? "up" : "down";
  const isGood = dir === null ? null : dir === deltaGoodDirection;
  const color =
    isGood === null ? "text-warmgray" : isGood ? "text-green-700" : "text-red-600";
  const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "";

  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <p className="font-mono text-[10px] font-medium tracking-wide text-warmgray uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-charcoal">
        {unavailable ? "—" : value}
      </p>
      <p className="mt-1 text-xs">
        {unavailable ? (
          <span className="text-warmgray">{unavailable}</span>
        ) : delta === null ? (
          <span className="text-warmgray">vs {periodLabel}</span>
        ) : (
          <>
            <span className={`font-semibold ${color}`}>
              {arrow} {Math.abs(delta).toFixed(0)}%
            </span>{" "}
            <span className="text-warmgray">vs {periodLabel}</span>
          </>
        )}
      </p>
    </div>
  );
}
