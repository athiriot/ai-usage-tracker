import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("installer supports both providers and uninstall restores Claude settings", () => {
  const home = mkdtempSync(join(tmpdir(), "ai-usage-install-"));
  const plugins = join(home, "swiftbar-plugins");
  const claudeDir = join(home, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  const original = { type: "command", command: "/bin/cat", padding: 2 };
  writeFileSync(join(claudeDir, "settings.json"), `${JSON.stringify({ statusLine: original }, null, 2)}\n`);
  const env = {
    ...process.env,
    HOME: home,
    AI_USAGE_SKIP_NPM: "1",
    AI_USAGE_SKIP_LAUNCH: "1",
    AI_USAGE_SKIP_PREREQUISITES: "1"
  };
  const install = spawnSync(process.execPath, [
    new URL("../scripts/install.mjs", import.meta.url).pathname,
    "--providers", "codex,claude",
    "--plugin-dir", plugins,
    "--yes"
  ], { encoding: "utf8", env });
  assert.equal(install.status, 0, install.stderr);

  const plugin = join(plugins, "ai-usage.5m.sh");
  assert.equal(lstatSync(plugin).isSymbolicLink(), true);
  const config = JSON.parse(readFileSync(join(home, ".config", "ai-usage-tracker", "config.json"), "utf8"));
  assert.deepEqual(config.providers, { codex: true, claude: true });
  const installedSettings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf8"));
  assert.match(installedSettings.statusLine.command, /claude-status-capture\.js/);
  assert.equal(installedSettings.statusLine.padding, 2);

  const menu = spawnSync(plugin, [], { encoding: "utf8", env });
  assert.equal(menu.status, 0, menu.stderr);
  assert.match(menu.stdout, /^Codex waiting for usage/);
  assert.match(menu.stdout, /Claude waiting for usage/);

  const reinstall = spawnSync(process.execPath, [
    new URL("../scripts/install.mjs", import.meta.url).pathname,
    "--providers", "codex,claude",
    "--plugin-dir", plugins,
    "--yes"
  ], { encoding: "utf8", env });
  assert.equal(reinstall.status, 0, reinstall.stderr);
  const preservedBackup = JSON.parse(readFileSync(join(home, ".config", "ai-usage-tracker", "claude-statusline-backup.json"), "utf8"));
  assert.deepEqual(preservedBackup.statusLine, original);

  const uninstall = spawnSync(process.execPath, [new URL("../scripts/uninstall.mjs", import.meta.url).pathname], {
    encoding: "utf8",
    env
  });
  assert.equal(uninstall.status, 0, uninstall.stderr);
  assert.equal(existsSync(plugin), false);
  const restored = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf8"));
  assert.deepEqual(restored.statusLine, original);
});
