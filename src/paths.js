import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function configDir(env = process.env) {
  if (env.AI_USAGE_CONFIG_DIR) return resolve(env.AI_USAGE_CONFIG_DIR);
  const base = env.XDG_CONFIG_HOME || join(env.HOME || homedir(), ".config");
  return join(base, "ai-usage-tracker");
}

export function configPath(env = process.env) {
  return env.AI_USAGE_CONFIG || join(configDir(env), "config.json");
}

export function cacheDir(env = process.env) {
  if (env.AI_USAGE_CACHE_DIR) return resolve(env.AI_USAGE_CACHE_DIR);
  const home = env.HOME || homedir();
  return process.platform === "darwin"
    ? join(home, "Library", "Caches", "ai-usage-tracker")
    : join(env.XDG_CACHE_HOME || join(home, ".cache"), "ai-usage-tracker");
}

export function claudeQuotaPath(env = process.env) {
  return join(cacheDir(env), "claude-quota.json");
}

export function claudeStatusBackupPath(env = process.env) {
  return join(configDir(env), "claude-statusline-backup.json");
}

export function installStatePath(env = process.env) {
  return join(configDir(env), "install-state.json");
}

export function codexHome(env = process.env) {
  return resolve(env.CODEX_HOME || join(env.HOME || homedir(), ".codex"));
}

export function claudeHome(env = process.env) {
  return resolve(env.CLAUDE_CONFIG_DIR || join(env.HOME || homedir(), ".claude"));
}
