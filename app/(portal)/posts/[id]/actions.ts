"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ClientSession } from "@/lib/clientsession";
import { createPostComment } from "@/lib/data";
import { env } from "@/lib/env";
import { editFbItemCaption, getFbQueueItem, rescheduleFbItem, setFbItemStatus } from "@/lib/fbqueue";
import { fmtDateTime } from "@/lib/format";
import { editIgItemCaption, getIgQueueItem, rescheduleIgItem, setIgItemStatus } from "@/lib/igqueue";
import { validateScheduleTime } from "@/lib/schedule";
import { getClientTarget } from "@/lib/clientpage";
import { isPlannedStatus, resetStatusFor } from "@/lib/planned";
import { getSession } from "@/lib/server-session";
import { notifyNewPostComment, notifyPostChange } from "@/lib/telegram";

/**
 * Absolute URL of the post detail page. Prefers APP_URL (set in .env) so
 * links are stable regardless of the host the request came in on; falls
 * back to the request's own host/proto if APP_URL isn't configured.
 */
async function postUrl(postId: string, postSource: string): Promise<string> {
  let origin = env.appUrl();
  if (!origin) {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3002";
    const proto =
      h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    origin = `${proto}://${host}`;
  }
  return `${origin}/posts/${postId}?source=${postSource}`;
}

export async function submitPostComment(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const companyId = session.cid;
  if (!companyId) throw new Error("Missing company");

  const postId = String(formData.get("postId") ?? "").trim();
  const postSource = String(formData.get("postSource") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!postId || !postSource || !body) throw new Error("Comment is required");

  const title = (await postUrl(postId, postSource)).slice(0, 256);

  await createPostComment({
    companyId,
    postId,
    postSource,
    title,
    body: body.slice(0, 4096),
  });

  // Ping the team on Telegram — best-effort, never blocks the client.
  await notifyNewPostComment({
    companyName: session.name || companyId,
    postId,
    body,
  });

  revalidatePath(`/posts/${postId}`);
}

// ── Queued-post controls (status, reschedule, caption, posted) ──────
// Ported from the scheduler app's /scheduled actions, narrowed for
// clients: ownership is checked against the client's own queue keys
// (lib/clientpage.ts — real page and/or planned `co:` key), only
// pending/approved (live) or planned/planned_ok (unlinked) items can be
// changed, and status is limited to the approval sign-off — plus "I
// posted this" for planned posts the client publishes by hand.

export type ActionState = {
  ok: boolean;
  message: string;
} | null;

type QueuedRef = {
  session: ClientSession;
  platform: "fb" | "ig";
  id: string;
  status: string;
  scheduledAt: number;
};

const EDITABLE = new Set(["pending", "approved", "planned", "planned_ok"]);

/** Session + ownership + editable-state guard. Returns an error string on failure. */
async function loadEditable(formData: FormData): Promise<QueuedRef | string> {
  const ctx = await getClientTarget();
  if (!ctx) return "Your session has expired. Please log in again.";
  const id = String(formData.get("id") ?? "");
  const platform = String(formData.get("platform") ?? "");
  if (!id || (platform !== "fb" && platform !== "ig")) return "Invalid request.";
  const item =
    platform === "fb"
      ? await getFbQueueItem(ctx.pageKeys, id)
      : await getIgQueueItem(ctx.pageKeys, id);
  if (!item) return "Post not found.";
  if (!EDITABLE.has(item.status)) {
    return item.status === "posted_manually"
      ? "You've already marked this post as posted."
      : "This post is already publishing and can no longer be changed.";
  }
  return { session: ctx.session, platform, id, status: item.status, scheduledAt: item.scheduledAt };
}

function revalidatePost(id: string) {
  revalidatePath(`/posts/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/");
}

async function notify(ref: QueuedRef, change: string) {
  const source = ref.platform === "fb" ? "fb-queue" : "ig-queue";
  await notifyPostChange({
    companyName: ref.session.name || ref.session.cid,
    change: `${ref.platform === "fb" ? "Facebook" : "Instagram"}${
      isPlannedStatus(ref.status) ? " (planned, page not linked)" : ""
    }: ${change}`,
    url: await postUrl(ref.id, source),
  });
}

export async function setPostStatus(formData: FormData): Promise<void> {
  const ref = await loadEditable(formData);
  if (typeof ref === "string") return;
  const choice = String(formData.get("status") ?? "");
  if (choice !== "pending" && choice !== "approved") return;
  // Same two-way toggle for both families; planned posts map onto
  // planned/planned_ok so the publishers never see them.
  const planned = isPlannedStatus(ref.status);
  const status = planned ? (choice === "approved" ? "planned_ok" : "planned") : choice;
  if (ref.platform === "fb") await setFbItemStatus(ref.id, status);
  else await setIgItemStatus(ref.id, status);
  await notify(ref, choice === "approved" ? "Approved" : "Moved back to pending");
  revalidatePost(ref.id);
}

export async function reschedulePost(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ref = await loadEditable(formData);
  if (typeof ref === "string") return { ok: false, message: ref };
  const scheduledAt = Number(formData.get("scheduledAt"));
  if (!Number.isFinite(scheduledAt)) {
    return { ok: false, message: "Invalid reschedule request." };
  }
  const problem = validateScheduleTime(scheduledAt);
  if (problem) return { ok: false, message: problem };
  try {
    const reset = resetStatusFor(ref.status);
    if (ref.platform === "fb") await rescheduleFbItem(ref.id, scheduledAt, reset);
    else await rescheduleIgItem(ref.id, scheduledAt, reset);
  } catch {
    return { ok: false, message: "Couldn't reschedule — please try again." };
  }
  await notify(ref, `Rescheduled to ${fmtDateTime(scheduledAt)} EAT`);
  revalidatePost(ref.id);
  return { ok: true, message: "Post rescheduled." };
}

export async function editPostCaption(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ref = await loadEditable(formData);
  if (typeof ref === "string") return { ok: false, message: ref };
  const caption = String(formData.get("caption") ?? "").trim();
  if (!caption) return { ok: false, message: "Caption can't be empty." };
  try {
    const reset = resetStatusFor(ref.status);
    if (ref.platform === "fb") await editFbItemCaption(ref.id, caption, reset);
    else await editIgItemCaption(ref.id, caption, reset);
  } catch {
    return { ok: false, message: "Couldn't save — please try again." };
  }
  const excerpt = caption.length > 300 ? `${caption.slice(0, 300)}…` : caption;
  await notify(ref, `Caption edited:\n${excerpt}`);
  revalidatePost(ref.id);
  return { ok: true, message: "Caption updated." };
}

/**
 * "I posted this" — the client published a planned post by hand (their
 * page isn't linked, so nothing auto-publishes). Only once it's due, so
 * it can't be confused with an upcoming post. Terminal: the scheduler's
 * promotion never touches posted_manually items.
 */
export async function markPostedManually(formData: FormData): Promise<void> {
  const ref = await loadEditable(formData);
  if (typeof ref === "string") return;
  if (!isPlannedStatus(ref.status)) return;
  if (ref.scheduledAt * 1000 > Date.now()) return;
  if (ref.platform === "fb") await setFbItemStatus(ref.id, "posted_manually");
  else await setIgItemStatus(ref.id, "posted_manually");
  await notify(ref, "Marked as posted by the client");
  revalidatePost(ref.id);
}
