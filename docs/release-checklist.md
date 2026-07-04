# Release Checklist

## Automated Checks

- [ ] TypeScript compile check: not run in Task 1; dependencies are intentionally not installed yet.
- [ ] Unit tests: not run in Task 1; no test scaffold exists yet.
- [ ] Extension import surface: pending; after dependencies are installed, run:

  ```bash
  bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/extensions").then(() => console.log("extensions export ok"))'
  ```

  Record `pass` only if the command prints `extensions export ok`.
- [ ] Plugin settings import surface: pending; after dependencies are installed, run:

  ```bash
  bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/plugins").then((m) => console.log(typeof m.getPluginSettings))'
  ```

  Record `pass` only if the command prints `function`.

## Compatibility Spike

- OMP version target: 16.3.4
- OMP version tested: pending
- Extension import surface: pending
- Plugin settings import surface: pending
- Otty title API: not run
- Base title API: not run
- Idle API: not run
- Notify API: not run
- Context cwd API: not run
- Primary backend for v1: pending Otty smoke test; expected `ui-title` if `ctx.ui.setTitle()` updates the Otty tab title.
- Compatibility notes: pending. This shell is not inside Otty, so the title API, base title API, idle API, notify API, context cwd API, and import surfaces have not been verified.

To complete this section from an Otty tab:

1. Confirm OMP 16.3.4 is active:

   ```bash
   omp --version
   ```

   Fill `OMP version tested` with the exact version.
2. Run the spike extension from inside Otty:

   ```bash
   omp -e spikes/title-api/index.ts "Run the Otty title API spike and then stop."
   ```

   If the Otty tab title changes to `omp-otty-bridge-smoke`, change `Otty title API` to `pass`.
3. Check the OMP logs for `omp-otty-bridge title API spike`.
   If the log includes a non-empty `baseTitle`, change `Base title API` to `pass`.
   If it includes `isIdle`, change `Idle API` to `pass`.
   If it includes the expected working directory in `cwd`, change `Context cwd API` to `pass`.
4. In the same OMP session, run:

   ```text
   /otty-title-spike
   ```

   If OMP shows an info notification containing `Otty title spike ran`, change `Notify API` to `pass`.
5. After dependencies are installed in a later task, run the two import checks from `Automated Checks`.
   Change the import surface lines to `pass` only after those exact commands produce the expected output.
6. If every Otty and import check passes, set `Primary backend for v1` to `ui-title` and set `Compatibility notes` to:

   ```text
   `ctx.ui.setTitle()` updates the Otty tab title; `ctx.sessionManager.getSessionName()`, `ctx.isIdle()`, `ctx.ui.notify()`, and `ctx.cwd` are available; `getPluginSettings(pluginName, cwd)` is exported.
   ```

7. If `ctx.ui.setTitle()` does not update the Otty tab title, set `Primary backend for v1` to `osc-tty` and set `Compatibility notes` to:

   ```text
   `ctx.ui.setTitle()` did not update Otty; v1 uses the `osc-tty` fallback backend after OSC safety tests pass.
   ```

## Manual Otty Smoke Test

- [ ] Install or link the plugin.
- [ ] Start OMP inside Otty.
- [ ] Send a prompt that triggers at least one tool call.
- [ ] Confirm the tab title changes from `π: <title>` to `▶ π: <title> · <state>`.
- [ ] Trigger `/otty-status`.
- [ ] Confirm the diagnostic command reports Otty detected, backend `ui-title`, and output enabled.
- [ ] Let OMP return to idle.
- [ ] Confirm the tab title restores to `π: <title>`.

Manual Otty smoke test status: not run. Complete this section only from a real Otty session; do not mark these checks as pass from a non-Otty shell.
