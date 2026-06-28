# AI Usage Tracker

A local macOS menu-bar tracker for Codex and Claude Code. It uses
[SwiftBar](https://github.com/swiftbar/SwiftBar) for the menu and
[ccusage](https://ccusage.com/guide/getting-started) for local token and estimated-cost history.

Choose Codex, Claude Pro/Max, or both during installation. When both are enabled,
SwiftBar rotates a compact quota title for each provider.

## What It Shows

### Codex

- Latest 5-hour and weekly quota percentages recorded by Codex CLI
- Reset times and latest session context usage
- Local daily and billing-period tokens and API-equivalent estimated cost
- An explicit manual refresh action that uses one Codex request

### Claude Pro/Max

- Latest 5-hour and 7-day quota percentages supplied by Claude Code
- Reset times and the time of the last Claude response that updated the data
- Local daily and billing-period tokens and API-equivalent estimated cost

Claude quota uses the documented `rate_limits` fields provided to a Claude Code
status-line command. It does not read credentials or call an undocumented endpoint.
See [Claude Code status-line data](https://code.claude.com/docs/en/statusline).

## Requirements

- macOS 11 or newer
- Node.js 20 or newer
- SwiftBar 2 or newer
- Codex CLI and/or Claude Code 2.1.80 or newer

Install SwiftBar with Homebrew if needed:

```sh
brew install swiftbar
```

## Install

```sh
git clone https://github.com/athiriot/ai-usage-tracker.git
cd ai-usage-tracker
./install.sh
```

The installer asks whether to enable Codex, Claude, or both. For unattended setup:

```sh
./install.sh --providers codex --yes
./install.sh --providers claude --yes
./install.sh --providers codex,claude --yes
```

If SwiftBar uses a nonstandard plugin folder, pass it explicitly:

```sh
./install.sh --providers codex,claude --plugin-dir "$HOME/path/to/plugins"
```

Installation:

1. Installs locked npm dependencies.
2. Links the plugin into SwiftBar's configured plugin directory.
3. Writes user settings to `~/.config/ai-usage-tracker/config.json`.
4. Adds a reversible Claude status-line wrapper when Claude is selected.
5. Registers a LaunchAgent that opens SwiftBar at login.

## Claude Status-Line Integration

Claude Code sends quota data to local status-line commands after normal responses.
The installer preserves an existing status-line configuration and chains its command
after recording the quota fields. Only these values are cached:

- 5-hour percentage and reset time
- 7-day percentage and reset time
- Claude Code version and update time

The cache is `~/Library/Caches/ai-usage-tracker/claude-quota.json`. Quota data can
be stale if Claude has not produced a response recently or usage occurred on another
device. The menu shows the source timestamp and marks windows whose reset time passed
as estimates until a fresh provider update arrives.

Restart Claude Code after installation so it loads the status-line command. Claude may
ask you to accept its normal local-command trust prompt. If the repository is moved,
rerun `./install.sh` so SwiftBar and Claude receive the new paths.

## Configuration

Edit `~/.config/ai-usage-tracker/config.json` to change enabled providers, billing-cycle
start day, links, or optional monthly budgets. The tracked
[`config.example.json`](config.example.json) lists every setting.

Monthly budgets only compare a user-entered budget with local API-equivalent cost
estimates. They are not subscription limits, invoices, or account balances.

## Privacy And Network Behavior

- Usage parsing happens locally.
- No prompts, source code, session identifiers, cookies, or authentication tokens are cached.
- The Claude quota helper does not make a network request.
- The Codex manual refresh action sends the labeled minimal request only when clicked.
- `npm ci` downloads dependencies during installation.
- Menu dashboard links open the providers' official usage pages when clicked.

## Uninstall

```sh
./uninstall.sh
```

This removes the SwiftBar link and LaunchAgent and restores the previous Claude
status line. It retains local configuration and cache for a later reinstall.

To remove those files too:

```sh
./uninstall.sh --purge
```

## Development

```sh
npm ci
npm test
npm run check
npm run menu
```

The project intentionally treats local cost as an estimate and quota percentages as
provider status. These data sources are displayed separately and are never combined
to infer subscription allowance.

## License

[MIT](LICENSE)
