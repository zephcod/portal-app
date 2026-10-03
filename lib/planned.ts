/**
 * Planned posts — content for companies that haven't linked a Facebook
 * page yet. The scheduler stages them in the same fb_queue/ig_queue,
 * keyed by `co:<companyId>` instead of a page id, with statuses that its
 * publishers never pick up (see the scheduler's lib/queueStatus.ts and
 * lib/promote.ts). Clients download and post them manually; once the
 * company links its page, still-future ones move to live auto-publishing.
 */

export function plannedKey(companyId: string): string {
  return `co:${companyId}`;
}

/** Statuses of an unlinked company's posts. */
export function isPlannedStatus(status: string): boolean {
  return status === "planned" || status === "planned_ok" || status === "posted_manually";
}

/** Status an item drops back to after a client reschedule/edit (needs re-approval). */
export type ResetStatus = "pending" | "planned";

export function resetStatusFor(current: string): ResetStatus {
  return isPlannedStatus(current) ? "planned" : "pending";
}
