"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Reveals a Graph-dependent section by adding `?top=1` to the current
 * URL (merged with whatever params are already there, e.g. `range` or
 * `m`) — the section itself only fetches from Meta once this param is
 * present. Any other navigation on the page (range/month change, a
 * fresh visit) replaces the query string with its own params and drops
 * `top`, so the reveal is deliberately one-shot, not sticky.
 */
export function ShowTopContentButton({ label }: { label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const reveal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("top", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <button
      type="button"
      onClick={reveal}
      disabled={isPending}
      className="inline-flex shrink-0 items-center gap-2 rounded-md border border-edge bg-card px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-gold disabled:cursor-wait disabled:opacity-70"
    >
      {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {isPending ? "Loading…" : label}
    </button>
  );
}
