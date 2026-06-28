#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { readCodexQuota } from "../src/codex.js";
import { readClaudeQuota } from "../src/claude.js";
import { loadLocalUsage } from "../src/local-usage.js";
import { projectRoot } from "../src/paths.js";
import { renderMenu } from "../src/render.js";

process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

try {
  const { config } = loadConfig();
  const now = new Date();
  const quotas = {
    codex: config.providers.codex ? readCodexQuota() : null,
    claude: config.providers.claude ? readClaudeQuota() : null
  };
  const usage = {};
  for (const provider of ["codex", "claude"]) {
    if (config.providers[provider]) usage[provider] = loadLocalUsage(provider, config, now);
  }
  const forceScript = join(projectRoot, "scripts", "force-codex-status.sh");
  process.stdout.write(renderMenu({
    config,
    quotas,
    usage,
    now,
    forceCodexStatusScript: existsSync(forceScript) ? forceScript : null
  }));
} catch (error) {
  process.stdout.write(`AI usage unavailable | sfimage=exclamationmark.triangle\n---\n${String(error.message).replaceAll("\n", " ")} | color=red\n`);
}
