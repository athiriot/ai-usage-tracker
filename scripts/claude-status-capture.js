#!/usr/bin/env node

import { captureClaudeStatus, runOriginalClaudeStatusLine } from "../src/claude.js";
import { percentLeft } from "../src/core.js";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const rawInput = Buffer.concat(chunks).toString("utf8");
const result = captureClaudeStatus(rawInput);
const original = runOriginalClaudeStatusLine(rawInput);

if (original) {
  if (original.stdout) process.stdout.write(original.stdout);
  if (original.stderr) process.stderr.write(original.stderr);
  process.exitCode = original.status || 0;
} else if (result.quota) {
  const parts = [];
  if (result.quota.fiveHour) parts.push(`${percentLeft(result.quota.fiveHour.usedPercentage)}% 5h left`);
  if (result.quota.weekly) parts.push(`${percentLeft(result.quota.weekly.usedPercentage)}% week left`);
  process.stdout.write(`Claude ${parts.join(" / ")}\n`);
} else if (result.error) {
  process.stderr.write(`${result.error}\n`);
}
