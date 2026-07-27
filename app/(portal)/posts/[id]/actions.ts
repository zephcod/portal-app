"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createPostComment } from "@/lib/data";
import { env } from "@/lib/env";
import { getSession } from "@/lib/server-session";
import { notifyNewPostComment } from "@/lib/telegram";

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
