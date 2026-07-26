export function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-warmgray">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-charcoal">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-warmgray">{sub}</p>}
    </div>
  );
}
