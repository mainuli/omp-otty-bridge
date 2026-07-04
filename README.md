# omp-otty-bridge

`omp-otty-bridge` is an OMP (`omp.sh`) extension for Otty users. It uses stable OMP extension APIs to surface OMP and agent activity in the Otty tab or window title without depending on private Otty internals.

## What It Does

- Shows OMP and agent state in the Otty tab/window title while OMP is working.
- Uses titles like `▶ π: project · bash` by default, combining state, base session title, and active tool or activity.
- Restores the base title when OMP returns to idle or shuts down.
- Provides `/otty-status` diagnostics for terminal detection, settings, backend, output state, and the last emitted title.

## What It Does Not Do

- It does not provide native Otty badges, notifications, or history entries.
- It does not spoof Claude, Codex, OpenCode, or any other native Otty agent integration.
- It does not use private Otty IPC or process-name detection.
- Native Otty parity requires a stable Otty custom-agent API or direct OMP support.

## Requirements

- OMP 16.3.4 or newer.
- Otty for default activation. Outside Otty, title output is suppressed unless `nonOttyBehavior` is enabled.
- Bun-compatible OMP plugin loading.

## Install

Install globally:

```bash
omp install github:mainuli/omp-otty-bridge
```

Install for the current project:

```bash
omp install github:mainuli/omp-otty-bridge --scope project
```

Restart OMP after installation so the extension is loaded from `package.json#omp.extensions`.

## Configuration

List available settings:

```bash
omp plugin config list omp-otty-bridge
```

Use compact state labels:

```bash
omp plugin config set omp-otty-bridge mode minimal
```

Allow title output outside Otty:

```bash
omp plugin config set omp-otty-bridge nonOttyBehavior enabled
```

## Diagnostics

Run this inside OMP:

```text
/otty-status
```

The diagnostic report shows whether Otty was detected, whether output is enabled, the selected backend, current state, last emitted title, and relevant terminal environment values.

## Troubleshooting

1. Confirm OMP is running inside Otty:

   ```bash
   echo "$TERM_PROGRAM"
   ```

   Expected value: `otty`.

2. Confirm the plugin is enabled:

   ```bash
   omp plugin config list omp-otty-bridge
   ```

   Check that `enabled` is `true`.

3. Confirm the backend is `ui-title`:

   ```bash
   omp plugin config list omp-otty-bridge
   ```

   The default backend should be `ui-title`.

4. Run `/otty-status` before and after a prompt that triggers a tool call. If the command is missing, OMP did not load the extension from `package.json#omp.extensions`.

5. Follow the validation steps in [docs/release-checklist.md](docs/release-checklist.md), including the manual Otty smoke test from a real Otty session. Do not mark Otty-specific checks as passing from a non-Otty shell.

## Development

```bash
bun install
bun test
bun run typecheck
omp plugin link .
```

## License

MIT
