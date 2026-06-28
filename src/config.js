import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { configPath, projectRoot } from "./paths.js";

export const defaultConfig = Object.freeze({
  providers: { codex: true, claude: false },
  billingCycleStartDay: 1,
  currency: "USD",
  monthlyBudgetsUsd: { codex: null, claude: null },
  codex: {
    dashboardUrl: "https://chatgpt.com/codex/settings/usage",
    manualStatusRefresh: true
  },
  claude: {
    dashboardUrl: "https://claude.ai/settings/usage"
  }
});

function mergeConfig(value = {}) {
  return {
    ...defaultConfig,
    ...value,
    providers: { ...defaultConfig.providers, ...(value.providers || {}) },
    monthlyBudgetsUsd: {
      ...defaultConfig.monthlyBudgetsUsd,
      ...(value.monthlyBudgetsUsd || {})
    },
    codex: { ...defaultConfig.codex, ...(value.codex || {}) },
    claude: { ...defaultConfig.claude, ...(value.claude || {}) }
  };
}

export function validateConfig(config) {
  const enabled = ["codex", "claude"].filter((id) => config.providers[id] === true);
  if (enabled.length === 0) {
    throw new Error("Enable at least one provider: codex or claude");
  }

  const day = Number(config.billingCycleStartDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("billingCycleStartDay must be an integer from 1 to 31");
  }
  return config;
}

export function loadConfig(env = process.env) {
  const userPath = configPath(env);
  const fallbackPath = join(projectRoot, "config.example.json");
  const path = existsSync(userPath) ? userPath : fallbackPath;
  const value = JSON.parse(readFileSync(path, "utf8"));
  return { config: validateConfig(mergeConfig(value)), path };
}
