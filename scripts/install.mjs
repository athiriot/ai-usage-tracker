#!/usr/bin/env node

import { install } from "../src/installer.js";

const help = `Usage: ./install.sh [options]\n\nOptions:\n  --providers codex|claude|codex,claude\n  --plugin-dir PATH\n  --yes\n  --help\n`;

try {
  const result = await install();
  if (result.help) {
    process.stdout.write(help);
  } else {
    process.stdout.write(`Installed AI Usage Tracker\nProviders: ${result.providers.join(", ")}\nPlugin: ${result.pluginPath}\nConfig: ${result.configPath}\n`);
  }
} catch (error) {
  process.stderr.write(`Installation failed: ${error.message}\n`);
  process.exitCode = 1;
}
