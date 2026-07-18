# Validation

This document lists the checks for `omp-otty-bridge`.

## Automated Checks

Run from the repository root:

```bash
bun test
bun run typecheck
```

Expected result:

- all tests pass;
- TypeScript exits with status 0.

## OMP Import Surface Checks

Run:

```bash
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/extensions").then(() => console.log("extensions export ok"))'
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/plugins").then((m) => console.log(typeof m.getPluginSettings))'
```

Expected output:

```text
extensions export ok
function
```

## GitHub Install Check

Confirm `--dry-run` support:

```bash
omp install --help | grep -- '--dry-run'
```

If the command prints `--dry-run`, then after the release commit is pushed to `main`, run:

```bash
omp install github:mainuli/omp-otty-bridge --dry-run
```

Expected: command exits 0 and reports that OMP would install `github:mainuli/omp-otty-bridge`.

If the installed OMP version does not support `--dry-run`, use an isolated temporary home instead of the real OMP plugin directory:

```bash
tmp_home=$(mktemp -d)
HOME="$tmp_home" omp install github:mainuli/omp-otty-bridge
HOME="$tmp_home" omp plugin list --json
rm -rf "$tmp_home"
```

Expected: the isolated plugin list contains `omp-otty-bridge`.

OMP 16.3.4 supports `--scope project` only for marketplace installs. GitHub targets ignore `--scope project`; use `omp plugin link .` for project-local development.

## Manual Otty Smoke Test

Last recorded runtime Otty smoke test:

- Date: 2026-07-05
- Runtime commit: `2f77fe4`
- Install source: `github:mainuli/omp-otty-bridge`
- Source: user-confirmed real Otty session during development
- Result: pass

Observed behavior:

- Otty detected: yes
- Backend: `ui-title`
- Output enabled: yes
- Title changed to a working state during OMP activity
- Title restored to the base title after OMP returned to idle
- `/otty-status` reported expected settings and state

Repeat the manual smoke tests after changes to files under `src/`, `test/`, or `package.json#omp`.

### Direct Otty

From the repository root in a direct Otty shell:

1. Run:

   ```bash
   omp --no-extensions --extension ./src/index.ts
   ```

2. Inside OMP, run `/otty-status` and confirm these exact lines:

   ```text
   Otty detected: yes
   Multiplexers: none
   Output enabled: yes
   Output reason: direct-otty
   ```

3. Send a prompt that triggers at least one tool call. Confirm the Otty title enters the active state and restores after OMP returns to idle.

4. Run `/otty-status` again and confirm the state is idle.

### Default Multiplexer Suppression

Run each available check from a direct Otty shell. Inside each multiplexer, start OMP with `omp --no-extensions --extension ./src/index.ts`, invoke `/otty-status`, and trigger a tool call.

1. Start tmux:

   ```bash
   tmux new-session -s omp-otty-bridge-smoke-$$
   ```

   Expected status lines:

   ```text
   Multiplexers: tmux
   Output enabled: no
   Output reason: multiplexer-disabled
   ```

   The outer Otty title must not change. Exit OMP and tmux normally.

2. Start GNU screen:

   ```bash
   screen -S omp-otty-bridge-smoke-$$
   ```

   Expected status lines:

   ```text
   Multiplexers: screen
   Output enabled: no
   Output reason: multiplexer-disabled
   ```

   The outer Otty title must not change. Exit OMP and screen normally.

3. In a Herdr pane, expect:

   ```text
   Multiplexers: herdr
   Output enabled: no
   Output reason: delegated-to-herdr
   ```

   The bridge must not change the terminal title. Herdr owns lifecycle display through its native integration; if it is absent, install it with `herdr integration install omp` rather than enabling bridge output.

4. If `command -v zellij` succeeds, repeat the suppression check in Zellij and expect:

   ```text
   Multiplexers: zellij
   Output enabled: no
   Output reason: multiplexer-disabled
   ```

   If Zellij is unavailable, skip this manual check; do not install it solely for validation.

## Release Maintainer Checklist

- [ ] `bun test`
- [ ] `bun run typecheck`
- [ ] OMP import surface checks
- [ ] GitHub install dry run after merge to `main`
- [ ] Manual Otty smoke test when runtime behavior changes
- [ ] GitHub Actions CI passes on the release PR
- [ ] Repository metadata is current: description `OMP extension that shows live OMP state in direct Otty tab titles.`, homepage `https://github.com/mainuli/omp-otty-bridge#readme`, topics `omp`, `omp-sh`, `otty`, `terminal`, `extension`
- [ ] `LICENSE` matches `package.json#license`
