/**
 * Telegram notifications for the Awaj ET team — standard bot pattern:
 * a bot token (from @BotFather) + the chat id of your team group/DM.
 *
 * Setup:
 *   1. @BotFather → /newbot → copy the token
 *   2. Add the bot to your team group (or DM it /start)
 *   3. Get the chat id: https://api.telegram.org/bot<TOKEN>/getUpdates
 *      (group ids are negative numbers)
 *   4. .env: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 *
 * Notifications are best-effort: failures are logged, never thrown —
 * a Telegram outage must not block a client filing an issue.
 */

function configured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Send an HTML-formatted message to the team chat. Never throws. */
export async function sendTelegram(html: string): Promise<void> {
  if (!configured()) return;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: html,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) {
      console.error("[telegram] sendMessage failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[telegram] notification error:", e);
  }
}

/** New-issue notification. */
export async function notifyNewIssue(opts: {
  companyName: string;
  title: string;
  body: string;
}): Promise<void> {
  const excerpt =
    opts.body.length > 300 ? `${opts.body.slice(0, 300)}…` : opts.body;
  await sendTelegram(
    `🛎 <b>New client issue</b>\n` +
      `<b>${esc(opts.companyName)}</b>\n\n` +
      `<b>${esc(opts.title)}</b>\n` +
      `${esc(excerpt)}\n\n` +
      `<i>Reply from the reports admin → Issues.</i>`
  );
}

/** New-post-comment notification. */
export async function notifyNewPostComment(opts: {
  companyName: string;
  postId: string;
  body: string;
}): Promise<void> {
  const excerpt =
    opts.body.length > 300 ? `${opts.body.slice(0, 300)}…` : opts.body;
  await sendTelegram(
    `💬 <b>New post comment</b>\n` +
      `<b>${esc(opts.companyName)}</b>\n\n` +
      `${esc(excerpt)}\n\n` +
      `<i>Post: ${esc(opts.postId)}</i>\n` +
      `<i>Reply from the reports admin → Issues.</i>`
  );
}
