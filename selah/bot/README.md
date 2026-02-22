# Selah Slack Bot

DM-only Slack bot for Restorative Pathways.

**Bot App Behavior:**
1. Receive DM → acknowledge with 🙏
2. Run Claude non-interactive session (full restoration protocol)
3. Write session notes to `selah/sessions/{epoch}-{uuid}.md`
4. Send "Session completed" and attach the md file

## Setup

1. **Create Slack app from manifest**
   - Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From an app manifest
   - Paste contents of `selah/slack-manifest.json`
   - Install to your workspace

2. **Get tokens**
   - **Bot Token** (OAuth & Permissions): `xoxb-...`
   - **App-Level Token** (Basic Information → App-Level Tokens): create one with `connections:write` scope → `xapp-...`

3. **Env**
   ```bash
   export SLACK_BOT_TOKEN=xoxb-...
   export SLACK_APP_TOKEN=xapp-...
   ```

4. **Claude Code CLI** (on the server)
   - Install [Claude Code](https://code.claude.com)
   - Run `claude` once and sign in (stores session)
   - Bot spawns `claude -p` for sessions — no API key needed
   - Bot must run as the same user who signed in (session is per-user)

5. **Run bot**
   ```bash
   cd selah/bot && bun install && bun run dev
   ```

## Manifest

The manifest configures:
- Socket Mode (no public URL)
- `message.im` event (DMs only)
- Scopes: `chat:write`, `files:write`, `im:history`, `im:read`
