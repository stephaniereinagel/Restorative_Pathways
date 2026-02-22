/**
 * Selah — Restorative Pathways Slack Bot
 * DM receive only. Uses Socket Mode.
 *
 * Bot App Behavior:
 * 1. Receive DM
 * 2. Immediately acknowledge with Prayer emoji
 * 3. Run Claude non-interactive session, write to {epoch}-{uuid}.md
 * 4. Send "Session completed" and attach the md file
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

app.event("message", async ({ message, say, client }) => {
  const msg = message as { text?: string; subtype?: string; bot_id?: string; channel?: string };
  if (msg.subtype || msg.bot_id) return;
  const text = (msg.text || "").trim();
  if (!text) return;

  const channel = msg.channel!;

  // 1. Immediately acknowledge with Prayer emoji
  await say({ channel, text: "🙏" });

  try {
    // 2. Run Claude session, write to {epoch}-{uuid}.md
    const filepath = await runSession(text);

    // 3. Send "Session completed" and attach the md file
    await uploadFileToSlack(client, channel, filepath, "Session completed");
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await say({
      channel,
      text: `_Session could not complete._\n\`\`\`${err}\`\`\``,
    });
  }
});

void app.start().then(() => {
  console.log("[selah] Bot running (Socket Mode, DM receive only)");
  console.log("[selah] Claude sessions → selah/sessions/{epoch}-{uuid}.md");
});
