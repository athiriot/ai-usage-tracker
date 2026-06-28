import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig } from "../src/config.js";
import { renderMenu } from "../src/render.js";

test("both-provider mode rotates separate compact titles", () => {
  const config = {
    ...defaultConfig,
    providers: { codex: true, claude: true }
  };
  const future = Math.floor(new Date("2026-07-01T00:00:00Z").getTime() / 1000);
  const quotas = {
    codex: {
      updatedAt: "2026-06-28T18:00:00Z",
      fiveHour: { usedPercentage: 25, resetsAt: future },
      weekly: { usedPercentage: 50, resetsAt: future }
    },
    claude: {
      updatedAt: "2026-06-28T18:00:00Z",
      fiveHour: { usedPercentage: 10, resetsAt: future },
      weekly: { usedPercentage: 20, resetsAt: future }
    }
  };
  const localUsage = {
    ok: true,
    periodLabel: "2026-06-01 to 2026-06-30",
    cost: 12,
    tokens: 1_000_000,
    todayCost: 1,
    todayTokens: 10_000,
    models: ["test-model"],
    budget: null
  };
  const menu = renderMenu({
    config,
    quotas,
    usage: { codex: localUsage, claude: localUsage },
    now: new Date("2026-06-28T19:00:00Z"),
    forceCodexStatusScript: "/tmp/refresh.sh"
  });
  const lines = menu.split("\n");
  assert.match(lines[0], /^Codex 75% 5h \/ 50% week/);
  assert.match(lines[1], /^Claude 90% 5h \/ 80% week/);
  assert.match(menu, /bash="\/tmp\/refresh\.sh"/);
  assert.match(menu, /API-equivalent local estimate/);
});

test("missing quota falls back without crashing", () => {
  const config = { ...defaultConfig, providers: { codex: false, claude: true } };
  const menu = renderMenu({
    config,
    quotas: { claude: null },
    usage: { claude: { ok: false, error: "No records" } },
    now: new Date("2026-06-28T19:00:00Z")
  });
  assert.match(menu, /^Claude waiting for usage/);
  assert.match(menu, /no current status/);
});
