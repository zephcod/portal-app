"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Opens the top-up modal (?topup=1) — a button instead of a plain Link so
 * the wait for Overview's re-render (session/company/balance lookups) has
 * a visible pending state instead of the click feeling unresponsive.
 */
export function AddBudgetButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const open = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("topup", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={isPending}
      className="shrink-0 rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-card transition hover:bg-green-600 disabled:cursor-wait disabled:opacity-80 dark:bg-green-500 dark:hover:bg-green-400"
    >
      {isPending ? (
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading…
        </span>
      ) : (
        "+ Add Budget"
      )}
    </button>
  );
}
