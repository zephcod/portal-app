"use client";

import { setPostStatus } from "@/app/(portal)/posts/[id]/actions";

/**
 * Client sign-off on a queued post — pending ↔ approved only (adapted
 * from the scheduler's team StatusSelect). Both statuses publish on
 * schedule; "approved" just tells the Awaj team the client is happy.
 */
export default function PostStatusSelect({
  itemId,
  platform,
  currentStatus,
}: {
  itemId: string;
  platform: "fb" | "ig";
  currentStatus: "pending" | "approved";
}) {
  return (
    <form action={setPostStatus} className="flex items-center gap-1">
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="platform" value={platform} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Post status"
        className="rounded-md border border-edge bg-input px-1.5 py-1 font-mono text-[11px] focus:outline-2 focus:outline-gold"
      >
        <option value="pending">Pending approval</option>
        <option value="approved">Approved</option>
      </select>
    </form>
  );
}
