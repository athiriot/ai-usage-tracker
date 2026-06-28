import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("capture helper stores quota and preserves an existing status line", () => {
  const root = mkdtempSync(join(tmpdir(), "ai-usage-capture-"));
  const configDir = join(root, "config");
  const cacheDir = join(root, "cache");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, "claude-statusline-backup.json"), JSON.stringify({
    hadStatusLine: true,
    statusLine: { type: "command", command: "/bin/cat" }
  }));
  const input = readFileSync(new URL("fixtures/claude-status.json", import.meta.url), "utf8");
  const result = spawnSync(process.execPath, [new URL("../scripts/claude-status-capture.js", import.meta.url).pathname], {
    input,
    encoding: "utf8",
    env: { ...process.env, AI_USAGE_CONFIG_DIR: configDir, AI_USAGE_CACHE_DIR: cacheDir }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).version, "2.1.80");
  const cached = JSON.parse(readFileSync(join(cacheDir, "claude-quota.json"), "utf8"));
  assert.equal(cached.fiveHour.usedPercentage, 22);
  assert.deepEqual(Object.keys(cached).sort(), ["claudeVersion", "fiveHour", "provider", "updatedAt", "version", "weekly"]);
});
