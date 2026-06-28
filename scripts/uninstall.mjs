#!/usr/bin/env node

import { uninstall } from "../src/installer.js";

try {
  const result = uninstall({ purge: process.argv.includes("--purge") });
  process.stdout.write(`Uninstalled AI Usage Tracker${result.purged ? " and removed local configuration/cache" : ""}.\n`);
} catch (error) {
  process.stderr.write(`Uninstall failed: ${error.message}\n`);
  process.exitCode = 1;
}
