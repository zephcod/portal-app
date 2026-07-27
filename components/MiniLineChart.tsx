"use client";

/**
 * Single-series line + area chart. One axis, one hue — a single series
 * needs no legend box, the title names it. Pure SVG, hover crosshair.
 */
import { useState } from "react";

export type SeriesPoint = { date: string; value: number };

const W = 400;
const H = 150;
const PAD = { top: 10, right: 8, bottom: 20, left: 40 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

export function MiniLineChart({
  title,
  points,
  color,
}: {
  title: string;
  points: SeriesPoint[];
  color: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const total = points.reduce((s, p) => s + p.value, 0);

  if (points.length === 0) {
    return (
      <div>
        <span className="font-mono text-[11px] tracking-[0.1em] text-warmgray uppercase">
          {title}
        </span>
        <div className="mt-1 flex h-32 items-center justify-center text-xs text-warmgray">
          No data for this period yet.
        </div>
      </div>
    );
  }

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const slot = iw / Math.max(points.length - 1, 1);
  const x = (i: number) => PAD.left + slot * i;
  const y = (v: number) => PAD.top + ih - (v / max) * ih;

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`)
    .join(" ");
  const area = `${line} L${x(points.length - 1)},${PAD.top + ih} L${x(0)},${PAD.top + ih} Z`;

  const tickEvery = Math.max(1, Math.ceil(points.length / 5));
  const h = hover !== null ? points[hover] : null;
  const last = points[points.length - 1];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] tracking-[0.1em] text-warmgray uppercase">
          {title}
        </span>
        <span className="font-display text-sm font-semibold text-charcoal">
          {total.toLocaleString()}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full"
        role="img"
        aria-label={`${title} over time`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((g) => {
          const yy = PAD.top + ih - g * ih;
          return (
            <line
              key={g}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yy}
              y2={yy}
              stroke="rgba(43,43,51,0.08)"
              strokeWidth={1}
            />
          );
        })}
        <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" fontSize={9} fill="#6b6873">
          {max.toLocaleString()}
        </text>
        <text x={PAD.left - 6} y={PAD.top + ih + 4} textAnchor="end" fontSize={9} fill="#6b6873">
          0
        </text>

        <path d={area} fill={color} opacity={0.1} stroke="none" />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(points.length - 1)}
          cy={y(last.value)}
          r={4}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
        />

        {points.map((p, i) =>
          i % tickEvery === 0 ? (
            <text
              key={`t-${p.date}`}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              fill="#6b6873"
            >
              {p.date.slice(5)}
            </text>
          ) : null
        )}

        {points.map((p, i) => (
          <rect
            key={`h-${p.date}`}
            x={x(i) - slot / 2}
            y={PAD.top}
            width={slot}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + ih}
              stroke="rgba(43,43,51,0.25)"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover)}
              cy={y(points[hover].value)}
              r={4}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
            />
          </>
        )}
      </svg>
      <div className="mt-1 text-right font-mono text-[10px] text-warmgray">
        {h ? `${h.date} · ${h.value.toLocaleString()}` : "Hover the chart for daily detail"}
      </div>
    </div>
  );
}
