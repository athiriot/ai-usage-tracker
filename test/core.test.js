import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cycleBounds, quotaWindow } from "../src/core.js";
import { parseCodexRateLimitEntry } from "../src/codex.js";
import { quotaFromClaudeStatus } from "../src/claude.js";
import { summarizeDailyUsage } from "../src/local-usage.js";

const fixture = (name) => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8"));

test("cycleBounds clamps billing days in short months", () => {
  const result = cycleBounds(31, new Date(2026, 1, 15));
  assert.deepEqual(result, {
    start: "2026-01-31",
    end: "2026-02-27",
    label: "2026-01-31 to 2026-02-27"
  });
});

test("quotaWindow marks a passed reset as estimated", () => {
  const result = quotaWindow(
    { usedPercentage: 70, resetsAt: 100 },
    new Date(101_000)
  );
  assert.equal(result.expired, true);
  assert.equal(result.label, "100% est.");
});

test("parses Codex quota and context from token_count records", () => {
  const status = parseCodexRateLimitEntry(fixture("codex-rate-limit.json"));
  assert.equal(status.planType, "plus");
  assert.equal(status.fiveHour.usedPercentage, 35);
  assert.equal(status.weekly.usedPercentage, 60);
  assert.equal(status.context.usedPercentage, 25);
});

test("parses only documented Claude quota fields", () => {
  const status = quotaFromClaudeStatus(fixture("claude-status.json"), new Date("2026-06-28T18:01:00Z"));
  assert.deepEqual(status.fiveHour, { usedPercentage: 22, resetsAt: 1782676800 });
  assert.deepEqual(status.weekly, { usedPercentage: 41, resetsAt: 1783108800 });
  assert.equal(status.updatedAt, "2026-06-28T18:01:00.000Z");
  assert.equal("session_id" in status, false);
});

test("aggregates local usage without treating cost as quota", () => {
  const config = {
    billingCycleStartDay: 1,
    monthlyBudgetsUsd: { codex: 20 }
  };
  const result = summarizeDailyUsage("codex", {
    daily: [
      { date: "2026-06-01", costUSD: 3.25, totalTokens: 1000, models: { "gpt-test": {} } },
      { date: "2026-06-02", costUSD: 2.75, totalTokens: 2000, models: { "gpt-test": {} } }
    ]
  }, config, new Date(2026, 5, 2, 12));
  assert.equal(result.cost, 6);
  assert.equal(result.tokens, 3000);
  assert.deepEqual(result.models, ["gpt-test"]);
  assert.equal(result.budget.remaining, 14);
});
