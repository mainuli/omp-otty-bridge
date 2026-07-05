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

This public-release polish does not change runtime files. Repeat the manual Otty smoke test when files under `src/`, `test/`, or `package.json#omp` change.

To repeat the smoke test:

1. Install from GitHub:

   ```bash
   omp install github:mainuli/omp-otty-bridge
   ```

2. Restart OMP inside Otty.

3. Run:

   ```text
   /otty-status
   ```

4. Confirm:

   - `Otty detected: yes`
   - `Output enabled: yes`
   - `Backend: ui-title`

5. Send a prompt that triggers at least one tool call.

6. Confirm the Otty tab or window title changes to an active title.

7. Wait for OMP to return to idle.

8. Confirm the title restores to the base OMP title.

9. Run `/otty-status` again and confirm the state is idle.

## Release Maintainer Checklist

- [ ] `bun test`
- [ ] `bun run typecheck`
- [ ] OMP import surface checks
- [ ] GitHub install dry run after merge to `main`
- [ ] Manual Otty smoke test when runtime behavior changes
- [ ] GitHub Actions CI passes on the release PR
- [ ] Repository metadata is current
- [ ] `LICENSE` matches `package.json#license`
