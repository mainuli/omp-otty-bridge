# OMP Otty Bridge Design

Date: 2026-07-04
Status: Draft for user review
Target repo: `/Users/mainul/Workspaces/Personal/omp-otty-bridge`

## Purpose

Build a public, GitHub-installable `omp.sh` extension that integrates OMP sessions with the Otty terminal as far as stable public APIs allow. The extension should give Otty users a clear live signal for OMP state in the tab title, while avoiding spoofing, private Otty IPC assumptions, process-name tricks, or other fragile behavior.

The first attempt in `/Users/mainul/Documents/Projects/omp-otty-bridge` is reference material only. This project starts clean and follows idiomatic OMP plugin packaging and extension APIs.

## Goals

- Install from GitHub with the standard OMP plugin flow: `omp install github:mainuli/omp-otty-bridge`.
- Support GitHub install for user-level use. OMP 16.3.4 warns and ignores `--scope` for GitHub targets, so project-local development/testing uses `omp plugin link .`; future marketplace refs may use project scope if OMP supports it for that target type.
- Use `package.json#omp.extensions` as the canonical plugin contract.
- Load TypeScript source directly through OMP/Bun; no npm publishing or committed build output is required for v1.
- Default to active only inside Otty.
- Show detailed, readable live state in the Otty tab title.
- Use OMP plugin settings as the public configuration surface.
- Include a diagnostic OMP command that reports detection, settings, backend, and current state.
- Verify behavior with unit tests, typecheck, plugin install/link validation, and a real Otty smoke test.

## Non-goals

- Native Otty badges, completion notifications, or Otty agent history integration in v1.
- Any Otty integration based on spoofing Claude Code, Codex, or OpenCode.
- Any dependency on undocumented Otty IPC, private app internals, or process-name/argv matching.
- npm publishing for v1.
- Running outside Otty by default.

Native Otty parity remains desirable, but it depends on Otty exposing a stable custom-agent API or supporting `omp` as a first-class agent kind. This spec does not include an upstream/Otty proposal.

## Compatibility And Feasibility Gate

Minimum supported OMP version is `16.3.4`, because this design depends on the OMP extension APIs and event names present in that version's published types. The package must document this version floor, and development dependencies should pin `@oh-my-pi/pi-coding-agent` to a compatible `16.x` range.

Before implementing the full extension, run a short compatibility spike in Otty:

1. Load a throwaway OMP extension that calls `ctx.ui.setTitle("omp-otty-bridge-smoke")`.
2. Confirm the Otty tab title changes.
3. Confirm the extension can read the base title from `ctx.sessionManager.getSessionName()`.
4. If `ctx.ui.setTitle()` does not update Otty, make `osc-tty` the implemented backend for v1 and document why.
5. If `getSessionName()` is unavailable, use `π: <cwd basename>` as the base title for v1 and document that OMP's generated conversation title cannot be preserved on that OMP version.

The implementation plan must start with this spike. Full implementation should not proceed until these title API assumptions are resolved.

## Public User Experience

Primary install:

```bash
omp install github:mainuli/omp-otty-bridge
```

Development install:

```bash
omp plugin link .
```

Default title examples:

```text
π: project
▶ π: project · working
▶ π: project · bash
▶ π: project · tools:2
✋ π: project · awaiting input
◌ π: project · compacting
◌ π: project · snapcompact
↻ π: project · retry 2/3
```

The extension should preserve OMP's base title and add only a transient state prefix/detail. When OMP is idle, it restores the base title.

## Architecture

The repo is a standard OMP plugin package:

- `package.json` declares package metadata, license, repository metadata, `type: "module"`, and `private: false`.
- `package.json#omp.extensions` points to `src/index.ts`.
- `package.json#omp.settings` declares public settings so `omp plugin config` can list, set, and validate them.
- `package.json#license` is `MIT`, matching the intended public-sharing posture.

Runtime flow:

```text
OMP lifecycle event + context
  -> state reducer
  -> title formatter
  -> title backend
  -> Otty tab title
```

The primary backend is OMP's public extension UI title API: `ctx.ui.setTitle(title)`. Direct `/dev/tty` OSC title output is not part of the normal design. It is allowed only as a verified fallback if the Otty smoke test proves `ctx.ui.setTitle()` cannot update Otty reliably.

## Components

`src/index.ts`

The OMP extension entrypoint. It registers lifecycle handlers, reads validated settings, detects Otty, wires the reducer to the title backend, and registers the diagnostic command with OMP's public `registerCommand` API.

`src/settings.ts`

Parses and validates plugin settings, applies defaults, and exposes a typed runtime configuration. Settings are declared in `package.json#omp.settings` and read through exported OMP plugin APIs rather than private files.

`src/terminal.ts`

Detects Otty using `TERM_PROGRAM=otty` as the activation signal. It may read secondary Otty-related environment values for diagnostics only.

`src/state.ts`

A pure reducer that converts OMP events into a display snapshot. It tracks active tool calls, auto-compaction, session compaction, auto-retry, agent activity, awaiting input, and idle state. It uses `ctx.isIdle()` as the authoritative idle gate.

`src/title.ts`

A pure formatter that composes the base OMP title with a state glyph and readable detail. It sanitizes and length-limits all title text. The base title comes from `ctx.sessionManager.getSessionName()` when that method returns a non-empty string and falls back to `π: <cwd basename>`.

`src/backend.ts`

Defines a small title output interface. The default implementation calls `ctx.ui.setTitle()`. An OSC `/dev/tty` implementation may be added only if the real Otty smoke test proves it is necessary.

`src/diagnostics.ts`

Implements a diagnostic command named `/otty-status` that reports:

- whether Otty was detected;
- active settings;
- selected backend;
- whether title output is currently enabled or suppressed;
- last known display state;
- last emitted title, with control characters sanitized.

## State Model

The reducer should derive a deterministic display state from OMP's documented extension events. Reliable event sources include:

- `session_start`, `session_shutdown`;
- `session_switch`, `session_branch`;
- `agent_start`, `agent_end`;
- `turn_start`, `turn_end`;
- `tool_execution_start`, `tool_execution_end`;
- `tool_approval_requested`, `tool_approval_resolved`;
- `auto_compaction_start`, `auto_compaction_end`;
- `auto_retry_start`, `auto_retry_end`;
- `session_before_compact`, `session.compacting`, `session_compact`;

Cancelable/pre-execution events such as `session_before_switch`, `session_before_branch`, `tool_call`, and `tool_result` are intentionally avoided for cosmetic title updates. Completed `session_switch` and `session_branch` events reset state, and `tool_execution_start`/`tool_execution_end` track active tool execution without awaiting settings/backend work during pre-execution gating.

`auto_compaction_start` and `auto_compaction_end` represent OMP's automatic compaction flow. `session_before_compact`, `session.compacting`, and `session_compact` represent explicit/session compaction flow. Both map to the same display priority, but they are tracked separately so an end event from one family cannot clear the other family's active state.

The OMP `AutoCompactionStartEvent.action` value is used as the detailed label when useful. For example, action `snapcompact` formats as `◌ π: project · snapcompact`.

State priority:

1. awaiting user input or approval;
2. auto-retry;
3. auto-compaction/session compaction;
4. active tool calls;
5. agent working;
6. idle.

Idle must only be emitted when `ctx.isIdle()` reports idle and there is no pending higher-priority state.

If multiple tools overlap, the title should show a stable summary such as `tools:2` instead of rapidly switching between tool names. A single active tool may be shown by name, such as `bash`, `edit`, or `read`.

## Title Formatting

Default style is glyph plus label:

```text
▶ π: project · bash
◌ π: project · compacting
↻ π: project · retry 2/3
✋ π: project · awaiting input
```

Formatting rules:

- Preserve OMP's base title.
- Strip C0 controls, DEL, ESC, BEL, and other unsafe control sequences before output.
- Enforce `maxTitleLength`.
- Avoid flicker by emitting only when the formatted title changes.
- Restore the base title on idle. On shutdown, make one best-effort restore attempt and swallow backend failures.

## Activation

Default activation is Otty-only. Outside Otty, the extension loads but suppresses title output unless configured otherwise.

Otty detection uses `TERM_PROGRAM=otty` as the primary activation signal. Secondary Otty-related environment values may be reported by diagnostics, but they must not be the only reason the extension activates unless they are documented by Otty. The extension must not call private Otty IPC or rely on Otty's internal agent detection.

Headless/non-interactive modes should no-op cleanly. The extension must not throw, block turns, or require UI availability to load.

## Settings

Settings are declared in `package.json#omp.settings` and managed with `omp plugin config`.

Required settings:

- `enabled`: boolean, default `true`.
- `mode`: enum, default `detailed`, values `minimal`, `detailed`.
- `titleFormat`: enum, default `glyph-label`, values `glyph-label`, `label-only`, `glyph-only`.
- `maxTitleLength`: number, default `120`, bounded to a safe range such as `40..240`.
- `nonOttyBehavior`: enum, default `disabled`, values `disabled`, `enabled`.
- `backend`: enum, default `ui-title`, values `ui-title`, `osc-tty`.

`mode` controls which state details are included. `minimal` shows only the highest-priority coarse state, such as `working`, `awaiting input`, `compacting`, or `retry`. `detailed` may show tool names, tool counts, compaction action names, and retry counts.

`titleFormat` controls how the selected state is rendered. `glyph-label` shows both glyph and text, `label-only` omits glyphs, and `glyph-only` omits detail text. `mode` chooses the detail value first; `titleFormat` renders that value second.

The `osc-tty` backend is advanced/fallback behavior. It should be documented as available only if implementation verification shows it is needed and safe.

## Error Handling And Safety

- Every event handler must be throw-safe.
- The extension must never return a value that blocks a tool call or cancels an OMP event.
- Title output failures are logged at debug/warn level when useful and otherwise ignored.
- Sanitization happens before every backend write.
- If settings cannot be read, the extension uses manifest defaults.
- If Otty is not detected and `nonOttyBehavior` is `disabled`, no title writes occur.
- If the base title cannot be read with `ctx.sessionManager.getSessionName()`, fall back to a conservative title derived from `ctx.cwd`, such as `π: <basename>`.

## Repository Shape

```text
.
├── package.json
├── README.md
├── LICENSE
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── settings.ts
│   ├── terminal.ts
│   ├── state.ts
│   ├── title.ts
│   ├── backend.ts
│   └── diagnostics.ts
├── test/
│   ├── index.test.ts
│   ├── settings.test.ts
│   ├── terminal.test.ts
│   ├── state.test.ts
│   ├── title.test.ts
│   ├── backend.test.ts
│   └── diagnostics.test.ts
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-07-04-omp-otty-bridge-design.md
```

Use Bun's built-in test runner, matching OMP's Bun runtime.

## README Requirements

The README must cover:

- what the extension does;
- what it does not do;
- Otty-only default behavior;
- install from GitHub;
- project-local development/testing with `omp plugin link .`, with a note that OMP 16.3.4 warns and ignores `--scope` for GitHub targets;
- configuration with `omp plugin config`;
- diagnostic command usage;
- minimum supported OMP version `16.3.4`;
- troubleshooting title updates;
- fallback backend notes if `osc-tty` is implemented;
- uninstall/disable instructions;
- limitations around native Otty badges and notifications;
- development commands.

## Verification

v1 is not complete until all of the following pass:

- Unit tests for settings parsing, Otty detection, reducer behavior, title formatting, backend behavior, and diagnostic output.
- `index.test.ts` covers extension wiring: event registration, command registration, non-Otty suppression, settings defaulting, and the `event -> reducer -> formatter -> backend` path with a fake OMP API.
- Safety tests prove handlers swallow backend/reducer/formatter exceptions and never return tool-blocking or event-cancelling results.
- Headless tests prove the extension loads and no-ops when UI/title APIs are absent or disabled.
- If `osc-tty` ships, dedicated tests cover OSC frame construction, title sanitization, length limiting, short-write handling, and no-tty behavior.
- TypeScript typecheck.
- `omp plugin link .` works from the repo.
- `omp install github:mainuli/omp-otty-bridge --dry-run` or an equivalent local validation confirms OMP accepts the plugin manifest and extension entry.
- A real Otty smoke test proves a running OMP session updates the tab title through `ctx.ui.setTitle()`.
- If the smoke test fails, validate `osc-tty` as a fallback before enabling or documenting it.
- The manual Otty smoke test is documented as a release checklist item with expected before/after title strings, because Otty UI verification cannot be fully covered in CI.
- README install/config/troubleshooting docs are accurate.
- MIT `LICENSE` is present and `package.json#license` is `MIT`.

## Acceptance Criteria

- A user can install the extension from GitHub with OMP's standard plugin install flow.
- An OMP session inside Otty shows detailed live state in the tab title.
- Outside Otty, the extension is inert by default.
- Configuration is visible and manageable through OMP plugin settings.
- The diagnostic command explains why the extension is active or suppressed.
- No fragile Otty hacks are used.
- Tests and smoke validation support the documented behavior.
