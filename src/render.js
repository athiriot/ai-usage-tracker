import { formatMoney, formatTokens, percentLeft, quotaWindow, sanitizeMenuText } from "./core.js";

const labels = { codex: "Codex", claude: "Claude" };

function providerTitle(provider, quota, usage, now) {
  const label = labels[provider];
  if (quota?.fiveHour || quota?.weekly) {
    const primary = quotaWindow(quota.fiveHour, now);
    const weekly = quotaWindow(quota.weekly, now);
    const pieces = [];
    if (primary) pieces.push(`${primary.label} 5h`);
    if (weekly) pieces.push(`${weekly.label} week`);
    return `${label} ${pieces.join(" / ")}`;
  }
  if (usage?.ok) return `${label} ${formatTokens(usage.tokens)} tokens`;
  return `${label} waiting for usage`;
}

function quotaDetails(provider, quota, now) {
  if (!quota) return [`${labels[provider]} quota: no current status | color=gray`];
  const lines = [];
  const primary = quotaWindow(quota.fiveHour, now);
  const weekly = quotaWindow(quota.weekly, now);
  if (primary) lines.push(`5-hour limit: ${primary.label} left, ${primary.resetText} | font=Menlo size=11`);
  if (weekly) lines.push(`Weekly limit: ${weekly.label} left, ${weekly.resetText} | font=Menlo size=11`);
  if (quota.updatedAt) {
    const prefix = provider === "claude" ? "Last Claude response" : "Last Codex status";
    lines.push(`${prefix}: ${new Date(quota.updatedAt).toLocaleString()} | color=gray font=Menlo size=10`);
  }
  if (provider === "codex" && quota.context) {
    lines.push(`Latest context: ${percentLeft(quota.context.usedPercentage)}% left (${formatTokens(quota.context.usedTokens)} / ${formatTokens(quota.context.windowTokens)}) | font=Menlo size=11`);
  }
  return lines;
}

function usageDetails(provider, usage, config) {
  const label = labels[provider];
  if (!usage?.ok) {
    return [`Local estimates: ${sanitizeMenuText(usage?.error || "unavailable")} | color=gray`];
  }
  const lines = [
    `Local ${usage.periodLabel}: ${formatMoney(usage.cost, config.currency)} estimated / ${formatTokens(usage.tokens)} tokens`
  ];
  if (usage.todayTokens > 0) {
    lines.push(`Today: ${formatMoney(usage.todayCost, config.currency)} estimated / ${formatTokens(usage.todayTokens)} tokens | font=Menlo size=11`);
  }
  if (usage.budget) {
    lines.push(`Configured budget: ${usage.budget.usedPercent}% used, ${formatMoney(usage.budget.remaining, config.currency)} remaining | font=Menlo size=11`);
  }
  if (usage.models.length > 0) lines.push(`Models: ${sanitizeMenuText(usage.models.join(", "))} | length=90`);
  lines.push(`${label} token cost is an API-equivalent local estimate, not subscription billing | color=gray font=Menlo size=10`);
  return lines;
}

export function renderMenu({ config, quotas, usage, now = new Date(), forceCodexStatusScript }) {
  const providers = ["codex", "claude"].filter((provider) => config.providers[provider]);
  const lines = providers.map((provider, index) => {
    const suffix = index === 0 ? " | sfimage=chart.bar.xaxis" : " | dropdown=false";
    return `${providerTitle(provider, quotas[provider], usage[provider], now)}${suffix}`;
  });
  lines.push("---");

  for (const provider of providers) {
    lines.push(labels[provider]);
    lines.push(...quotaDetails(provider, quotas[provider], now));
    lines.push(...usageDetails(provider, usage[provider], config));
    const providerConfig = config[provider] || {};
    if (providerConfig.dashboardUrl) lines.push(`Open ${labels[provider]} usage | href=${providerConfig.dashboardUrl}`);
    if (provider === "codex" && config.codex.manualStatusRefresh && forceCodexStatusScript) {
      lines.push(`Refresh Codex status (uses one request) | bash=${JSON.stringify(forceCodexStatusScript)} terminal=false refresh=true`);
    }
    lines.push("---");
  }
  lines.push(`Updated: ${now.toLocaleString()} | color=gray`);
  lines.push("Refresh | refresh=true");
  return `${lines.join("\n")}\n`;
}
