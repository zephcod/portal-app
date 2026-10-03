"use client";

import { useEffect, useRef, useState } from "react";
// Type-only import: lib/insights is server code, but types are erased.
import type { MetricSeries } from "@/lib/insights";

/** "2026-10-03" → "Oct 3" (UTC so the label never shifts a day). */
function fmtDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Daily bar chart for the Insights cards. Each bar's date + value shows
 * in a tooltip on hover, keyboard focus, or touch — tap a bar, or drag
 * a finger across the chart to scrub (the native `title` tooltip this
 * replaces never appears on touch screens). Every column is a full-height
 * hit target, so near-zero bars are just as easy to tap.
 */
export default function BarChart({ series }: { series: MetricSeries }) {
  const [active, setActive] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const points = series.points;
  const n = points.length;
  const max = Math.max(...points.map((p) => p.value), 1);

  // Touch: a tap anywhere outside the chart dismisses the tooltip
  // (mobile Safari doesn't focus buttons on tap, so blur can't be relied on).
  useEffect(() => {
    if (active === null) return;
    const onDown = (e: PointerEvent) => {
      if (!plotRef.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  /** Bar index under a pointer's x position. */
  function indexAt(clientX: number): number | null {
    const el = plotRef.current;
    if (!el || n === 0) return null;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width - 1);
    return Math.floor((x / rect.width) * n);
  }

  const activePoint = active !== null ? points[active] : undefined;
  // Keep the tooltip inside the card near either edge.
  const pos = active !== null ? (active + 0.5) / n : 0.5;
  const align =
    pos < 0.2 ? "left-0" : pos > 0.8 ? "right-0" : "-translate-x-1/2";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
          {series.title}
        </span>
        <span className="font-display text-lg font-bold">
          {series.total.toLocaleString()}
        </span>
      </div>

      <div
        ref={plotRef}
        className="relative mt-2 flex h-24 touch-pan-y items-end gap-px select-none"
        onPointerDown={(e) => setActive(indexAt(e.clientX))}
        onPointerMove={(e) => {
          // Mouse: follow hover. Touch/pen: scrub while the finger is down.
          if (e.pointerType === "mouse" || e.buttons > 0) setActive(indexAt(e.clientX));
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
      >
        {points.map((p, i) => (
          <button
            key={p.date}
            type="button"
            aria-label={`${fmtDay(p.date)}: ${p.value.toLocaleString()}`}
            onFocus={() => setActive(i)}
            onBlur={() => setActive((cur) => (cur === i ? null : cur))}
            className="flex h-full min-w-0 flex-1 items-end focus:outline-none"
          >
            <span
              className={`block w-full rounded-t-sm transition-colors ${
                active === i ? "bg-amber" : "bg-gold/70"
              }`}
              style={{ height: `${Math.max((p.value / max) * 100, 2)}%` }}
            />
          </button>
        ))}

        {activePoint && (
          <div
            role="status"
            className={`pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-md bg-navy px-2 py-1 font-mono text-[11px] whitespace-nowrap text-white shadow-md ${align}`}
            style={align === "-translate-x-1/2" ? { left: `${pos * 100}%` } : undefined}
          >
            <span className="text-white/70">{fmtDay(activePoint.date)}</span>{" "}
            <span className="font-semibold text-gold">{activePoint.value.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted">
        <span>{points[0]?.date.slice(5)}</span>
        <span>{points.at(-1)?.date.slice(5)}</span>
      </div>
    </div>
  );
}
