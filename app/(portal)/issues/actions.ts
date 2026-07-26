"use server";

import { revalidatePath } from "next/cache";
import { createIssue } from "@/lib/data";
import { getSession } from "@/lib/server-session";
import { notifyNewIssue } from "@/lib/telegram";

export async function submitIssue(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  // Clients can only file issues for their own company.
  const companyId = session.cid;
  if (!companyId) throw new Error("Missing company");

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) throw new Error("Title and details are required");

  await createIssue({ companyId, title: title.slice(0, 256), body: body.slice(0, 4096) });

  // Ping the team on Telegram — best-effort, never blocks the client.
  await notifyNewIssue({
    companyName: session.name || companyId,
    title,
    body,
  });

  revalidatePath("/issues");
}
