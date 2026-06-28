import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { claudeQuotaPath, claudeStatusBackupPath } from "./paths.js";

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function quotaFromClaudeStatus(payload, now = new Date()) {
  const five = payload?.rate_limits?.five_hour;
  const seven = payload?.rate_limits?.seven_day;
  if (!five && !seven) return null;
  return {
    version: 1,
    provider: "claude",
    updatedAt: now.toISOString(),
    claudeVersion: payload.version || null,
    fiveHour: five ? {
      usedPercentage: finiteOrNull(five.used_percentage),
      resetsAt: finiteOrNull(five.resets_at)
    } : null,
    weekly: seven ? {
      usedPercentage: finiteOrNull(seven.used_percentage),
      resetsAt: finiteOrNull(seven.resets_at)
    } : null
  };
}

export function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

export function readClaudeQuota(env = process.env) {
  const path = claudeQuotaPath(env);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function captureClaudeStatus(rawInput, env = process.env, now = new Date()) {
  let payload;
  try {
    payload = JSON.parse(rawInput);
  } catch {
    return { quota: null, error: "Claude status-line input was not valid JSON" };
  }
  const quota = quotaFromClaudeStatus(payload, now);
  if (quota) writeJsonAtomic(claudeQuotaPath(env), quota);
  return { quota, error: null };
}

export function runOriginalClaudeStatusLine(rawInput, env = process.env) {
  const path = claudeStatusBackupPath(env);
  if (!existsSync(path)) return null;
  let backup;
  try {
    backup = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  const command = backup?.statusLine?.command;
  if (!backup?.hadStatusLine || typeof command !== "string" || command.length === 0) return null;
  return spawnSync("/bin/zsh", ["-lc", command], {
    input: rawInput,
    encoding: "utf8",
    timeout: 5_000,
    env
  });
}
