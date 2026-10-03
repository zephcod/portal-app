import { ArrowUpRight, ChevronLeft, Heart, MessageCircle, Repeat2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditCaptionForm from "@/components/EditCaptionForm";
import { IssueStatusChip } from "@/components/IssueStatusChip";
import { PlatformIcon } from "@/components/PlatformIcon";
import PostDownloads from "@/components/PostDownloads";
import PostStatusSelect from "@/components/PostStatusSelect";
import RescheduleForm from "@/components/RescheduleForm";
import SubmitButton from "@/components/SubmitButton";
import { getClientTarget } from "@/lib/clientpage";
import { getPostComments } from "@/lib/data";
import { getFbQueueItem } from "@/lib/fbqueue";
import { getPublishedPost, getScheduledPost } from "@/lib/facebook";
import { fmtDateTime, relativeFromNow } from "@/lib/format";
import { getIgQueueItem } from "@/lib/igqueue";
import { getIgMedia } from "@/lib/instagram";
import { isPlannedStatus } from "@/lib/planned";
import { mediaDownloadUrl, mediaUrl } from "@/lib/storage";
import { markPostedManually, submitPostComment } from "./actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-edge bg-input px-3 py-2 text-sm text-fg focus:border-gold focus:outline-none";

type Source =
  | "fb-scheduled"
  | "fb-queue"
  | "fb-published"
  | "ig-queue"
  | "ig-published";

/** Queue statuses a client can open — live upcoming + planned (unlinked page). */
const CLIENT_VISIBLE = new Set([
  "pending",
  "approved",
  "publishing",
  "planned",
  "planned_ok",
  "posted_manually",
]);

function queueStatusLabel(status: string, scheduledAt: number): string {
  if (status === "approved" || status === "planned_ok") {
    return isPlannedStatus(status) && scheduledAt * 1000 <= Date.now()
      ? "Approved · ready to post"
      : "Approved";
  }
  if (status === "publishing") return "Publishing";
  if (status === "posted_manually") return "Posted by you";
  if (status === "planned") {
    return scheduledAt * 1000 <= Date.now() ? "Ready to post" : "Planned";
  }
  return "Scheduled";
}

/** Client-facing toggle value: planned/planned_ok map onto the same pending/approved pair. */
function approvalOf(status: string): "pending" | "approved" {
  return status === "approved" || status === "planned_ok" ? "approved" : "pending";
}

function isSource(v: string | undefined): v is Source {
  return (
    v === "fb-scheduled" ||
    v === "fb-queue" ||
    v === "fb-published" ||
    v === "ig-queue" ||
    v === "ig-published"
  );
}

const EDITABLE = new Set(["pending", "approved", "planned", "planned_ok"]);

/** Download links + "I posted this" eligibility for a planned queue item. */
function manualFor(item: {
  status: string;
  scheduledAt: number;
  mediaRefs?: string;
  mediaType?: string;
}): { downloads: { url: string; label: string }[]; canMarkPosted: boolean } {
  const refs: string[] = item.mediaRefs ? JSON.parse(item.mediaRefs) : [];
  const isVideo = item.mediaType === "video" || item.mediaType === "reel";
  return {
    downloads: refs.map((ref, i) => ({
      url: mediaDownloadUrl(ref),
      label: isVideo ? "Download video" : refs.length > 1 ? `Download image ${i + 1}` : "Download image",
    })),
    canMarkPosted:
      (item.status === "planned" || item.status === "planned_ok") &&
      item.scheduledAt * 1000 <= Date.now(),
  };
}

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { id } = await params;
  const { source } = await searchParams;
  if (!isSource(source)) notFound();

  const ctx = await getClientTarget();
  if (!ctx) notFound();
  // Graph-backed sources need a linked page; queue sources work without one.
  const page = ctx.page;
  if (!page && (source === "fb-scheduled" || source === "fb-published" || source === "ig-published")) {
    notFound();
  }

  let platform: "fb" | "ig";
  let platformName: string;
  let statusLabel: string;
  let when: number; // unix seconds
  let text: string;
  let placeholder: string;
  let image: string | undefined;
  let permalink: string | undefined;
  let permalinkLabel = "View on Facebook";
  let badge: string | undefined;
  /** Set for queue items the client may still change (pending/approved/planned/planned_ok). */
  let editable:
    | { id: string; status: "pending" | "approved"; caption: string }
    | undefined;
  /** Planned post (page not linked): the client downloads and posts it themselves. */
  let manual:
    | { downloads: { url: string; label: string }[]; canMarkPosted: boolean }
    | undefined;
  let engagement:
    | { reactions: number; comments: number; shares?: number }
    | undefined;

  if (source === "fb-scheduled") {
    const post = await getScheduledPost(page!, id);
    if (!post) notFound();
    platform = "fb";
    platformName = "Facebook";
    statusLabel = "Scheduled";
    when = post.scheduled_publish_time;
    text = post.message ?? "";
    placeholder = "(photo post)";
    image = post.full_picture;
  } else if (source === "fb-published") {
    const post = await getPublishedPost(page!, id);
    if (!post) notFound();
    platform = "fb";
    platformName = "Facebook";
    statusLabel = "Published";
    when = Math.floor(new Date(post.created_time).getTime() / 1000);
    text = post.message ?? "";
    placeholder = "(photo post)";
    image = post.full_picture;
    permalink = post.permalink_url;
    engagement = {
      reactions: post.reactions?.summary?.total_count ?? 0,
      comments: post.comments?.summary?.total_count ?? 0,
      shares: post.shares?.count ?? 0,
    };
  } else if (source === "fb-queue") {
    const item = await getFbQueueItem(ctx.pageKeys, id);
    if (!item || !CLIENT_VISIBLE.has(item.status)) notFound();
    platform = "fb";
    platformName = "Facebook";
    statusLabel = queueStatusLabel(item.status, item.scheduledAt);
    if (EDITABLE.has(item.status)) {
      editable = { id: item.$id, status: approvalOf(item.status), caption: item.caption ?? "" };
    }
    if (isPlannedStatus(item.status)) manual = manualFor(item);
    when = item.scheduledAt;
    text = item.caption ?? "";
    placeholder = "(no caption)";
    if (item.mediaType === "image" || item.mediaType === "multiImage") {
      const refs: string[] = item.mediaRefs ? JSON.parse(item.mediaRefs) : [];
      image = refs[0] ? mediaUrl(refs[0]) : undefined;
    }
    badge =
      item.mediaType === "multiImage"
        ? "multi-photo"
        : item.mediaType === "video"
          ? "video"
          : undefined;
  } else if (source === "ig-queue") {
    const item = await getIgQueueItem(ctx.pageKeys, id);
    if (!item || !CLIENT_VISIBLE.has(item.status)) notFound();
    platform = "ig";
    platformName = "Instagram";
    statusLabel = queueStatusLabel(item.status, item.scheduledAt);
    if (EDITABLE.has(item.status)) {
      editable = { id: item.$id, status: approvalOf(item.status), caption: item.caption ?? "" };
    }
    if (isPlannedStatus(item.status)) manual = manualFor(item);
    when = item.scheduledAt;
    text = item.caption ?? "";
    placeholder = "(image post)";
    {
      const refs: string[] = item.mediaRefs ? JSON.parse(item.mediaRefs) : [];
      if ((item.mediaType ?? "image") === "reel") {
        image = item.thumbRef ? mediaUrl(item.thumbRef) : undefined;
      } else {
        image = refs[0] ? mediaUrl(refs[0]) : undefined;
      }
    }
    badge =
      item.mediaType === "carousel"
        ? "carousel"
        : item.mediaType === "reel"
          ? "reel"
          : undefined;
  } else {
    const media = await getIgMedia(page!, id);
    if (!media) notFound();
    platform = "ig";
    platformName = "Instagram";
    statusLabel = "Published";
    when = media.timestamp
      ? Math.floor(new Date(media.timestamp).getTime() / 1000)
      : 0;
    text = media.caption ?? "";
    placeholder = "(image post)";
    image = media.thumbnail_url ?? media.media_url;
    permalink = media.permalink;
    permalinkLabel = "View on Instagram";
    engagement = {
      reactions: media.like_count ?? 0,
      comments: media.comments_count ?? 0,
    };
  }

  const comments = await getPostComments(ctx.session.cid, id);
  const reviewStatus = comments[0]?.status ?? "in_review";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/calendar"
        className="flex items-center gap-1 font-mono text-xs text-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to content hub
      </Link>

      <div className="mt-4 rounded-xl border border-edge bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-amber">
              <PlatformIcon platform={platform} /> {platformName}
            </span>
            <span className="rounded-full bg-navy/5 px-2 py-0.5 font-mono text-[10px] tracking-wide text-muted uppercase">
              {statusLabel}
            </span>
            <IssueStatusChip status={reviewStatus} />
            {badge && (
              <span className="rounded-full bg-navy/5 px-2 py-0.5 font-mono text-[10px] text-muted">
                {badge}
              </span>
            )}
          </div>
          {permalink && (
            <a
              href={permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-[11px] text-amber underline"
            >
              {permalinkLabel}
              <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
        </div>

        <p className="mt-2 font-mono text-xs text-muted">
          {fmtDateTime(when)} EAT · {relativeFromNow(when)}
        </p>

        {/* Same 4:5 media frame + caption stack as the scheduler's /scheduled cards. */}
        <div className="mt-4 flex flex-col gap-3">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="aspect-[4/5] w-full rounded-md border border-edge object-cover"
            />
          )}
          <p className="text-sm whitespace-pre-wrap">
            {text || <span className="text-muted italic">{placeholder}</span>}
          </p>
        </div>

        {editable && (
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-edge pt-3">
            <PostStatusSelect
              key={editable.status}
              itemId={editable.id}
              platform={platform}
              currentStatus={editable.status}
            />
            <RescheduleForm itemId={editable.id} platform={platform} currentUnix={when} />
            <EditCaptionForm
              itemId={editable.id}
              platform={platform}
              currentCaption={editable.caption}
            />
          </div>
        )}

        {manual && (
          <div className="mt-4 rounded-lg border border-dashed border-amber/50 bg-app p-4">
            <p className="text-sm font-semibold">Post this yourself</p>
            <p className="mt-1 text-xs text-muted">
              Your {platformName} page isn&apos;t linked to Awaj ET yet, so this
              post won&apos;t publish automatically. Download the media, copy
              the caption, and post it on its date.
            </p>
            <PostDownloads downloads={manual.downloads} caption={text} />
            {manual.canMarkPosted && (
              <form action={markPostedManually} className="mt-3">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="platform" value={platform} />
                <SubmitButton>I posted this</SubmitButton>
              </form>
            )}
          </div>
        )}

        {engagement && (
          <div className="mt-6 flex gap-6 border-t border-edge pt-4 font-mono text-xs text-muted">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> {engagement.reactions}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" /> {engagement.comments}
            </span>
            {engagement.shares !== undefined && (
              <span className="flex items-center gap-1">
                <Repeat2 className="h-3.5 w-3.5" /> {engagement.shares}
              </span>
            )}
          </div>
        )}
      </div>

      <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <h2 className="font-display mb-4 text-lg font-semibold">Send remarks to Awaj team</h2>
        <form action={submitPostComment} className="space-y-3">
          <input type="hidden" name="postId" value={id} />
          <input type="hidden" name="postSource" value={source} />
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Comment</span>
            <textarea
              name="body"
              required
              rows={4}
              maxLength={4096}
              placeholder="Feedback, change requests, or your approval... Let us know what you think."
              className={inputCls}
            />
          </label>
          <SubmitButton>Submit comment</SubmitButton>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-display mb-3 text-lg font-semibold">Comments</h2>
        {comments.length === 0 && (
          <div className="rounded-xl border border-edge bg-card px-6 py-8 text-center text-sm text-muted shadow-sm">
            No comments yet.
          </div>
        )}
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.$id}
              className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {new Date(c.$createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <IssueStatusChip status={c.status} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-fg/90">
                {c.body}
              </p>
              {c.response && (
                <div className="mt-3 rounded-lg bg-app p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber">
                    Awaj ET replied
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {c.response}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
