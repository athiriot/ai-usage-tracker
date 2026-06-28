#!/bin/zsh

# <xbar.title>AI Usage Tracker</xbar.title>
# <xbar.version>v0.1.1</xbar.version>
# <xbar.author>Adam Thiriot</xbar.author>
# <xbar.author.github>athiriot</xbar.author.github>
# <xbar.desc>Shows Codex and Claude quota and local usage estimates.</xbar.desc>
# <xbar.dependencies>node,npm,ccusage</xbar.dependencies>
# <xbar.abouturl>https://github.com/athiriot/ai-usage-tracker</xbar.abouturl>

set -u

SCRIPT_PATH="${0:A}"
PROJECT_DIR="${SCRIPT_PATH:h:h}"

if [[ -n "${AI_USAGE_NODE:-}" && -x "$AI_USAGE_NODE" ]]; then
  NODE_BIN="$AI_USAGE_NODE"
elif [[ -x /opt/homebrew/bin/node ]]; then
  NODE_BIN=/opt/homebrew/bin/node
elif [[ -x /usr/local/bin/node ]]; then
  NODE_BIN=/usr/local/bin/node
else
  NODE_BIN="$(command -v node || true)"
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "AI usage unavailable | sfimage=exclamationmark.triangle"
  echo "---"
  echo "Node.js 20+ was not found | color=red"
  exit 0
fi

exec "$NODE_BIN" "$PROJECT_DIR/scripts/ai-usage-menubar.js"
