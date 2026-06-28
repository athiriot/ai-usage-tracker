#!/bin/zsh

set -eu

CODEX_BIN="${CODEX_BIN:-$(command -v codex || true)}"
if [[ -z "$CODEX_BIN" ]]; then
  echo "Codex CLI was not found in PATH" >&2
  exit 1
fi

CACHE_ROOT="${AI_USAGE_CACHE_DIR:-${HOME}/Library/Caches/ai-usage-tracker}"
mkdir -p "$CACHE_ROOT"
LOG_FILE="$CACHE_ROOT/codex-status-refresh.log"

{
  date
  "$CODEX_BIN" exec \
    --skip-git-repo-check \
    --ephemeral \
    --json \
    "Refresh Codex rate-limit status. Do not inspect or edit files. Reply with only: OK"
} >>"$LOG_FILE" 2>&1
