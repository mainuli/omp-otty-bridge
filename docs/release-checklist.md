# Release Checklist

## Automated Checks

- [ ] Unit tests:

  ```bash
  bun test
  ```

- [ ] TypeScript compile check:

  ```bash
  bun run typecheck
  ```

- [ ] OMP extension export check:

  ```bash
  bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/extensions").then(() => console.log("extensions export ok"))'
  ```

  Record `pass` only if the command prints `extensions export ok`.

- [ ] OMP plugins export check:

  ```bash
  bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/plugins").then((m) => console.log(typeof m.getPluginSettings))'
  ```

  Record `pass` only if the command prints `function`.

- [ ] Local plugin link check:

  ```bash
  omp plugin link .
  ```

- [ ] Public GitHub install dry run:

  ```bash
  omp install github:mainuli/omp-otty-bridge --dry-run
  ```

## Compatibility Spike

- OMP version target: 16.3.4
- OMP version tested: pending
- Extension import surface: pending; run the OMP extension export check above.
- Plugin settings import surface: pending; run the OMP plugins export check above.
- Otty title API: pending; not run from this non-Otty shell.
- Base title API: pending; not run from this non-Otty shell.
- Idle API: pending; not run from this non-Otty shell.
- Notify API: pending; not run from this non-Otty shell.
- Context cwd API: pending; not run from this non-Otty shell.
- Primary backend for v1: `ui-title`, pending real Otty smoke validation.
- Compatibility notes: pending. Otty title, base title, idle, notify, and cwd behavior must be verified from a real Otty session before release.

To complete this section from an Otty tab:

1. Confirm OMP 16.3.4 or newer is active:

   ```bash
   omp --version
   ```

   Fill `OMP version tested` with the exact version.

2. Run the OMP extension and plugins export checks from `Automated Checks`.

3. Link or install the plugin, start OMP inside Otty, and run `/otty-status` before the first prompt. Confirm the linked plugin loaded from `package.json#omp.extensions`.

4. Send a prompt that triggers at least one tool call. If the Otty tab or window title changes through `ctx.ui.setTitle()`, mark `Otty title API` as `pass`.

5. Let OMP return to idle. If the original/base title is restored, mark `Base title API` and `Idle API` as `pass`.

6. Run `/otty-status`. If OMP shows the status notification, mark `Notify API` as `pass`. If it reports the expected working directory, mark `Context cwd API` as `pass`.

7. If every Otty and import check passes, keep `Primary backend for v1` as `ui-title` and set `Compatibility notes` to:

   ```text
   `ctx.ui.setTitle()` updates the Otty tab title; `ctx.sessionManager.getSessionName()`, `ctx.isIdle()`, `ctx.ui.notify()`, and `ctx.cwd` are available; `getPluginSettings(pluginName, cwd)` is exported.
   ```

8. If `ctx.ui.setTitle()` does not update the Otty tab title, set `Primary backend for v1` to `osc-tty` and set `Compatibility notes` to:

   ```text
   `ctx.ui.setTitle()` did not update Otty; v1 uses the `osc-tty` fallback backend after OSC safety tests pass.
   ```

## Manual Otty Smoke Test

Manual Otty smoke test status: pending; not run from this non-Otty shell. Complete these checks only from a real Otty session.

- [ ] Install from GitHub or link the local plugin:

  ```bash
  omp install github:mainuli/omp-otty-bridge
  # or
  omp plugin link .
  ```

- [ ] Start OMP inside Otty.
- [ ] Run `/otty-status` before the first prompt and confirm the linked plugin loaded from `package.json#omp.extensions`.
- [ ] Send a prompt that triggers at least one tool call.
- [ ] Confirm the tab/window title changes to an active title like `▶ π: project · bash`.
- [ ] Trigger `/otty-status`.
- [ ] Confirm the diagnostic command reports Otty detected, backend `ui-title`, and output enabled.
- [ ] Let OMP return to idle.
- [ ] Confirm the tab/window title restores to the base title.
