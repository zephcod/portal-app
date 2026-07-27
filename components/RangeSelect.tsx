"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RANGE_PRESETS } from "@/lib/domain";
import { Select } from "./ui/select";

export function RangeSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("range") ?? "30d";
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <div className="w-40">
        <Select
          value={current}
          onValueChange={(v) =>
            startTransition(() => {
              router.push(`${pathname}?range=${v}`);
            })
          }
          options={RANGE_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
          className={isPending ? "pointer-events-none opacity-60" : undefined}
        />
      </div>
      {isPending && (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-muted"
          aria-label="Loading"
        />
      )}
    </div>
  );
}
