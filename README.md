# omp-otty-bridge

`omp-otty-bridge` is an OMP (`omp.sh`) extension for Otty users. It shows live OMP activity in direct Otty tab or window titles using stable OMP extension APIs.

## What It Does

- Shows live OMP state in a direct Otty title, such as `▶ π: project · bash`.
- Includes active tool names or compact state labels based on settings.
- Restores the base OMP title after the session returns to idle.
- Provides `/otty-status` diagnostics for topology, output decisions, settings, backend, state, and the last composed title.

## What It Does Not Do

- It does not provide native Otty badges, Otty notifications, or Otty history entries.
- It does not spoof Claude, Codex, OpenCode, or any other native Otty agent.
- It does not call private Otty IPC or rely on process-name detection.
- It does not call multiplexer APIs or provide per-pane routing or cross-process arbitration.
- It is not published to npm in this release.

Native Otty parity requires a stable Otty custom-agent API or direct OMP support. This extension stays on stable public OMP APIs.

## Requirements

- OMP 16.3.4 or newer.
- A direct Otty session for default title output.
- Bun-compatible OMP plugin loading.

Title output is suppressed by default inside tmux, Zellij, Herdr, and GNU screen, even when they inherit `TERM_PROGRAM=otty`. Output is also disabled outside Otty by default. Herdr always delegates OMP lifecycle display to its native integration.

## Install

Install from GitHub:

```bash
omp install github:mainuli/omp-otty-bridge
```

Restart OMP after installation so it loads the extension from `package.json#omp.extensions`.

OMP 16.3.4 supports `--scope project` only for marketplace installs. GitHub targets ignore `--scope project`, so use the global GitHub install above for normal use.

For local development, link a checkout:

```bash
omp plugin link .
```

To return from a linked development copy to the GitHub install:

```bash
omp plugin uninstall omp-otty-bridge
omp install github:mainuli/omp-otty-bridge
```

## Update

Re-run the install command to refresh an existing GitHub install:

```bash
omp install github:mainuli/omp-otty-bridge
```

OMP updates the installed GitHub revision; no uninstall is required. Restart OMP afterward to load the new version.

## Configuration

List settings:

```bash
omp plugin config list omp-otty-bridge
```

Use compact labels:

```bash
omp plugin config set omp-otty-bridge mode minimal
```

Allow title output outside Otty:

```bash
omp plugin config set omp-otty-bridge nonOttyBehavior enabled
```

Nested sessions in tmux, Zellij, Herdr, and GNU screen are suppressed by default. To allow best-effort title output inside tmux, Zellij, or GNU screen:

```bash
omp plugin config set omp-otty-bridge multiplexerBehavior enabled
```

This override does not apply to Herdr. It does not provide per-pane routing or cross-process arbitration, and it still requires `nonOttyBehavior enabled` when Otty is not detected.

Use OSC terminal-title output instead of OMP's UI title API:

```bash
omp plugin config set omp-otty-bridge backend osc-tty
```

The default backend is `ui-title`.

## Diagnostics

Inside OMP, run:

```text
/otty-status
```

The report shows:

- whether Otty was detected;
- normalized multiplexer names, or `none`;
- whether output is enabled and the exact output reason;
- selected backend;
- current bridge state;
- last composed title, including while output is suppressed;
- bridge settings;
- relevant terminal environment values.

## Troubleshooting

Confirm OMP is running inside Otty:

```bash
echo "$TERM_PROGRAM"
```

Expected value:

```text
otty
```

Confirm the plugin is installed and enabled:

```bash
omp plugin list
omp plugin config list omp-otty-bridge
```

If `/otty-status` is missing, restart OMP. If it is still missing, OMP did not load the extension.

In a Herdr pane, the bridge intentionally delegates title ownership. Install Herdr's native OMP lifecycle integration if it is not already present:

```bash
herdr integration install omp
```

If the title stays in a working state after OMP finishes, update to the latest GitHub version and restart OMP:

```bash
omp install github:mainuli/omp-otty-bridge
```

## Development

```bash
bun install
bun test
bun run typecheck
omp plugin link .
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and release checks.

## Validation

See [docs/validation.md](docs/validation.md) for automated checks and the manual Otty smoke test.

## License

MIT
