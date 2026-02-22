#!/bin/bash
# Run once on the server to set up the Selah bot.
# Usage: bash bootstrap-server.sh

set -e

echo "=== Selah Bot Server Bootstrap ==="

# Install Bun
if ! command -v bun &>/dev/null; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  source ~/.bashrc
fi

# Install Claude Code
if ! command -v claude &>/dev/null; then
  echo "Installing Claude Code..."
  npm install -g @anthropic-ai/claude-code
fi

# Create deploy directory
mkdir -p /opt/selah/selah/bot
mkdir -p /opt/selah/selah/sessions
mkdir -p /opt/selah/selah/people
mkdir -p /opt/selah/public/rp

# Install systemd service
cp /opt/selah/selah/bot/selah-bot.service /etc/systemd/system/selah-bot.service
systemctl daemon-reload
systemctl enable selah-bot

echo ""
echo "=== Next steps ==="
echo "1. Copy your .env to /opt/selah/selah/bot/.env"
echo "   Contents:"
echo "   SLACK_BOT_TOKEN=xoxb-..."
echo "   SLACK_APP_TOKEN=xapp-..."
echo ""
echo "2. Sign in to Claude Code:"
echo "   claude"
echo ""
echo "3. Start the bot:"
echo "   systemctl start selah-bot"
echo "   systemctl status selah-bot"
