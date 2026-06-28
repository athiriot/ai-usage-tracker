import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { defaultConfig } from "./config.js";
import {
  cacheDir,
  claudeHome,
  claudeStatusBackupPath,
  configDir,
  configPath,
  installStatePath,
  projectRoot
} from "./paths.js";
import { writeJsonAtomic } from "./claude.js";

export const launchAgentLabel = "com.athiriot.ai-usage-tracker.swiftbar";
const captureMarker = "claude-status-capture.js";

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options });
}

function commandPath(command) {
  const result = run("/usr/bin/which", [command]);
  return result.status === 0 ? result.stdout.trim() : null;
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function entryExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function parseProviders(value) {
  const normalized = String(value || "").toLowerCase().replaceAll(" ", "");
  if (normalized === "both") return ["codex", "claude"];
  const providers = [...new Set(normalized.split(",").filter(Boolean))];
  if (providers.length === 0 || providers.some((provider) => !["codex", "claude"].includes(provider))) {
    throw new Error("Providers must be codex, claude, or codex,claude");
  }
  return providers;
}

export function parseInstallArgs(argv) {
  const options = { providers: null, pluginDir: null, yes: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--providers") options.providers = parseProviders(argv[++index]);
    else if (arg === "--plugin-dir") options.pluginDir = resolve(argv[++index]);
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

async function chooseProviders(options) {
  if (options.providers) return options.providers;
  if (!process.stdin.isTTY) throw new Error("Use --providers when running non-interactively");
  const prompt = createInterface({ input, output });
  try {
    output.write("Choose providers:\n  1) Codex\n  2) Claude Pro/Max\n  3) Both\n");
    const answer = (await prompt.question("Selection [1]: ")).trim() || "1";
    if (answer === "1") return ["codex"];
    if (answer === "2") return ["claude"];
    if (answer === "3") return ["codex", "claude"];
    throw new Error("Selection must be 1, 2, or 3");
  } finally {
    prompt.close();
  }
}

function configuredPluginDir(env) {
  if (env.SWIFTBAR_PLUGIN_DIR) return resolve(env.SWIFTBAR_PLUGIN_DIR);
  const result = run("/usr/bin/defaults", ["read", "com.ameba.SwiftBar", "PluginDirectory"]);
  if (result.status === 0 && result.stdout.trim()) return resolve(result.stdout.trim());
  return join(env.HOME, "Library", "Application Support", "SwiftBar", "Plugins");
}

async function ensureSwiftBar(options, env) {
  if (env.AI_USAGE_SKIP_PREREQUISITES === "1") return;
  const candidates = ["/Applications/SwiftBar.app", join(env.HOME, "Applications", "SwiftBar.app")];
  if (candidates.some(existsSync)) return;
  const brew = commandPath("brew");
  if (!brew) throw new Error("SwiftBar is required. Install it from https://github.com/swiftbar/SwiftBar");
  let approved = options.yes;
  if (!approved && process.stdin.isTTY) {
    const prompt = createInterface({ input, output });
    try {
      approved = /^y(es)?$/i.test((await prompt.question("SwiftBar is missing. Install it with Homebrew? [Y/n] ")).trim() || "y");
    } finally {
      prompt.close();
    }
  }
  if (!approved) throw new Error("SwiftBar is required before installation can continue");
  const result = run(brew, ["install", "swiftbar"], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Homebrew could not install SwiftBar");
}

function installDependencies(env) {
  if (env.AI_USAGE_SKIP_NPM === "1") return;
  const npm = commandPath("npm");
  if (!npm) throw new Error("npm is required; install Node.js 20 or newer");
  const result = run(npm, ["ci"], { cwd: projectRoot, stdio: "inherit" });
  if (result.status !== 0) throw new Error("npm ci failed");
}

function installPlugin(pluginDirectory) {
  mkdirSync(pluginDirectory, { recursive: true });
  const source = join(projectRoot, "plugins", "ai-usage-tracker.5m.sh");
  const target = join(pluginDirectory, "ai-usage-tracker.5m.sh");
  chmodSync(source, 0o755);
  let backupPath = null;
  if (entryExists(target)) {
    const current = lstatSync(target);
    if (current.isSymbolicLink() && resolve(dirname(target), readlinkSync(target)) === source) {
      return { source, target, backupPath };
    }
    backupPath = `${target}.backup-${Date.now()}`;
    renameSync(target, backupPath);
  }
  symlinkSync(source, target);
  return { source, target, backupPath };
}

function removeLegacyProjectPlugin(pluginDirectory) {
  const legacyTarget = join(pluginDirectory, "ai-usage.5m.sh");
  if (!entryExists(legacyTarget) || !lstatSync(legacyTarget).isSymbolicLink()) return false;
  const linkTarget = resolve(dirname(legacyTarget), readlinkSync(legacyTarget));
  const projectPluginDirectory = join(projectRoot, "plugins");
  if (dirname(linkTarget) !== projectPluginDirectory) return false;
  if (!["ai-usage.5m.sh", "ai-usage-tracker.5m.sh"].includes(basename(linkTarget))) return false;
  rmSync(legacyTarget);
  return true;
}

function writeUserConfig(providers, env) {
  const path = configPath(env);
  const current = readJson(path, {});
  const value = {
    ...defaultConfig,
    ...current,
    providers: {
      codex: providers.includes("codex"),
      claude: providers.includes("claude")
    },
    monthlyBudgetsUsd: { ...defaultConfig.monthlyBudgetsUsd, ...(current.monthlyBudgetsUsd || {}) },
    codex: { ...defaultConfig.codex, ...(current.codex || {}) },
    claude: { ...defaultConfig.claude, ...(current.claude || {}) }
  };
  writeJsonAtomic(path, value);
  return path;
}

export function installClaudeStatusLine(nodePath, env = process.env) {
  const settingsPath = join(claudeHome(env), "settings.json");
  const settings = readJson(settingsPath, {});
  const current = settings.statusLine;
  const currentCommand = current?.command || "";
  const backupPath = claudeStatusBackupPath(env);
  if (!currentCommand.includes(captureMarker) && !existsSync(backupPath)) {
    writeJsonAtomic(backupPath, { hadStatusLine: Boolean(current), statusLine: current || null });
  }

  const command = [
    `AI_USAGE_CONFIG_DIR=${shellQuote(configDir(env))}`,
    `AI_USAGE_CACHE_DIR=${shellQuote(cacheDir(env))}`,
    shellQuote(nodePath),
    shellQuote(join(projectRoot, "scripts", captureMarker))
  ].join(" ");
  settings.statusLine = { ...(current || {}), type: "command", command };
  writeJsonAtomic(settingsPath, settings);
  return { settingsPath, backupPath, command };
}

export function restoreClaudeStatusLine(env = process.env) {
  const settingsPath = join(claudeHome(env), "settings.json");
  const backupPath = claudeStatusBackupPath(env);
  if (!existsSync(settingsPath) || !existsSync(backupPath)) return false;
  const settings = readJson(settingsPath, {});
  if (!String(settings.statusLine?.command || "").includes(captureMarker)) return false;
  const backup = readJson(backupPath, null);
  if (backup?.hadStatusLine) settings.statusLine = backup.statusLine;
  else delete settings.statusLine;
  writeJsonAtomic(settingsPath, settings);
  rmSync(backupPath, { force: true });
  return true;
}

function launchAgentPath(env) {
  return join(env.HOME, "Library", "LaunchAgents", `${launchAgentLabel}.plist`);
}

function installLaunchAgent(env) {
  const path = launchAgentPath(env);
  mkdirSync(dirname(path), { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>Label</key>\n  <string>${launchAgentLabel}</string>\n  <key>ProgramArguments</key>\n  <array>\n    <string>/usr/bin/open</string>\n    <string>-a</string>\n    <string>SwiftBar</string>\n  </array>\n  <key>RunAtLoad</key>\n  <true/>\n</dict>\n</plist>\n`;
  writeFileSync(path, plist);
  if (env.AI_USAGE_SKIP_LAUNCH !== "1") {
    const domain = `gui/${process.getuid()}`;
    run("/bin/launchctl", ["bootout", `${domain}/${launchAgentLabel}`]);
    const bootstrap = run("/bin/launchctl", ["bootstrap", domain, path]);
    if (bootstrap.status !== 0) throw new Error(`Could not register login agent: ${bootstrap.stderr.trim()}`);
    run("/bin/launchctl", ["kickstart", `${domain}/${launchAgentLabel}`]);
    run("/usr/bin/open", ["-a", "SwiftBar"]);
  }
  return path;
}

function providerWarnings(providers) {
  if (providers.includes("codex") && !commandPath("codex")) {
    console.warn("Warning: Codex CLI is not currently in PATH; quota appears after Codex creates local session data.");
  }
  if (providers.includes("claude") && !commandPath("claude")) {
    console.warn("Warning: Claude Code is not currently in PATH; live quota requires Claude Code 2.1.80 or newer.");
  }
}

export async function install(argv = process.argv.slice(2), env = process.env) {
  if (process.platform !== "darwin" && env.AI_USAGE_ALLOW_NON_DARWIN !== "1") {
    throw new Error("AI Usage Tracker currently supports macOS only");
  }
  const options = parseInstallArgs(argv);
  if (options.help) return { help: true };
  if (Number(process.versions.node.split(".")[0]) < 20) throw new Error("Node.js 20 or newer is required");
  const providers = await chooseProviders(options);
  await ensureSwiftBar(options, env);
  installDependencies(env);
  const pluginDirectory = options.pluginDir || configuredPluginDir(env);
  removeLegacyProjectPlugin(pluginDirectory);
  const plugin = installPlugin(pluginDirectory);
  const userConfigPath = writeUserConfig(providers, env);
  const nodePath = process.execPath;
  if (providers.includes("claude")) installClaudeStatusLine(nodePath, env);
  else restoreClaudeStatusLine(env);
  const agentPath = installLaunchAgent(env);
  const previousState = readJson(installStatePath(env), {});
  const state = {
    version: 1,
    installedAt: new Date().toISOString(),
    projectRoot,
    providers,
    pluginPath: plugin.target,
    pluginSource: plugin.source,
    pluginBackupPath: plugin.backupPath || previousState.pluginBackupPath || null,
    pluginBackupTargetPath: plugin.backupPath
      ? plugin.target
      : previousState.pluginBackupTargetPath || (previousState.pluginBackupPath ? previousState.pluginPath : null),
    launchAgentPath: agentPath
  };
  writeJsonAtomic(installStatePath(env), state);
  providerWarnings(providers);
  return { providers, pluginPath: plugin.target, configPath: userConfigPath, launchAgentPath: agentPath };
}

export function uninstall({ purge = false } = {}, env = process.env) {
  const statePath = installStatePath(env);
  const state = readJson(statePath, {});
  const restoredClaudeStatusLine = restoreClaudeStatusLine(env);

  if (state.pluginPath && existsSync(state.pluginPath)) {
    const entry = lstatSync(state.pluginPath);
    const pointsToProject = entry.isSymbolicLink()
      && resolve(dirname(state.pluginPath), readlinkSync(state.pluginPath)) === state.pluginSource;
    if (pointsToProject) rmSync(state.pluginPath);
  }
  const backupTarget = state.pluginBackupTargetPath || state.pluginPath;
  if (state.pluginBackupPath && existsSync(state.pluginBackupPath) && backupTarget && !entryExists(backupTarget)) {
    renameSync(state.pluginBackupPath, backupTarget);
  }

  const agentPath = state.launchAgentPath || launchAgentPath(env);
  if (env.AI_USAGE_SKIP_LAUNCH !== "1") {
    run("/bin/launchctl", ["bootout", `gui/${process.getuid()}/${launchAgentLabel}`]);
  }
  if (existsSync(agentPath)) rmSync(agentPath);
  if (existsSync(statePath)) rmSync(statePath);
  if (purge) {
    rmSync(configDir(env), { recursive: true, force: true });
    rmSync(cacheDir(env), { recursive: true, force: true });
  }
  return { restoredClaudeStatusLine, purged: purge };
}
