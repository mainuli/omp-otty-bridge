# omp-otty-bridge

`omp-otty-bridge` is an OMP (`omp.sh`) extension for Otty users. It shows live OMP activity in the Otty tab or window title using stable OMP extension APIs.

## What It Does

- Shows when OMP is working, using a title such as `▶ π: project · bash`.
- Includes active tool names or compact state labels based on settings.
- Restores the base OMP title after the session returns to idle.
- Provides `/otty-status` diagnostics for detection, settings, backend, state, and the last emitted title.

## What It Does Not Do

- It does not provide native Otty badges, Otty notifications, or Otty history entries.
- It does not spoof Claude, Codex, OpenCode, or any other native Otty agent.
- It does not call private Otty IPC or rely on process-name detection.
- It is not published to npm in this release.

Native Otty parity requires a stable Otty custom-agent API or direct OMP support. This extension stays on stable public OMP APIs.

## Requirements

- OMP 16.3.4 or newer.
- Otty for default title output.
- Bun-compatible OMP plugin loading.

Outside Otty, output is disabled by default. You can opt into non-Otty title output with `nonOttyBehavior enabled`.

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
rm -f ~/.omp/plugins/node_modules/omp-otty-bridge
omp install github:mainuli/omp-otty-bridge
```

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
- whether output is enabled;
- selected backend;
- current bridge state;
- last emitted title;
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

If the title stays in a working state after OMP finishes, update to the latest GitHub version and restart OMP:

```bash
omp plugin uninstall omp-otty-bridge
rm -f ~/.omp/plugins/node_modules/omp-otty-bridge
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
