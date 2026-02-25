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
import { runSession } from "./session-runner.js";
import { uploadFileToSlack } from "./slack-upload.js";

const SLACK_MESSAGE_MAX_CHARS = 35000;

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
      for (const chunk of narrativeChunks) {
        await say({ channel, text: chunk });
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
