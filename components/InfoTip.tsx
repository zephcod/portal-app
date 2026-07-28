"use client";

import { Info } from "lucide-react";
import { useState } from "react";

/**
 * Plain-language explainer for a jargon-y metric label (CPL, CPR, reach,
 * engagement, …). Tap/click toggles a small popover — works the same on
 * touch and with a mouse, unlike a hover-only tooltip which is unusable on
 * a phone. Closes on blur so it doesn't linger after tapping elsewhere.
 */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        onBlur={() => setOpen(false)}
        aria-label="What does this metric mean?"
        aria-expanded={open}
        className="text-muted/60 transition-colors hover:text-amber"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-1.5 w-44 -translate-x-1/2 rounded-md border border-edge bg-card px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-fg shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
