"use client";

import { Pencil } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { editPostCaption, type ActionState } from "@/app/(portal)/posts/[id]/actions";

/**
 * Inline caption editor for a queued post (adapted from the scheduler's
 * EditQueuedPostForm, caption only — media changes go through remarks).
 * Saving resets the post to "pending", so an approved post needs
 * re-approving after an edit.
 */
export default function EditCaptionForm({
  itemId,
  platform,
  currentCaption,
}: {
  itemId: string;
  platform: "fb" | "ig";
  currentCaption: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    editPostCaption,
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
        <Pencil className="h-3 w-3" />
        Edit caption
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-1 flex w-full flex-col gap-2 border-t border-edge pt-3"
    >
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="platform" value={platform} />
      <textarea
        name="caption"
        defaultValue={currentCaption}
        rows={6}
        required
        maxLength={platform === "ig" ? 2200 : 63000}
        className="w-full resize-y rounded-md border border-edge bg-input px-3 py-2 text-sm focus:outline-2 focus:outline-gold"
      />
      <p className="font-mono text-[10px] text-muted">
        Saving moves the post back to pending approval.
      </p>
      <div className="flex flex-wrap items-center gap-3">
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
      </div>
    </form>
  );
}
