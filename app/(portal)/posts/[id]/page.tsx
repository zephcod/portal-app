import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientPage } from "@/lib/clientpage";
import { getPublishedPost, getScheduledPost } from "@/lib/facebook";
import { fmtDateTime, relativeFromNow } from "@/lib/format";
import { getIgQueueItem } from "@/lib/igqueue";
import { getIgMedia } from "@/lib/instagram";
import { PlatformIcon } from "@/components/PlatformIcon";

export const dynamic = "force-dynamic";

type Source = "fb-scheduled" | "fb-published" | "ig-queue" | "ig-published";

function isSource(v: string | undefined): v is Source {
  return (
    v === "fb-scheduled" ||
    v === "fb-published" ||
    v === "ig-queue" ||
    v === "ig-published"
  );
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

  const ctx = await getClientPage();
  if (!ctx) notFound();

  let platform: "fb" | "ig";
  let platformName: string;
  let statusLabel: string;
  let when: number; // unix seconds
  let text: string;
  let placeholder: string;
  let image: string | undefined;
  let permalink: string | undefined;
  let permalinkLabel = "View on Facebook ↗";
  let badge: string | undefined;
  let engagement:
    | { reactions: number; comments: number; shares?: number }
    | undefined;

  if (source === "fb-scheduled") {
    const post = await getScheduledPost(ctx.page, id);
    if (!post) notFound();
    platform = "fb";
    platformName = "Facebook";
    statusLabel = "Scheduled";
    when = post.scheduled_publish_time;
    text = post.message ?? "";
    placeholder = "(photo post)";
    image = post.full_picture;
  } else if (source === "fb-published") {
    const post = await getPublishedPost(ctx.page, id);
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
  } else if (source === "ig-queue") {
    const item = await getIgQueueItem(ctx.page.id, id);
    if (!item || (item.status !== "pending" && item.status !== "publishing")) {
      notFound();
    }
    platform = "ig";
    platformName = "Instagram";
    statusLabel = item.status === "publishing" ? "Publishing" : "Scheduled";
    when = item.scheduledAt;
    text = item.caption ?? "";
    placeholder = "(image post)";
    badge =
      item.mediaType === "carousel"
        ? "carousel"
        : item.mediaType === "reel"
          ? "reel"
          : undefined;
  } else {
    const media = await getIgMedia(ctx.page, id);
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
    permalinkLabel = "View on Instagram ↗";
    engagement = {
      reactions: media.like_count ?? 0,
      comments: media.comments_count ?? 0,
    };
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/posts"
        className="font-mono text-xs text-warmgray hover:text-charcoal"
      >
        ← Back to posts
      </Link>

      <div className="mt-4 rounded-xl border border-line bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-amber">
              <PlatformIcon platform={platform} /> {platformName}
            </span>
            <span className="rounded-full bg-navy/5 px-2 py-0.5 font-mono text-[10px] tracking-wide text-warmgray uppercase">
              {statusLabel}
            </span>
            {badge && (
              <span className="rounded-full bg-navy/5 px-2 py-0.5 font-mono text-[10px] text-warmgray">
                {badge}
              </span>
            )}
          </div>
          {permalink && (
            <a
              href={permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-amber underline"
            >
              {permalinkLabel}
            </a>
          )}
        </div>

        <p className="mt-2 font-mono text-xs text-warmgray">
          {fmtDateTime(when)} EAT · {relativeFromNow(when)}
        </p>

        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="mt-4 max-h-96 w-full rounded-lg border border-line bg-mist object-contain"
          />
        )}

        <p className="mt-4 text-sm whitespace-pre-wrap">
          {text || <span className="text-warmgray italic">{placeholder}</span>}
        </p>

        {engagement && (
          <div className="mt-6 flex gap-6 border-t border-line pt-4 font-mono text-xs text-warmgray">
            <span>♥ {engagement.reactions}</span>
            <span>💬 {engagement.comments}</span>
            {engagement.shares !== undefined && <span>↻ {engagement.shares}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
