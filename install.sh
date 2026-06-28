#!/bin/zsh

set -eu

ROOT="${0:A:h}"

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
  echo "Node.js 20 or newer is required." >&2
  exit 1
fi

exec "$NODE_BIN" "$ROOT/scripts/install.mjs" "$@"
