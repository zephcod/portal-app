"use client";

import { Clock } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { reschedulePost, type ActionState } from "@/app/(portal)/posts/[id]/actions";

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Inline reschedule for a queued post (adapted from the scheduler's RescheduleForm). */
export default function RescheduleForm({
  itemId,
  platform,
  currentUnix,
}: {
  itemId: string;
  platform: "fb" | "ig";
  currentUnix: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reschedulePost,
    null
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 font-mono text-[11px] text-muted underline hover:text-amber"
      >
        <Clock className="h-3 w-3" />
        Reschedule
      </button>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const form = e.currentTarget;
        const dt = form.elements.namedItem("when") as HTMLInputElement | null;
        const hidden = form.elements.namedItem("scheduledAt") as HTMLInputElement | null;
        if (hidden && dt?.value) {
          hidden.value = String(Math.floor(new Date(dt.value).getTime() / 1000));
        }
      }}
      className="flex w-full flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="platform" value={platform} />
      <input type="hidden" name="scheduledAt" />
      <input
        type="datetime-local"
        name="when"
        required
        aria-label="New date and time (your local time)"
        min={toLocalInputValue(new Date(Date.now() + 15 * 60 * 1000))}
        max={toLocalInputValue(new Date(Date.now() + 75 * 24 * 60 * 60 * 1000))}
        defaultValue={toLocalInputValue(new Date(currentUnix * 1000))}
        className="rounded-md border border-edge bg-input px-2 py-1.5 text-xs focus:outline-2 focus:outline-gold"
      />
      <span className="font-mono text-[10px] text-muted">your local time</span>
      <button
        disabled={pending}
        className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-gold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className="font-mono text-[11px] text-muted underline disabled:opacity-50"
      >
        Cancel
      </button>
      {state && !state.ok && (
        <span className="w-full font-mono text-[11px] text-red-700">{state.message}</span>
      )}
    </form>
  );
}
