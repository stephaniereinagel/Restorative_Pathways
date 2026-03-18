/**
 * Selah — Restorative Pathways Slack Bot
 * DM receive only. Uses Socket Mode.
 *
 * Bot App Behavior:
 * 1. Receive DM
 * 2. React with 🙏 to acknowledge
 * 3. Run Claude session → conversational narrative + session file
 * 4. Send narrative as a Slack message, react with ✅, attach the session file
 *
 * Env: SLACK_BOT_TOKEN, SLACK_APP_TOKEN (Claude uses stored OAuth login)
 */

import { App } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import { runSession } from "./session-runner.js";
import { uploadFileToSlack } from "./slack-upload.js";

// Keep chunks conservative for Slack reliability/readability.
const SLACK_MESSAGE_MAX_CHARS = 3000;

function chunkSlackMessage(text: string, maxChars = SLACK_MESSAGE_MAX_CHARS): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxChars) return [t];

  const paras = t.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const p of paras) {
    const para = p.trim();
    if (!para) continue;
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);

    // If a single paragraph is too large, hard-split it.
    if (para.length > maxChars) {
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      current = "";
    } else {
      current = para;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitInHalf(text: string): [string, string] {
  if (text.length < 2) return [text, ""];
  let splitAt = Math.floor(text.length / 2);
  const nearestBreak = text.lastIndexOf("\n\n", splitAt);
  if (nearestBreak > 0) splitAt = nearestBreak;
  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
}

async function sendSlackTextSafe(
  client: WebClient,
  channel: string,
  text: string,
  threadTs?: string
): Promise<void> {
  const payload = text.trim();
  if (!payload) return;

  try {
    await client.chat.postMessage({
      channel,
      text: payload,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    });
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const tooLong =
      /msg_too_long/i.test(msg) ||
      /invalid_arguments/i.test(msg) ||
      payload.length > SLACK_MESSAGE_MAX_CHARS;
    if (!tooLong || payload.length < 100) throw e;

    const [left, right] = splitInHalf(payload);
    if (left) await sendSlackTextSafe(client, channel, left, threadTs);
    if (right) await sendSlackTextSafe(client, channel, right, threadTs);
  }
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const activeSessions = new Set<Promise<void>>();

app.event("message", async ({ message, say, client }) => {
  const msg = message as { text?: string; subtype?: string; bot_id?: string; channel?: string; ts?: string };
  if (msg.subtype || msg.bot_id) return;
  const text = (msg.text || "").trim();
  if (!text) return;

  const channel = msg.channel!;
  const ts = msg.ts!;

  // 1. Acknowledge by reacting with praying hands
  await client.reactions.add({ channel, timestamp: ts, name: "pray" });

  const session = (async () => {
    try {
      const { filepath, narrative } = await runSession(text);

      const narrativeChunks = chunkSlackMessage(narrative);
      if (narrativeChunks.length === 0) {
        await say({
          channel,
          text: "_Session completed, but no conversational output was generated. Full notes are attached below._",
        });
      } else if (narrativeChunks.length === 1) {
        await sendSlackTextSafe(client, channel, narrativeChunks[0]);
      } else {
        const opener = await client.chat.postMessage({
          channel,
          text: `_Session reflection (part 1/${narrativeChunks.length})_\n\n${narrativeChunks[0]}`,
        });
        const threadTs = opener.ts;
        for (let i = 1; i < narrativeChunks.length; i++) {
          const numbered = `_Part ${i + 1}/${narrativeChunks.length}_\n\n${narrativeChunks[i]}`;
          await sendSlackTextSafe(client, channel, numbered, threadTs);
        }
      }

      await client.reactions.add({ channel, timestamp: ts, name: "white_check_mark" });
      await uploadFileToSlack(client, channel, filepath, "Full session notes attached.");
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await say({
        channel,
        text: `_Session could not complete._\n\`\`\`${err}\`\`\``,
      });
    }
  })();

  activeSessions.add(session);
  void session.finally(() => activeSessions.delete(session));
});

async function shutdown() {
  console.log("[selah] SIGTERM received — waiting for active sessions to finish...");
  await app.stop();
  await Promise.allSettled(activeSessions);
  console.log("[selah] All sessions complete. Exiting.");
  process.exit(0);
}

process.on("SIGTERM", () => { void shutdown(); });

void app.start().then(() => {
  console.log("[selah] Bot running (Socket Mode, DM receive only)");
  console.log("[selah] Claude sessions → selah/sessions/YYYY-MM-DD-topic.md");
});
