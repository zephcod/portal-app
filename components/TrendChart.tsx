"use client";

/**
 * Dependency-free composed chart: spend as bars (left axis), clicks and
 * leads as lines (right axis). Pure SVG with a hover tooltip.
 */
import { useState } from "react";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  spend: number;
  clicks: number;
  leads: number;
}

const W = 900;
const H = 280;
const PAD = { top: 16, right: 48, bottom: 28, left: 56 };

const COLORS = {
  spend: "#f0a93b",
  clicks: "#2b2b33",
  leads: "#c97d1e",
};

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

export function TrendChart({
  data,
  currency,
}: {
  data: TrendPoint[];
  currency: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-warmgray">
        No data for this period yet.
      </div>
    );
  }

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const maxSpend = niceMax(Math.max(...data.map((d) => d.spend)));
  const maxCount = niceMax(Math.max(...data.map((d) => Math.max(d.clicks, d.leads))));

  const slot = iw / data.length;
  const barW = Math.min(28, slot * 0.6);
  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const ySpend = (v: number) => PAD.top + ih - (v / maxSpend) * ih;
  const yCount = (v: number) => PAD.top + ih - (v / maxCount) * ih;

  const line = (key: "clicks" | "leads") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${yCount(d[key])}`).join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const tickEvery = Math.max(1, Math.ceil(data.length / 10));
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Daily spend, clicks and leads chart"
        onMouseLeave={() => setHover(null)}
      >
        {/* grid + left (spend) and right (count) axis labels */}
        {gridLines.map((g) => {
          const y = PAD.top + ih - g * ih;
          return (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="rgba(43,43,51,0.08)"
              />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#6b6873">
                {Math.round(maxSpend * g).toLocaleString()}
              </text>
              <text x={W - PAD.right + 8} y={y + 4} fontSize={10} fill="#6b6873">
                {Math.round(maxCount * g).toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* spend bars */}
        {data.map((d, i) => (
          <rect
            key={d.date}
            x={x(i) - barW / 2}
            y={ySpend(d.spend)}
            width={barW}
            height={PAD.top + ih - ySpend(d.spend)}
            rx={2}
            fill={COLORS.spend}
            opacity={hover === null || hover === i ? 0.9 : 0.35}
          />
        ))}

        {/* clicks + leads lines */}
        <path d={line("clicks")} fill="none" stroke={COLORS.clicks} strokeWidth={2} />
        <path d={line("leads")} fill="none" stroke={COLORS.leads} strokeWidth={2} />

        {/* x-axis date labels */}
        {data.map((d, i) =>
          i % tickEvery === 0 ? (
            <text
              key={d.date}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#6b6873"
            >
              {d.date.slice(5)}
            </text>
          ) : null
        )}

        {/* hover capture + marker */}
        {data.map((d, i) => (
          <rect
            key={`h-${d.date}`}
            x={PAD.left + slot * i}
            y={PAD.top}
            width={slot}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {h && hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + ih}
            stroke="rgba(43,43,51,0.25)"
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {/* tooltip / legend row */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4">
          {(
            [
              ["spend", "Spend"],
              ["clicks", "Clicks"],
              ["leads", "Leads"],
            ] as const
          ).map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-1.5 text-warmgray">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: COLORS[key] }}
              />
              {label}
            </span>
          ))}
        </div>
        <div className="font-mono text-warmgray">
          {h
            ? `${h.date} · ${currency} ${h.spend.toLocaleString()} · ${h.clicks.toLocaleString()} clicks · ${h.leads.toLocaleString()} leads`
            : "Hover the chart for daily detail"}
        </div>
      </div>
    </div>
  );
}
