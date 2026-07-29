import { ArrowUpRight, Clapperboard, Heart, LayoutGrid, MessageCircle, Repeat2 } from "lucide-react";
import Link from "next/link";
import { LoadMoreList } from "@/components/LoadMoreList";
import { PlatformIcon } from "@/components/PlatformIcon";
import { fbQueueConfigured, igQueueConfigured } from "@/lib/env";
import { listFbQueue, type FbQueueItem } from "@/lib/fbqueue";
import {
  listPublishedPosts,
  listScheduledPosts,
  type PublishedPost,
  type ScheduledPost,
} from "@/lib/facebook";
import { fmtDateTime, relativeFromNow } from "@/lib/format";
import { listIgQueue, type IgQueueItem } from "@/lib/igqueue";
import { getIgAccount, listIgMedia, type IgMedia } from "@/lib/instagram";
import type { ManagedPage } from "@/lib/pages";
import { mediaUrl } from "@/lib/storage";

type Badge = { Icon: typeof LayoutGrid; label: string };
type Stat = { Icon: typeof Heart; value: number };

/**
 * Upcoming (Facebook + IG queued) and recently published posts for one
 * page. Server component embedded below the calendar in Content Hub.
 *
 * Scheduling now runs through Appwrite queues (fb_queue, ig_queue) —
 * see the Social Platform Manager's lib/fbqueue.ts and lib/igqueue.ts —
 * not Facebook's own scheduler, so thumbnails are staged Appwrite media
 * (lib/storage.ts), not Graph fields. `listScheduledPosts` still runs
 * alongside it purely to surface any posts scheduled before the
 * migration; that list only shrinks over time as they publish.
 */
export default async function PostsList({
  page,
  error: externalError,
}: {
  page: ManagedPage | null;
  error?: string | null;
}) {
  let fbScheduled: ScheduledPost[] = [];
  let fbQueued: FbQueueItem[] = [];
  let igQueued: IgQueueItem[] = [];
  let published: PublishedPost[] = [];
  let igMedia: IgMedia[] = [];
  let error: string | null = externalError ?? null;

  if (!error && page) {
    try {
      [fbScheduled, published] = await Promise.all([
        listScheduledPosts(page),
        listPublishedPosts(page),
      ]);
      if (fbQueueConfigured()) {
        // Clients see only cleanly pending items — no failure internals.
        fbQueued = (await listFbQueue(page.id)).filter(
          (i) => i.status === "pending" || i.status === "publishing"
        );
      }
      if (igQueueConfigured()) {
        igQueued = (await listIgQueue(page.id)).filter(
          (i) => i.status === "pending" || i.status === "publishing"
        );
      }
      // Instagram published posts — optional, never blocks Facebook's.
      try {
        const ig = await getIgAccount(page);
        if (ig) igMedia = await listIgMedia(page, ig.id, 25);
      } catch {
        // no IG account / unreachable — Facebook's published list still shows
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load posts.";
    }
  }

  // Staged media lives in the shared Appwrite bucket — a direct public
  // URL, no Graph API round-trip needed.
  const fbThumbs: Record<string, string> = {};
  for (const item of fbQueued) {
    if (item.mediaType !== "image" && item.mediaType !== "multiImage") continue;
    const refs: string[] = item.mediaRefs ? JSON.parse(item.mediaRefs) : [];
    if (refs[0]) fbThumbs[item.$id] = mediaUrl(refs[0]);
  }
  const igThumbs: Record<string, string> = {};
  for (const item of igQueued) {
    const refs: string[] = item.mediaRefs ? JSON.parse(item.mediaRefs) : [];
    if ((item.mediaType ?? "image") === "reel") {
      if (item.thumbRef) igThumbs[item.$id] = mediaUrl(item.thumbRef);
    } else if (refs[0]) {
      igThumbs[item.$id] = mediaUrl(refs[0]);
    }
  }

  const upcoming = [
    ...fbScheduled.map((p) => ({
      key: `fb-${p.id}`,
      postId: p.id,
      href: `/posts/${p.id}?source=fb-scheduled`,
      when: p.scheduled_publish_time,
      platform: "fb" as const,
      platformLabel: "Facebook",
      text: p.message || "(photo post)",
      image: p.full_picture,
      badge: undefined as Badge | undefined,
    })),
    ...fbQueued.map((item) => ({
      key: `fbq-${item.$id}`,
      postId: item.$id,
      href: `/posts/${item.$id}?source=fb-queue`,
      when: item.scheduledAt,
      platform: "fb" as const,
      platformLabel: "Facebook",
      text: item.caption || "(no caption)",
      image: fbThumbs[item.$id],
      badge:
        item.mediaType === "multiImage"
          ? { Icon: LayoutGrid, label: "multi-photo" }
          : item.mediaType === "video"
            ? { Icon: Clapperboard, label: "video" }
            : undefined,
    })),
    ...igQueued.map((i) => ({
      key: `ig-${i.$id}`,
      postId: i.$id,
      href: `/posts/${i.$id}?source=ig-queue`,
      when: i.scheduledAt,
      platform: "ig" as const,
      platformLabel: "Instagram",
      text: i.caption || "(image post)",
      image: igThumbs[i.$id],
      badge:
        i.mediaType === "carousel"
          ? { Icon: LayoutGrid, label: "carousel" }
          : i.mediaType === "reel"
            ? { Icon: Clapperboard, label: "reel" }
            : undefined,
    })),
  ].sort((a, b) => a.when - b.when);

  const recentlyPublished = [
    ...published.map((p) => ({
      key: `fb-${p.id}`,
      when: new Date(p.created_time).getTime(),
      whenLabel: p.created_time,
      platform: "fb" as const,
      href: `/posts/${p.id}?source=fb-published`,
      permalink: p.permalink_url,
      permalinkLabel: "View on Facebook",
      text: p.message || "(photo post)",
      image: p.full_picture,
      stats: [
        { Icon: Heart, value: p.reactions?.summary?.total_count ?? 0 },
        { Icon: MessageCircle, value: p.comments?.summary?.total_count ?? 0 },
        { Icon: Repeat2, value: p.shares?.count ?? 0 },
      ] satisfies Stat[],
    })),
    ...igMedia
      .filter((m) => Boolean(m.timestamp))
      .map((m) => ({
        key: `ig-${m.id}`,
        when: new Date(m.timestamp!).getTime(),
        whenLabel: m.timestamp!,
        platform: "ig" as const,
        href: `/posts/${m.id}?source=ig-published`,
        permalink: m.permalink,
        permalinkLabel: "View on Instagram",
        text: m.caption || "(image post)",
        image: m.thumbnail_url ?? m.media_url,
        stats: [
          { Icon: Heart, value: m.like_count ?? 0 },
          { Icon: MessageCircle, value: m.comments_count ?? 0 },
        ] satisfies Stat[],
      })),
  ].sort((a, b) => b.when - a.when);

  return (
    <div>
      <h2 className="font-display text-2xl font-bold">Your content plan</h2>
      <p className="mt-1 text-sm text-muted">
        Posts Awaj ET has scheduled and published for{" "}
        {page?.name ?? "your page"}.
      </p>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {!error && (
        <>
          <h3 className="mt-8 font-mono text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            Upcoming ({upcoming.length})
          </h3>
          {upcoming.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-edge bg-card/60 p-8 text-center">
              <p className="text-sm text-muted">
                Nothing scheduled right now.
              </p>
            </div>
          ) : (
            <LoadMoreList
              pageSize={6}
              items={upcoming.map((u) => (
                <li key={u.key}>
                  <Link
                    href={u.href}
                    className="block rounded-lg border border-edge bg-card p-4 shadow-sm transition-colors hover:border-gold"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-xs font-semibold text-amber">
                        {fmtDateTime(u.when)} EAT
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        {relativeFromNow(u.when)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted">
                        <PlatformIcon platform={u.platform} /> {u.platformLabel}
                      </span>
                      {u.badge && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-navy/5 px-2 py-0.5 font-mono text-[10px] text-muted">
                          <u.badge.Icon className="h-3 w-3" /> {u.badge.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-4">
                      {u.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.image}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-md border border-edge object-cover"
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap">{u.text}</p>
                    </div>
                  </Link>
                </li>
              ))}
            />
          )}

          <h3 className="mt-10 font-mono text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            Recently published
          </h3>
          {recentlyPublished.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No published posts yet.</p>
          ) : (
            <LoadMoreList
              pageSize={6}
              items={recentlyPublished.map((p) => (
                <li
                  key={p.key}
                  className="rounded-lg border border-edge bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-xs text-muted">
                      {fmtDateTime(p.whenLabel)} EAT
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted">
                      <PlatformIcon platform={p.platform} />
                    </span>
                    {p.permalink && (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 font-mono text-[11px] text-amber underline"
                      >
                        {p.permalinkLabel}
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <Link
                    href={p.href}
                    className="-mx-1 block rounded-md px-1 transition-colors hover:bg-app"
                  >
                    <div className="mt-2 flex gap-4">
                      {p.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-md border border-edge object-cover"
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap">{p.text}</p>
                    </div>
                    <div className="mt-3 flex gap-5 border-t border-edge pt-3 font-mono text-[11px] text-muted">
                      {p.stats.map(({ Icon, value }, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Icon className="h-3 w-3" /> {value}
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            />
          )}
        </>
      )}
    </div>
  );
}
