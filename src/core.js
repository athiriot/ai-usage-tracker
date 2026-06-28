export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function cycleBounds(startDay, now = new Date()) {
  const day = Math.min(startDay, daysInMonth(now.getFullYear(), now.getMonth()));
  let start = new Date(now.getFullYear(), now.getMonth(), day);
  if (now < start) {
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    start = new Date(
      previous.getFullYear(),
      previous.getMonth(),
      Math.min(startDay, daysInMonth(previous.getFullYear(), previous.getMonth()))
    );
  }
  const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const nextDay = Math.min(startDay, daysInMonth(nextMonth.getFullYear(), nextMonth.getMonth()));
  const next = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay);
  const end = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
  return { start: dateKey(start), end: dateKey(end), label: `${dateKey(start)} to ${dateKey(end)}` };
}

export function percentLeft(usedPercentage) {
  return Math.max(0, Math.min(100, Math.round(100 - Number(usedPercentage || 0))));
}

export function quotaWindow(window, now = new Date()) {
  if (!window || !Number.isFinite(Number(window.usedPercentage))) return null;
  const resetMs = Number(window.resetsAt || 0) * 1000;
  const expired = resetMs > 0 && resetMs <= now.getTime();
  return {
    expired,
    left: expired ? 100 : percentLeft(window.usedPercentage),
    label: expired ? "100% est." : `${percentLeft(window.usedPercentage)}%`,
    resetText: expired ? "reset passed; awaiting a fresh provider update" : formatReset(window.resetsAt)
  };
}

export function formatReset(epochSeconds) {
  if (!epochSeconds) return "reset unknown";
  return `resets ${new Date(Number(epochSeconds) * 1000).toLocaleString()}`;
}

export function formatMoney(value, currency = "USD") {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: numeric >= 10 ? 0 : 2
  }).format(numeric);
}

export function formatTokens(value) {
  const numeric = Number(value || 0);
  if (numeric >= 1_000_000_000) return `${(numeric / 1_000_000_000).toFixed(1)}B`;
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`;
  if (numeric >= 1_000) return `${Math.round(numeric / 1_000)}k`;
  return String(numeric);
}

export function sanitizeMenuText(value, limit = 180) {
  return String(value || "").replaceAll("\n", " ").replaceAll("|", "-").slice(0, limit);
}
