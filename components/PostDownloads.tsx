"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";

/**
 * Download + copy-caption controls for a planned post (the client's page
 * isn't linked, so they post it by hand — see lib/planned.ts).
 */
export default function PostDownloads({
  downloads,
  caption,
}: {
  downloads: { url: string; label: string }[];
  caption: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the caption
      // is still visible above for manual selection.
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-edge bg-card px-3 py-1.5 text-xs font-semibold text-fg hover:border-gold hover:text-amber";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {downloads.map((d) => (
        <a key={d.url} href={d.url} download className={btn}>
          <Download className="h-3.5 w-3.5" />
          {d.label}
        </a>
      ))}
      {caption && (
        <button type="button" onClick={copy} className={btn}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy caption"}
        </button>
      )}
    </div>
  );
}
