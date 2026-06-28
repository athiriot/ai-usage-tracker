#!/bin/zsh

set -eu

ROOT="${0:A:h}"
NODE_BIN="${AI_USAGE_NODE:-$(command -v node || true)}"
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js is required to uninstall cleanly." >&2
  exit 1
fi

exec "$NODE_BIN" "$ROOT/scripts/uninstall.mjs" "$@"
