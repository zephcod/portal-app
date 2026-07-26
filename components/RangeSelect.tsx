"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGE_PRESETS } from "@/lib/domain";
import { Select } from "./ui/select";

export function RangeSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("range") ?? "30d";

  return (
    <div className="w-40">
      <Select
        value={current}
        onValueChange={(v) => router.push(`${pathname}?range=${v}`)}
        options={RANGE_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
      />
    </div>
  );
}
