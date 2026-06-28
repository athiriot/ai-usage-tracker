import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { cycleBounds } from "./core.js";
import { projectRoot } from "./paths.js";

function costOf(row) {
  const value = Number(row?.costUSD ?? row?.totalCost ?? row?.cost ?? 0);
  return Object.is(value, -0) ? 0 : value;
}

export function runCcusage(provider, options = {}) {
  const binary = options.binary || join(projectRoot, "node_modules", ".bin", "ccusage");
  if (!existsSync(binary)) {
    return { ok: false, error: "ccusage is not installed; run npm ci" };
  }
  const args = [provider, "daily", "--json"];
  if (provider === "claude") args.push("--offline");
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    timeout: 25_000,
    env: { ...process.env, ...(options.env || {}), NO_COLOR: "1" }
  });
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || result.stdout || "ccusage failed").trim() };
  }
  try {
    return { ok: true, data: JSON.parse(result.stdout) };
  } catch (error) {
    return { ok: false, error: `Invalid ccusage JSON: ${error.message}` };
  }
}

export function summarizeDailyUsage(provider, data, config, now = new Date()) {
  const rows = Array.isArray(data?.daily) ? data.daily : [];
  if (rows.length === 0) return { provider, ok: false, empty: true, error: "No local usage records found" };
  const bounds = cycleBounds(Number(config.billingCycleStartDay), now);
  const periodRows = rows.filter((row) => {
    const key = row.date || row.period;
    return key >= bounds.start && key <= bounds.end;
  });
  if (periodRows.length === 0) {
    return { provider, ok: false, empty: true, error: `No usage records for ${bounds.label}` };
  }

  const todayKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const today = rows.find((row) => (row.date || row.period) === todayKey);
  const aggregate = periodRows.reduce((result, row) => {
    result.cost += costOf(row);
    result.tokens += Number(row.totalTokens || 0);
    const models = row.models && typeof row.models === "object" ? Object.keys(row.models) : row.modelsUsed || [];
    models.forEach((model) => result.models.add(model));
    return result;
  }, { cost: 0, tokens: 0, models: new Set() });
  const budget = Number(config.monthlyBudgetsUsd?.[provider]);
  return {
    provider,
    ok: true,
    periodLabel: bounds.label,
    cost: aggregate.cost,
    tokens: aggregate.tokens,
    todayCost: costOf(today),
    todayTokens: Number(today?.totalTokens || 0),
    models: [...aggregate.models].sort(),
    budget: Number.isFinite(budget) && budget > 0
      ? { value: budget, usedPercent: Math.round((aggregate.cost / budget) * 100), remaining: Math.max(0, budget - aggregate.cost) }
      : null
  };
}

export function loadLocalUsage(provider, config, now = new Date(), options = {}) {
  const result = runCcusage(provider, options);
  if (!result.ok) return { provider, ok: false, error: result.error };
  return summarizeDailyUsage(provider, result.data, config, now);
}
