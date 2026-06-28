import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { codexHome } from "./paths.js";

function jsonlFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const directory = stack.pop();
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) stack.push(path);
      if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path);
    }
  }
  return files;
}

export function parseCodexRateLimitEntry(entry) {
  const payload = entry?.payload;
  if (payload?.type !== "token_count" || !payload.rate_limits) return null;
  const contextUsedTokens = Number(payload.info?.last_token_usage?.total_tokens || 0);
  const contextWindow = Number(payload.info?.model_context_window || 0);
  return {
    provider: "codex",
    updatedAt: entry.timestamp || null,
    planType: payload.rate_limits.plan_type || null,
    fiveHour: payload.rate_limits.primary ? {
      usedPercentage: Number(payload.rate_limits.primary.used_percent ?? 0),
      resetsAt: Number(payload.rate_limits.primary.resets_at || 0)
    } : null,
    weekly: payload.rate_limits.secondary ? {
      usedPercentage: Number(payload.rate_limits.secondary.used_percent ?? 0),
      resetsAt: Number(payload.rate_limits.secondary.resets_at || 0)
    } : null,
    context: contextWindow > 0 ? {
      usedTokens: contextUsedTokens,
      windowTokens: contextWindow,
      usedPercentage: Math.min(100, Math.round((contextUsedTokens / contextWindow) * 100))
    } : null
  };
}

function latestStatusInFile(path) {
  let lines;
  try {
    lines = readFileSync(path, "utf8").trimEnd().split("\n");
  } catch {
    return null;
  }
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const status = parseCodexRateLimitEntry(JSON.parse(lines[index]));
      if (status) return status;
    } catch {
      // Ignore partial or unrelated JSONL records.
    }
  }
  return null;
}

export function readCodexQuota(env = process.env) {
  const sessions = join(codexHome(env), "sessions");
  const recent = jsonlFiles(sessions)
    .map((path) => {
      try {
        return { path, mtimeMs: statSync(path).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 40);
  const statuses = recent.map(({ path }) => latestStatusInFile(path)).filter(Boolean);
  statuses.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return statuses[0] || null;
}
