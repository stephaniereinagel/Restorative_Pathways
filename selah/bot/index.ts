/**
 * Selah — Restorative Pathways Slack Bot
 * DM receive only. Uses Socket Mode.
 *
 * Bot App Behavior:
 * 1. Receive DM
 * 2. React to message with 🙏 (pray) to acknowledge
 * 3. Run Claude non-interactive session, write to {epoch}-{uuid}.md
 * 4. React with ✅ (white_check_mark) and attach the md file
 *
 * Env: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, ANTHROPIC_API_KEY
 */

import { App } from "@slack/bolt";
import { runSession } from "./session-runner.js";
import { uploadFileToSlack } from "./slack-upload.js";

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
      // 2. Run Claude session, write to {epoch}-{uuid}.md
      const filepath = await runSession(text);

      // 3. React with green checkmark and attach the md file
      await client.reactions.add({ channel, timestamp: ts, name: "white_check_mark" });
      await uploadFileToSlack(client, channel, filepath, "Session completed");
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
  console.log("[selah] Claude sessions → selah/sessions/{epoch}-{uuid}.md");
});
