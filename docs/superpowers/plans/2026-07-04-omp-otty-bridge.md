# OMP Otty Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public GitHub-installable OMP extension that shows OMP live state in Otty tab titles using stable OMP extension APIs.

**Architecture:** The extension is an OMP plugin package whose `package.json#omp.extensions` entry loads `src/index.ts`. The extension detects Otty, derives state from documented OMP extension events, formats a sanitized title, and writes it through an injected title backend that defaults to `ctx.ui.setTitle()`. The full implementation is gated by an Otty compatibility spike that proves `ctx.ui.setTitle()` and `ctx.sessionManager.getSessionName()` work as expected.

Cancelable/pre-execution switch and branch events are intentionally avoided for cosmetic title updates. Completed `session_switch` and `session_branch` events reset state, while active tools are sourced from `tool_execution_start` and `tool_execution_end` without doing settings/backend work in tool gating handlers.

**Tech Stack:** TypeScript, Bun test runner, OMP 16.3.4 extension APIs, GitHub plugin install via `omp install github:mainuli/omp-otty-bridge`. OMP 16.3.4 warns and ignores `--scope` for GitHub targets; use `omp plugin link .` for project-local development/testing, and reserve project scope for future marketplace refs if OMP supports it.

---

## Source Spec

Read the approved design first:

`docs/superpowers/specs/2026-07-04-omp-otty-bridge-design.md`

Confirmed repository owner for install examples: `mainuli`.

## File Structure

- `package.json`: public OMP plugin manifest, settings schema, repository metadata, test/typecheck scripts.
- `tsconfig.json`: strict TypeScript configuration for source and tests.
- `.gitignore`: excludes dependencies, logs, generated scratch output.
- `LICENSE`: MIT license.
- `README.md`: install, configuration, diagnostics, troubleshooting, limitations, development.
- `docs/release-checklist.md`: manual Otty smoke test and release validation checklist.
- `spikes/title-api/index.ts`: throwaway extension for the compatibility spike.
- `src/settings.ts`: reads OMP plugin settings through `getPluginSettings(pluginName, cwd)` and normalizes them into a typed runtime configuration.
- `src/terminal.ts`: detects whether the extension should be active for the current terminal.
- `src/title.ts`: sanitizes, truncates, and formats titles.
- `src/state.ts`: pure state reducer for OMP events.
- `src/backend.ts`: title output backends.
- `src/diagnostics.ts`: diagnostic command output formatting.
- `src/index.ts`: extension entrypoint, event wiring, command registration, safety wrapper.
- `test/*.test.ts`: Bun tests for every module plus integration-style wiring tests.

## Shared Interfaces

Implement these names consistently across tasks:

```ts
export type BridgeMode = "minimal" | "detailed";
export type TitleFormat = "glyph-label" | "label-only" | "glyph-only";
export type NonOttyBehavior = "disabled" | "enabled";
export type BackendName = "ui-title" | "osc-tty";

export interface BridgeSettings {
  enabled: boolean;
  mode: BridgeMode;
  titleFormat: TitleFormat;
  maxTitleLength: number;
  nonOttyBehavior: NonOttyBehavior;
  backend: BackendName;
}

export interface TerminalInfo {
  termProgram?: string;
  cwTerm?: string;
  ottyShellIntegration?: string;
}

export interface RuntimeEnvironment {
  terminal: TerminalInfo;
}

export interface DisplayState {
  kind: "idle" | "working" | "tool" | "tools" | "awaiting" | "compacting" | "retry";
  label: string;
  glyph: "" | "▶" | "✋" | "◌" | "↻";
}

export interface TitleBackend {
  readonly name: BackendName;
  setTitle(title: string): void;
}
```

Use this plugin name everywhere settings are read:

```ts
export const PLUGIN_NAME = "omp-otty-bridge";
```

---

### Task 1: Compatibility Spike

**Files:**
- Create: `spikes/title-api/index.ts`
- Create: `docs/release-checklist.md`

- [ ] **Step 1: Create the spike extension**

Write `spikes/title-api/index.ts`:

```ts
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent/extensibility/extensions";

function readBaseTitle(ctx: ExtensionContext): string {
  const maybeTitle = ctx.sessionManager.getSessionName();
  if (typeof maybeTitle === "string" && maybeTitle.trim().length > 0) return maybeTitle;
  const cwdBase = ctx.cwd.split("/").filter(Boolean).pop() ?? "omp";
  return `π: ${cwdBase}`;
}

export default function titleApiSpike(pi: ExtensionAPI): void {
  const run = (ctx: ExtensionContext): void => {
    const baseTitle = readBaseTitle(ctx);
    const isIdle = ctx.isIdle();
    ctx.ui.setTitle("omp-otty-bridge-smoke");
    pi.logger.info("omp-otty-bridge title API spike", { baseTitle, cwd: ctx.cwd, isIdle });
  };

  pi.on("session_start", (_event, ctx) => {
    run(ctx);
  });

  pi.registerCommand("otty-title-spike", {
    description: "Run the Otty title API compatibility spike",
    handler: async (_args, ctx) => {
      run(ctx);
      ctx.ui.notify(`Otty title spike ran. Base title: ${readBaseTitle(ctx)}. idle=${ctx.isIdle()}`, "info");
    },
  });
}
```

- [ ] **Step 2: Run the spike inside Otty**

Run from an Otty tab:

```bash
omp -e spikes/title-api/index.ts "Run the Otty title API spike and then stop."
```

Expected: the Otty tab title changes to `omp-otty-bridge-smoke`.

- [ ] **Step 3: Run the diagnostic command manually**

In the same OMP session, run:

```text
/otty-title-spike
```

Expected: OMP shows an info notification containing `Otty title spike ran`, and the tab title remains `omp-otty-bridge-smoke`.

- [ ] **Step 4: Verify exported OMP API surfaces**

After Task 2 installs dependencies, run these checks before implementing the main extension:

```bash
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/extensions").then(() => console.log("extensions export ok"))'
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/plugins").then((m) => console.log(typeof m.getPluginSettings))'
```

Expected: the first command prints `extensions export ok`; the second prints `function`. If either command fails, stop and update the plan to use the exported OMP API path that is actually supported by OMP 16.3.4.

- [ ] **Step 5: Record the compatibility result**

Create `docs/release-checklist.md` with this content, filling the observed result values immediately after the smoke test:

```md
# Release Checklist

## Compatibility Spike

- OMP version tested: 16.3.4
- Extension import surface: pass
- Plugin settings import surface: pass
- Otty title API: pass
- Base title API: pass
- Idle API: pass
- Notify API: pass
- Context cwd API: pass
- Primary backend for v1: ui-title
- Compatibility notes: `ctx.ui.setTitle()` updates the Otty tab title; `ctx.sessionManager.getSessionName()`, `ctx.isIdle()`, `ctx.ui.notify()`, and `ctx.cwd` are available; `getPluginSettings(pluginName, cwd)` is exported.

## Manual Otty Smoke Test

- Install or link the plugin.
- Start OMP inside Otty.
- Send a prompt that triggers at least one tool call.
- Confirm the tab title changes from `π: <title>` to `▶ π: <title> · <state>`.
- Trigger `/otty-status`.
- Confirm the diagnostic command reports Otty detected, backend `ui-title`, and output enabled.
- Let OMP return to idle.
- Confirm the tab title restores to `π: <title>`.
```

If `ctx.ui.setTitle()` fails, change `Primary backend for v1` to `osc-tty` and change the compatibility notes to: "`ctx.ui.setTitle()` did not update Otty; v1 uses the `osc-tty` fallback backend after OSC safety tests pass."

- [ ] **Step 6: Commit**

```bash
git add spikes/title-api/index.ts docs/release-checklist.md
git commit -m "chore: add title api compatibility spike"
```

---

### Task 2: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "omp-otty-bridge",
  "version": "0.1.0",
  "description": "OMP extension that shows live OMP state in Otty tab titles.",
  "private": false,
  "type": "module",
  "license": "MIT",
  "homepage": "https://github.com/mainuli/omp-otty-bridge#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mainuli/omp-otty-bridge.git"
  },
  "bugs": {
    "url": "https://github.com/mainuli/omp-otty-bridge/issues"
  },
  "keywords": ["omp", "omp.sh", "otty", "terminal", "extension"],
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "check": "bun test && tsc --noEmit"
  },
  "omp": {
    "name": "OMP Otty Bridge",
    "version": "0.1.0",
    "description": "Show OMP live state in Otty tab titles.",
    "extensions": ["src/index.ts"],
    "settings": {
      "enabled": {
        "type": "boolean",
        "description": "Enable Otty title updates.",
        "default": true
      },
      "mode": {
        "type": "enum",
        "description": "Amount of state detail to show in the title.",
        "values": ["minimal", "detailed"],
        "default": "detailed"
      },
      "titleFormat": {
        "type": "enum",
        "description": "How state is rendered in the title.",
        "values": ["glyph-label", "label-only", "glyph-only"],
        "default": "glyph-label"
      },
      "maxTitleLength": {
        "type": "number",
        "description": "Maximum title length after sanitization.",
        "default": 120,
        "min": 40,
        "max": 240,
        "step": 1
      },
      "nonOttyBehavior": {
        "type": "enum",
        "description": "Whether to emit title updates outside Otty.",
        "values": ["disabled", "enabled"],
        "default": "disabled"
      },
      "backend": {
        "type": "enum",
        "description": "Title output backend.",
        "values": ["ui-title", "osc-tty"],
        "default": "ui-title"
      }
    }
  },
  "devDependencies": {
    "@oh-my-pi/pi-coding-agent": "^16.3.4",
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  },
  "engines": {
    "bun": ">=1.3.14"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["bun"],
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "spikes/**/*.ts"]
}
```

- [ ] **Step 3: Write `.gitignore`**

```gitignore
node_modules/
bun.lockb
*.log
.DS_Store
```

- [ ] **Step 4: Write MIT `LICENSE`**

```text
MIT License

Copyright (c) 2026 Mainul Islam

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Write the README skeleton**

````md
# omp-otty-bridge

OMP extension that shows live OMP state in Otty tab titles.

## Status

Requires OMP 16.3.4 or newer. Native Otty badges and Otty agent history are not provided by this extension because Otty does not expose a stable custom-agent API for OMP.

## Install

```bash
omp install github:mainuli/omp-otty-bridge
```

Project-local development/testing:

```bash
omp plugin link .
```

OMP 16.3.4 warns and ignores `--scope` for GitHub targets. Future marketplace refs may use project scope if OMP supports it for that target type.

## Development

```bash
bun install
bun test
bun run typecheck
omp plugin link .
```
````

- [ ] **Step 6: Install dependencies**

```bash
bun install
```

Expected: dependencies install and `bun.lock` is created.

- [ ] **Step 7: Verify OMP subpath exports**

```bash
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/extensions").then(() => console.log("extensions export ok"))'
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/plugins").then((m) => console.log(typeof m.getPluginSettings))'
```

Expected: the first command prints `extensions export ok`; the second prints `function`.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json .gitignore LICENSE README.md bun.lock
git commit -m "chore: scaffold omp otty bridge package"
```

---

### Task 3: Settings Parser

**Files:**
- Create: `src/settings.ts`
- Test: `test/settings.test.ts`

- [ ] **Step 1: Write failing settings tests**

Create `test/settings.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, PLUGIN_NAME, loadBridgeSettings, normalizeSettings } from "../src/settings";

describe("normalizeSettings", () => {
  test("returns defaults for empty input", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  test("accepts valid settings", () => {
    expect(
      normalizeSettings({
        enabled: false,
        mode: "minimal",
        titleFormat: "label-only",
        maxTitleLength: 80,
        nonOttyBehavior: "enabled",
        backend: "osc-tty",
      }),
    ).toEqual({
      enabled: false,
      mode: "minimal",
      titleFormat: "label-only",
      maxTitleLength: 80,
      nonOttyBehavior: "enabled",
      backend: "osc-tty",
    });
  });

  test("rejects invalid enum values by using defaults", () => {
    expect(
      normalizeSettings({
        mode: "verbose",
        titleFormat: "emoji",
        nonOttyBehavior: "always",
        backend: "private-ipc",
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  test("clamps maxTitleLength to the supported range", () => {
    expect(normalizeSettings({ maxTitleLength: 10 }).maxTitleLength).toBe(40);
    expect(normalizeSettings({ maxTitleLength: 500 }).maxTitleLength).toBe(240);
  });
});

describe("loadBridgeSettings", () => {
  test("loads settings through OMP plugin settings reader", async () => {
    const calls: Array<{ pluginName: string; cwd: string }> = [];
    const settings = await loadBridgeSettings("/tmp/project", undefined, async (pluginName, cwd) => {
      calls.push({ pluginName, cwd });
      return { mode: "minimal", maxTitleLength: 80 };
    });
    expect(calls).toEqual([{ pluginName: PLUGIN_NAME, cwd: "/tmp/project" }]);
    expect(settings.mode).toBe("minimal");
    expect(settings.maxTitleLength).toBe(80);
  });

  test("uses explicit overrides without reading plugin settings", async () => {
    const settings = await loadBridgeSettings("/tmp/project", { backend: "osc-tty" }, async () => {
      throw new Error("reader should not be called");
    });
    expect(settings.backend).toBe("osc-tty");
  });

  test("falls back to defaults when the OMP settings reader fails", async () => {
    const settings = await loadBridgeSettings("/tmp/project", undefined, async () => {
      throw new Error("settings unavailable");
    });
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test test/settings.test.ts
```

Expected: FAIL with module not found for `../src/settings`.

- [ ] **Step 3: Implement `src/settings.ts`**

```ts
import { getPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins";

export type BridgeMode = "minimal" | "detailed";
export type TitleFormat = "glyph-label" | "label-only" | "glyph-only";
export type NonOttyBehavior = "disabled" | "enabled";
export type BackendName = "ui-title" | "osc-tty";

export const PLUGIN_NAME = "omp-otty-bridge";

export type PluginSettingsReader = (
  pluginName: string,
  cwd: string,
) => Promise<Record<string, unknown>>;

export interface BridgeSettings {
  enabled: boolean;
  mode: BridgeMode;
  titleFormat: TitleFormat;
  maxTitleLength: number;
  nonOttyBehavior: NonOttyBehavior;
  backend: BackendName;
}

export const DEFAULT_SETTINGS: BridgeSettings = {
  enabled: true,
  mode: "detailed",
  titleFormat: "glyph-label",
  maxTitleLength: 120,
  nonOttyBehavior: "disabled",
  backend: "ui-title",
};

const BRIDGE_MODES = new Set<BridgeMode>(["minimal", "detailed"]);
const TITLE_FORMATS = new Set<TitleFormat>(["glyph-label", "label-only", "glyph-only"]);
const NON_OTTY_BEHAVIORS = new Set<NonOttyBehavior>(["disabled", "enabled"]);
const BACKENDS = new Set<BackendName>(["ui-title", "osc-tty"]);

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function normalizeSettings(input: Record<string, unknown> | undefined): BridgeSettings {
  const raw = input ?? {};
  return {
    enabled: booleanValue(raw.enabled, DEFAULT_SETTINGS.enabled),
    mode: enumValue(raw.mode, BRIDGE_MODES, DEFAULT_SETTINGS.mode),
    titleFormat: enumValue(raw.titleFormat, TITLE_FORMATS, DEFAULT_SETTINGS.titleFormat),
    maxTitleLength: clamp(numberValue(raw.maxTitleLength, DEFAULT_SETTINGS.maxTitleLength), 40, 240),
    nonOttyBehavior: enumValue(
      raw.nonOttyBehavior,
      NON_OTTY_BEHAVIORS,
      DEFAULT_SETTINGS.nonOttyBehavior,
    ),
    backend: enumValue(raw.backend, BACKENDS, DEFAULT_SETTINGS.backend),
  };
}

export async function loadBridgeSettings(
  cwd: string,
  overrides?: Record<string, unknown>,
  reader: PluginSettingsReader = getPluginSettings,
): Promise<BridgeSettings> {
  if (overrides) return normalizeSettings(overrides);
  try {
    return normalizeSettings(await reader(PLUGIN_NAME, cwd));
  } catch {
    return DEFAULT_SETTINGS;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test test/settings.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts test/settings.test.ts
git commit -m "feat: add bridge settings parser"
```

---

### Task 4: Terminal Detection

**Files:**
- Create: `src/terminal.ts`
- Test: `test/terminal.test.ts`

- [ ] **Step 1: Write failing terminal tests**

Create `test/terminal.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { detectTerminal, shouldEmitTitles } from "../src/terminal";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("detectTerminal", () => {
  test("detects Otty only from TERM_PROGRAM", () => {
    expect(detectTerminal({ TERM_PROGRAM: "otty" }).isOtty).toBe(true);
    expect(detectTerminal({ TERM_PROGRAM: "Apple_Terminal", CW_TERM: "otty" }).isOtty).toBe(false);
  });

  test("reports secondary Otty values for diagnostics", () => {
    expect(detectTerminal({ CW_TERM: "otty", OTTY_SHELL_INTEGRATION: "1" }).diagnostics).toEqual({
      termProgram: undefined,
      cwTerm: "otty",
      ottyShellIntegration: "1",
    });
  });
});

describe("shouldEmitTitles", () => {
  test("emits in Otty when enabled", () => {
    expect(shouldEmitTitles({ isOtty: true }, DEFAULT_SETTINGS)).toBe(true);
  });

  test("suppresses outside Otty by default", () => {
    expect(shouldEmitTitles({ isOtty: false }, DEFAULT_SETTINGS)).toBe(false);
  });

  test("allows non-Otty when setting is enabled", () => {
    expect(
      shouldEmitTitles(
        { isOtty: false },
        { ...DEFAULT_SETTINGS, nonOttyBehavior: "enabled" },
      ),
    ).toBe(true);
  });

  test("suppresses when disabled", () => {
    expect(shouldEmitTitles({ isOtty: true }, { ...DEFAULT_SETTINGS, enabled: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test test/terminal.test.ts
```

Expected: FAIL with module not found for `../src/terminal`.

- [ ] **Step 3: Implement `src/terminal.ts`**

```ts
import type { BridgeSettings } from "./settings";

export interface TerminalDiagnostics {
  termProgram?: string;
  cwTerm?: string;
  ottyShellIntegration?: string;
}

export interface TerminalDetection {
  isOtty: boolean;
  diagnostics: TerminalDiagnostics;
}

export function detectTerminal(env: Record<string, string | undefined> = process.env): TerminalDetection {
  const diagnostics: TerminalDiagnostics = {
    termProgram: env.TERM_PROGRAM,
    cwTerm: env.CW_TERM,
    ottyShellIntegration: env.OTTY_SHELL_INTEGRATION,
  };

  return {
    isOtty: env.TERM_PROGRAM === "otty",
    diagnostics,
  };
}

export function shouldEmitTitles(
  terminal: Pick<TerminalDetection, "isOtty">,
  settings: BridgeSettings,
): boolean {
  if (!settings.enabled) return false;
  if (terminal.isOtty) return true;
  return settings.nonOttyBehavior === "enabled";
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test test/terminal.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal.ts test/terminal.test.ts
git commit -m "feat: detect otty terminal activation"
```

---

### Task 5: Title Formatting

**Files:**
- Create: `src/title.ts`
- Test: `test/title.test.ts`

- [ ] **Step 1: Write failing title tests**

Create `test/title.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { composeTitle, sanitizeTitle } from "../src/title";
import type { DisplayState } from "../src/state";
import { DEFAULT_SETTINGS } from "../src/settings";

const toolState: DisplayState = { kind: "tool", label: "bash", glyph: "▶" };

describe("sanitizeTitle", () => {
  test("strips unsafe controls and limits length", () => {
    expect(sanitizeTitle("a\x00b\x07c\x1bd\x7fe", 10)).toBe("abcde");
    expect(sanitizeTitle("x".repeat(20), 8)).toBe("xxxxxxxx");
  });
});

describe("composeTitle", () => {
  test("renders glyph plus label by default", () => {
    expect(composeTitle("π: project", toolState, DEFAULT_SETTINGS)).toBe("▶ π: project · bash");
  });

  test("renders label only", () => {
    expect(composeTitle("π: project", toolState, { ...DEFAULT_SETTINGS, titleFormat: "label-only" })).toBe(
      "π: project · bash",
    );
  });

  test("renders glyph only", () => {
    expect(composeTitle("π: project", toolState, { ...DEFAULT_SETTINGS, titleFormat: "glyph-only" })).toBe(
      "▶ π: project",
    );
  });

  test("renders idle as base title", () => {
    expect(
      composeTitle("π: project", { kind: "idle", label: "", glyph: "" }, DEFAULT_SETTINGS),
    ).toBe("π: project");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test test/title.test.ts
```

Expected: FAIL with module not found for `../src/title`.

- [ ] **Step 3: Implement `src/title.ts`**

```ts
import type { BridgeSettings } from "./settings";
import type { DisplayState } from "./state";

const CONTROL_RE = /[\x00-\x1f\x7f-\x9f]/g;

export function sanitizeTitle(title: string, maxLength: number): string {
  return title.replace(CONTROL_RE, "").slice(0, maxLength);
}

export function composeTitle(baseTitle: string, state: DisplayState, settings: BridgeSettings): string {
  const safeBase = sanitizeTitle(baseTitle, settings.maxTitleLength);
  if (state.kind === "idle") return safeBase;

  const withGlyph = settings.titleFormat === "glyph-label" || settings.titleFormat === "glyph-only";
  const withLabel = settings.titleFormat === "glyph-label" || settings.titleFormat === "label-only";
  const prefix = withGlyph && state.glyph ? `${state.glyph} ` : "";
  const detail = withLabel && state.label ? ` · ${state.label}` : "";
  return sanitizeTitle(`${prefix}${safeBase}${detail}`, settings.maxTitleLength);
}

export function baseTitleFromContext(ctx: { cwd: string; sessionManager?: { getSessionName?: () => string | undefined } }): string {
  const sessionName = ctx.sessionManager?.getSessionName?.();
  if (typeof sessionName === "string" && sessionName.trim().length > 0) return sessionName;
  const cwdBase = ctx.cwd.split("/").filter(Boolean).pop() ?? "omp";
  return `π: ${cwdBase}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test test/title.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/title.ts test/title.test.ts
git commit -m "feat: format safe otty titles"
```

---

### Task 6: State Reducer

**Files:**
- Create: `src/state.ts`
- Test: `test/state.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Create `test/state.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { BridgeState } from "../src/state";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("BridgeState", () => {
  test("starts idle when context is idle", () => {
    const state = new BridgeState();
    expect(state.snapshot(true, DEFAULT_SETTINGS)).toEqual({ kind: "idle", label: "", glyph: "" });
  });

  test("shows working during agent run", () => {
    const state = new BridgeState();
    state.apply({ type: "agent_start" });
    expect(state.snapshot(false, DEFAULT_SETTINGS)).toEqual({ kind: "working", label: "working", glyph: "▶" });
  });

  test("shows one running tool by name in detailed mode", () => {
    const state = new BridgeState();
    state.apply({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" });
    expect(state.snapshot(false, DEFAULT_SETTINGS)).toEqual({ kind: "tool", label: "bash", glyph: "▶" });
  });

  test("summarizes multiple running tools", () => {
    const state = new BridgeState();
    state.apply({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" });
    state.apply({ type: "tool_execution_start", toolCallId: "2", toolName: "read" });
    expect(state.snapshot(false, DEFAULT_SETTINGS)).toEqual({ kind: "tools", label: "tools:2", glyph: "▶" });
  });

  test("clears running tool on execution end", () => {
    const state = new BridgeState();
    state.apply({ type: "agent_start" });
    state.apply({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" });
    state.apply({ type: "tool_execution_end", toolCallId: "1" });
    expect(state.snapshot(false, DEFAULT_SETTINGS)).toEqual({ kind: "working", label: "working", glyph: "▶" });
  });

  test("awaiting approval wins over tools", () => {
    const state = new BridgeState();
    state.apply({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" });
    state.apply({ type: "tool_approval_requested", toolCallId: "1", toolName: "bash" });
    expect(state.snapshot(false, DEFAULT_SETTINGS)).toEqual({
      kind: "awaiting",
      label: "awaiting input",
      glyph: "✋",
    });
  });

  test("retry wins over compaction and tools", () => {
    const state = new BridgeState();
    state.apply({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" });
    state.apply({ type: "auto_compaction_start", action: "snapcompact" });
    state.apply({ type: "auto_retry_start", attempt: 2, maxAttempts: 3 });
    expect(state.snapshot(false, DEFAULT_SETTINGS)).toEqual({ kind: "retry", label: "retry 2/3", glyph: "↻" });
  });

  test("minimal mode uses coarse labels", () => {
    const state = new BridgeState();
    state.apply({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" });
    expect(state.snapshot(false, { ...DEFAULT_SETTINGS, mode: "minimal" })).toEqual({
      kind: "tool",
      label: "working",
      glyph: "▶",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test test/state.test.ts
```

Expected: FAIL with module not found for `../src/state`.

- [ ] **Step 3: Implement `src/state.ts`**

```ts
import type { BridgeSettings } from "./settings";

export interface DisplayState {
  kind: "idle" | "working" | "tool" | "tools" | "awaiting" | "compacting" | "retry";
  label: string;
  glyph: "" | "▶" | "✋" | "◌" | "↻";
}

export type BridgeEvent =
  | { type: "session_start" | "session_shutdown" | "agent_start" | "agent_end" | "turn_start" | "turn_end" }
  | { type: "session_before_compact" | "session.compacting" | "session_compact" }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string }
  | { type: "tool_execution_end"; toolCallId: string }
  | { type: "tool_approval_requested"; toolCallId: string; toolName: string }
  | { type: "tool_approval_resolved"; toolCallId: string }
  | { type: "auto_compaction_start"; action: string }
  | { type: "auto_compaction_end" }
  | { type: "auto_retry_start"; attempt: number; maxAttempts: number }
  | { type: "auto_retry_end" };

export class BridgeState {
  #agentActive = false;
  #tools = new Map<string, string>();
  #approvals = new Set<string>();
  #autoCompactionAction: string | null = null;
  #sessionCompacting = false;
  #retry: { attempt: number; maxAttempts: number } | null = null;

  apply(event: BridgeEvent): void {
    switch (event.type) {
      case "session_start":
      case "session_shutdown":
        this.#agentActive = false;
        this.#tools.clear();
        this.#approvals.clear();
        this.#autoCompactionAction = null;
        this.#sessionCompacting = false;
        this.#retry = null;
        break;
      case "agent_start":
      case "turn_start":
        this.#agentActive = true;
        break;
      case "agent_end":
      case "turn_end":
        this.#agentActive = false;
        this.#tools.clear();
        this.#approvals.clear();
        break;
      case "tool_execution_start":
        this.#tools.set(event.toolCallId, event.toolName);
        break;
      case "tool_execution_end":
        this.#tools.delete(event.toolCallId);
        this.#approvals.delete(event.toolCallId);
        break;
      case "tool_approval_requested":
        this.#approvals.add(event.toolCallId);
        break;
      case "tool_approval_resolved":
        this.#approvals.delete(event.toolCallId);
        break;
      case "auto_compaction_start":
        this.#autoCompactionAction = event.action;
        break;
      case "auto_compaction_end":
        this.#autoCompactionAction = null;
        break;
      case "session_before_compact":
      case "session.compacting":
        this.#sessionCompacting = true;
        break;
      case "session_compact":
        this.#sessionCompacting = false;
        break;
      case "auto_retry_start":
        this.#retry = { attempt: event.attempt, maxAttempts: event.maxAttempts };
        break;
      case "auto_retry_end":
        this.#retry = null;
        break;
    }
  }

  snapshot(isIdle: boolean, settings: Pick<BridgeSettings, "mode">): DisplayState {
    if (this.#approvals.size > 0) return { kind: "awaiting", label: "awaiting input", glyph: "✋" };
    if (this.#retry) return { kind: "retry", label: `retry ${this.#retry.attempt}/${this.#retry.maxAttempts}`, glyph: "↻" };
    if (this.#autoCompactionAction) {
      const label = settings.mode === "detailed" ? this.#autoCompactionAction : "compacting";
      return { kind: "compacting", label, glyph: "◌" };
    }
    if (this.#sessionCompacting) return { kind: "compacting", label: "compacting", glyph: "◌" };
    if (this.#tools.size === 1) {
      const label = settings.mode === "detailed" ? [...this.#tools.values()][0] : "working";
      return { kind: "tool", label, glyph: "▶" };
    }
    if (this.#tools.size > 1) {
      const label = settings.mode === "detailed" ? `tools:${this.#tools.size}` : "working";
      return { kind: "tools", label, glyph: "▶" };
    }
    if (!isIdle || this.#agentActive) return { kind: "working", label: "working", glyph: "▶" };
    return { kind: "idle", label: "", glyph: "" };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test test/state.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state.ts test/state.test.ts
git commit -m "feat: derive bridge display state"
```

---

### Task 7: Title Backends

**Files:**
- Create: `src/backend.ts`
- Test: `test/backend.test.ts`

- [ ] **Step 1: Write failing backend tests**

Create `test/backend.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { createOscTtyBackend, createUiTitleBackend } from "../src/backend";

describe("createUiTitleBackend", () => {
  test("calls ctx.ui.setTitle", () => {
    const titles: string[] = [];
    const backend = createUiTitleBackend({ ui: { setTitle: (title: string) => titles.push(title) } });
    backend.setTitle("π: project");
    expect(backend.name).toBe("ui-title");
    expect(titles).toEqual(["π: project"]);
  });
});

describe("createOscTtyBackend", () => {
  test("writes an OSC title frame", () => {
    const writes: Uint8Array[] = [];
    const backend = createOscTtyBackend({ write: (frame) => writes.push(frame) });
    backend.setTitle("π: project");
    expect(backend.name).toBe("osc-tty");
    expect(Buffer.from(writes[0]).toString("utf8")).toBe("\x1b]0;π: project\x07");
  });

  test("swallows writer failures", () => {
    const backend = createOscTtyBackend({
      write: () => {
        throw new Error("tty unavailable");
      },
    });
    expect(() => backend.setTitle("π: project")).not.toThrow();
  });

  test("strips control characters before writing OSC frames", () => {
    const writes: Uint8Array[] = [];
    const backend = createOscTtyBackend({ write: (frame) => writes.push(frame) });
    backend.setTitle("bad\x1btitle");
    expect(Buffer.from(writes[0]).toString("utf8")).toBe("\x1b]0;badtitle\x07");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test test/backend.test.ts
```

Expected: FAIL with module not found for `../src/backend`.

- [ ] **Step 3: Implement `src/backend.ts`**

```ts
import { closeSync, openSync, writeSync } from "node:fs";
import type { BackendName } from "./settings";

export interface TitleBackend {
  readonly name: BackendName;
  setTitle(title: string): void;
}

const CONTROL_RE = /[\x00-\x1f\x7f-\x9f]/g;

function writeFrameToTty(frame: Uint8Array): void {
  const fd = openSync("/dev/tty", "w");
  try {
    writeSync(fd, frame);
  } finally {
    closeSync(fd);
  }
}

export function createUiTitleBackend(ctx: { ui: { setTitle: (title: string) => void } }): TitleBackend {
  return {
    name: "ui-title",
    setTitle(title: string): void {
      ctx.ui.setTitle(title);
    },
  };
}

export function createOscTtyBackend(io: { write: (frame: Uint8Array) => void } = { write: writeFrameToTty }): TitleBackend {
  return {
    name: "osc-tty",
    setTitle(title: string): void {
      try {
        io.write(Buffer.from(`\x1b]0;${title.replace(CONTROL_RE, "")}\x07`, "utf8"));
      } catch {
        return;
      }
    },
  };
}

export function createDevNullBackend(name: BackendName = "ui-title"): TitleBackend {
  return {
    name,
    setTitle(): void {
      return;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test test/backend.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/backend.ts test/backend.test.ts
git commit -m "feat: add title output backends"
```

---

### Task 8: Diagnostics

**Files:**
- Create: `src/diagnostics.ts`
- Test: `test/diagnostics.test.ts`

- [ ] **Step 1: Write failing diagnostics tests**

Create `test/diagnostics.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { formatDiagnostics } from "../src/diagnostics";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("formatDiagnostics", () => {
  test("formats bridge status", () => {
    expect(
      formatDiagnostics({
        detectedOtty: true,
        outputEnabled: true,
        settings: DEFAULT_SETTINGS,
        backendName: "ui-title",
        lastState: { kind: "tool", label: "bash", glyph: "▶" },
        lastTitle: "▶ π: project · bash",
        terminal: { termProgram: "otty", cwTerm: undefined, ottyShellIntegration: "1" },
      }),
    ).toContain("Otty detected: yes");
  });

  test("sanitizes last emitted title", () => {
    expect(
      formatDiagnostics({
        detectedOtty: false,
        outputEnabled: false,
        settings: DEFAULT_SETTINGS,
        backendName: "ui-title",
        lastState: { kind: "idle", label: "", glyph: "" },
        lastTitle: "bad\x1btitle",
        terminal: { termProgram: "Apple_Terminal" },
      }),
    ).toContain("Last title: badtitle");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test test/diagnostics.test.ts
```

Expected: FAIL with module not found for `../src/diagnostics`.

- [ ] **Step 3: Implement `src/diagnostics.ts`**

```ts
import type { DisplayState } from "./state";
import type { BackendName, BridgeSettings } from "./settings";
import type { TerminalDiagnostics } from "./terminal";
import { sanitizeTitle } from "./title";

export interface DiagnosticsInput {
  detectedOtty: boolean;
  outputEnabled: boolean;
  settings: BridgeSettings;
  backendName: BackendName;
  lastState: DisplayState;
  lastTitle: string;
  terminal: TerminalDiagnostics;
}

function yn(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

export function formatDiagnostics(input: DiagnosticsInput): string {
  return [
    "OMP Otty Bridge",
    `Otty detected: ${yn(input.detectedOtty)}`,
    `Output enabled: ${yn(input.outputEnabled)}`,
    `Backend: ${input.backendName}`,
    `State: ${input.lastState.kind}${input.lastState.label ? ` (${input.lastState.label})` : ""}`,
    `Last title: ${sanitizeTitle(input.lastTitle, input.settings.maxTitleLength)}`,
    `TERM_PROGRAM: ${input.terminal.termProgram ?? "(unset)"}`,
    `CW_TERM: ${input.terminal.cwTerm ?? "(unset)"}`,
    `OTTY_SHELL_INTEGRATION: ${input.terminal.ottyShellIntegration ?? "(unset)"}`,
    `Settings: ${JSON.stringify(input.settings)}`,
  ].join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test test/diagnostics.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/diagnostics.ts test/diagnostics.test.ts
git commit -m "feat: format otty bridge diagnostics"
```

---

### Task 9: Extension Wiring

**Files:**
- Create: `src/index.ts`
- Test: `test/index.test.ts`

- [ ] **Step 1: Write failing wiring tests**

Create `test/index.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import extension from "../src/index";

type Handler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => void | Promise<void>;

function makePi() {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, { handler: (args: string, ctx: Record<string, unknown>) => Promise<void> | void }>();
  return {
    handlers,
    commands,
    pi: {
      logger: { warn: () => undefined, info: () => undefined, debug: () => undefined },
      on: (event: string, handler: Handler) => {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
      registerCommand: (name: string, options: { handler: (args: string, ctx: Record<string, unknown>) => Promise<void> | void }) => {
        commands.set(name, options);
      },
    },
  };
}

describe("extension", () => {
  test("registers lifecycle handlers and diagnostics command", () => {
    const fake = makePi();
    extension(fake.pi as never);
    expect(fake.handlers.has("session_start")).toBe(true);
    expect(fake.handlers.has("tool_execution_start")).toBe(true);
    expect(fake.commands.has("otty-status")).toBe(true);
  });

  test("suppresses title output outside Otty by default", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "Apple_Terminal" }, settings: {} });
    const handler = fake.handlers.get("agent_start")?.[0];
    await handler?.({ type: "agent_start" }, {
      cwd: "/tmp/project",
      isIdle: () => false,
      sessionManager: { getSessionName: () => "π: project" },
      ui: { setTitle: (title: string) => titles.push(title), notify: () => undefined },
    });
    expect(titles).toEqual([]);
  });

  test("updates title in Otty", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });
    const handler = fake.handlers.get("tool_execution_start")?.[0];
    await handler?.({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" }, {
      cwd: "/tmp/project",
      isIdle: () => false,
      sessionManager: { getSessionName: () => "π: project" },
      ui: { setTitle: (title: string) => titles.push(title), notify: () => undefined },
    });
    expect(titles).toEqual(["▶ π: project · bash"]);
  });

  test("loads project settings through OMP plugin settings reader", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, {
      env: { TERM_PROGRAM: "otty" },
      settingsReader: async () => ({ titleFormat: "label-only" }),
    });
    const handler = fake.handlers.get("tool_execution_start")?.[0];
    await handler?.({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" }, {
      cwd: "/tmp/project",
      isIdle: () => false,
      sessionManager: { getSessionName: () => "π: project" },
      ui: { setTitle: (title: string) => titles.push(title), notify: () => undefined },
    });
    expect(titles).toEqual(["π: project · bash"]);
  });

  test("suppresses title output when enabled is false", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: { enabled: false } });
    const handler = fake.handlers.get("tool_execution_start")?.[0];
    await handler?.({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" }, {
      cwd: "/tmp/project",
      isIdle: () => false,
      sessionManager: { getSessionName: () => "π: project" },
      ui: { setTitle: (title: string) => titles.push(title), notify: () => undefined },
    });
    expect(titles).toEqual([]);
  });

  test("preserves cold runtime event order across async settings load", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, {
      env: { TERM_PROGRAM: "otty" },
      settingsReader: async () => ({}),
    });
    const ctx = {
      cwd: "/tmp/project",
      isIdle: () => false,
      sessionManager: { getSessionName: () => "π: project" },
      ui: { setTitle: (title: string) => titles.push(title), notify: () => undefined },
    };
    const agentStart = fake.handlers.get("agent_start")?.[0];
    const toolStart = fake.handlers.get("tool_execution_start")?.[0];
    await Promise.all([
      agentStart?.({ type: "agent_start" }, ctx),
      toolStart?.({ type: "tool_execution_start", toolCallId: "1", toolName: "bash" }, ctx),
    ]);
    expect(titles.at(-1)).toBe("▶ π: project · bash");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test test/index.test.ts
```

Expected: FAIL with module not found for `../src/index`.

- [ ] **Step 3: Implement `src/index.ts`**

```ts
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent/extensibility/extensions";
import { createDevNullBackend, createOscTtyBackend, createUiTitleBackend, type TitleBackend } from "./backend";
import { formatDiagnostics } from "./diagnostics";
import {
  DEFAULT_SETTINGS,
  loadBridgeSettings,
  type BridgeSettings,
  type PluginSettingsReader,
} from "./settings";
import { BridgeState, type BridgeEvent, type DisplayState } from "./state";
import { detectTerminal, shouldEmitTitles } from "./terminal";
import { baseTitleFromContext, composeTitle } from "./title";

interface TestOverrides {
  env?: Record<string, string | undefined>;
  settings?: Record<string, unknown>;
  settingsReader?: PluginSettingsReader;
}

interface Runtime {
  state: BridgeState;
  settings: BridgeSettings;
  terminal: ReturnType<typeof detectTerminal>;
  backend: TitleBackend;
  outputEnabled: boolean;
  lastState: DisplayState;
  lastTitle: string;
}

function canUseUiTitle(ctx: ExtensionContext): ctx is ExtensionContext & { ui: { setTitle: (title: string) => void } } {
  return typeof ctx.ui?.setTitle === "function";
}

function isContextIdle(ctx: ExtensionContext): boolean {
  return typeof ctx.isIdle === "function" ? ctx.isIdle() : false;
}

function notify(ctx: ExtensionContext, message: string): void {
  if (typeof ctx.ui?.notify === "function") {
    ctx.ui.notify(message, "info");
  }
}

function createRuntime(ctx: ExtensionContext, settings: BridgeSettings, terminal: ReturnType<typeof detectTerminal>): Runtime {
  const outputEnabled = shouldEmitTitles(terminal, settings);
  const backend = !outputEnabled
    ? createDevNullBackend(settings.backend)
    : settings.backend === "osc-tty"
      ? createOscTtyBackend()
      : canUseUiTitle(ctx)
        ? createUiTitleBackend(ctx)
        : createDevNullBackend(settings.backend);
  return {
    state: new BridgeState(),
    settings,
    terminal,
    backend,
    outputEnabled,
    lastState: { kind: "idle", label: "", glyph: "" },
    lastTitle: "",
  };
}

function toBridgeEvent(event: Record<string, unknown>): BridgeEvent | null {
  switch (event.type) {
    case "session_start":
    case "session_shutdown":
    case "agent_start":
    case "agent_end":
    case "turn_start":
    case "turn_end":
    case "session_before_compact":
    case "session.compacting":
    case "session_compact":
    case "auto_compaction_end":
    case "auto_retry_end":
      return { type: event.type };
    case "tool_execution_start":
      return typeof event.toolCallId === "string" && typeof event.toolName === "string"
        ? { type: event.type, toolCallId: event.toolCallId, toolName: event.toolName }
        : null;
    case "tool_execution_end":
      return typeof event.toolCallId === "string" ? { type: event.type, toolCallId: event.toolCallId } : null;
    case "tool_approval_requested":
      return typeof event.toolCallId === "string" && typeof event.toolName === "string"
        ? { type: "tool_approval_requested", toolCallId: event.toolCallId, toolName: event.toolName }
        : null;
    case "tool_approval_resolved":
      return typeof event.toolCallId === "string" ? { type: "tool_approval_resolved", toolCallId: event.toolCallId } : null;
    case "auto_compaction_start":
      return typeof event.action === "string" ? { type: "auto_compaction_start", action: event.action } : null;
    case "auto_retry_start":
      return typeof event.attempt === "number" && typeof event.maxAttempts === "number"
        ? { type: "auto_retry_start", attempt: event.attempt, maxAttempts: event.maxAttempts }
        : null;
    default:
      return null;
  }
}

export default function ompOttyBridge(pi: ExtensionAPI, overrides: TestOverrides = {}): void {
  const terminal = detectTerminal(overrides.env);
  let runtime: Runtime | null = null;
  let runtimePromise: Promise<Runtime> | null = null;

  const getRuntime = async (ctx: ExtensionContext): Promise<Runtime> => {
    if (runtime) return runtime;
    runtimePromise ??= loadBridgeSettings(ctx.cwd, overrides.settings, overrides.settingsReader).then(
      (settings) => createRuntime(ctx, settings, terminal),
    );
    runtime = await runtimePromise;
    return runtime;
  };

  const handle = async (event: Record<string, unknown>, ctx: ExtensionContext): Promise<void> => {
    try {
      const activeRuntime = await getRuntime(ctx);
      const bridgeEvent = toBridgeEvent(event);
      if (bridgeEvent) activeRuntime.state.apply(bridgeEvent);
      const snapshot = activeRuntime.state.snapshot(isContextIdle(ctx), activeRuntime.settings);
      const title = composeTitle(baseTitleFromContext(ctx), snapshot, activeRuntime.settings);
      activeRuntime.lastState = snapshot;
      if (title !== activeRuntime.lastTitle) {
        activeRuntime.backend.setTitle(title);
        activeRuntime.lastTitle = title;
      }
    } catch (error) {
      pi.logger.warn("omp-otty-bridge handler failed", { error: String(error) });
    }
  };

  pi.on("session_start", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("session_shutdown", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("session_before_compact", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("session.compacting", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("session_compact", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("agent_start", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("agent_end", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("turn_start", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("turn_end", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("tool_execution_start", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("tool_execution_end", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("tool_approval_requested", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("tool_approval_resolved", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("auto_compaction_start", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("auto_compaction_end", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("auto_retry_start", (event, ctx) => handle(event as Record<string, unknown>, ctx));
  pi.on("auto_retry_end", (event, ctx) => handle(event as Record<string, unknown>, ctx));

  pi.registerCommand("otty-status", {
    description: "Show OMP Otty bridge status",
    handler: async (_args, ctx) => {
      const activeRuntime = await getRuntime(ctx);
      const report = formatDiagnostics({
        detectedOtty: activeRuntime.terminal.isOtty,
        outputEnabled: activeRuntime.outputEnabled,
        settings: activeRuntime.settings,
        backendName: activeRuntime.backend.name,
        lastState: activeRuntime.lastState,
        lastTitle: activeRuntime.lastTitle,
        terminal: activeRuntime.terminal.diagnostics,
      });
      notify(ctx, report);
    },
  });
}

export { DEFAULT_SETTINGS };
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test test/index.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Run all tests and typecheck**

```bash
bun test
bun run typecheck
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts test/index.test.ts
git commit -m "feat: wire omp otty bridge extension"
```

---

### Task 10: README And Release Checklist

**Files:**
- Modify: `README.md`
- Modify: `docs/release-checklist.md`

- [ ] **Step 1: Expand `README.md`**

Replace `README.md` with:

````md
# omp-otty-bridge

`omp-otty-bridge` is an OMP extension for Otty users. It shows live OMP state in the Otty tab title using stable OMP extension APIs.

## What It Does

- Shows OMP state in the tab title while running inside Otty.
- Defaults to detailed title text such as `▶ π: project · bash`.
- Restores the base OMP title when OMP returns to idle.
- Provides `/otty-status` for diagnostics.

## What It Does Not Do

- It does not provide native Otty badges, Otty notifications, or Otty agent history.
- It does not spoof Claude Code, Codex, or OpenCode.
- It does not use private Otty IPC or process-name detection.

Native Otty parity requires Otty to expose a stable custom-agent API or support OMP directly.

## Requirements

- OMP 16.3.4 or newer.
- Otty for default activation.
- Bun-compatible OMP plugin loading.

## Install

```bash
omp install github:mainuli/omp-otty-bridge
```

Project-local development/testing:

```bash
omp plugin link .
```

OMP 16.3.4 warns and ignores `--scope` for GitHub targets; project scope may apply to future marketplace refs if OMP supports it.

Restart OMP after installing.

## Configure

List settings:

```bash
omp plugin config list omp-otty-bridge
```

Set minimal mode:

```bash
omp plugin config set omp-otty-bridge mode minimal
```

Enable outside Otty:

```bash
omp plugin config set omp-otty-bridge nonOttyBehavior enabled
```

## Diagnostics

Inside OMP, run:

```text
/otty-status
```

The report shows Otty detection, output status, backend, state, last emitted title, and relevant terminal environment values.

## Troubleshooting

If the title does not update:

1. Confirm OMP is running inside Otty.
2. Confirm `TERM_PROGRAM=otty` in the OMP environment.
3. Run `/otty-status`.
4. Confirm `enabled` is `true`.
5. Confirm `backend` is `ui-title`.
6. Re-run the manual smoke test in `docs/release-checklist.md`.

## Development

```bash
bun install
bun test
bun run typecheck
omp plugin link .
```

## License

MIT
````

- [ ] **Step 2: Add implementation release checklist details**

Ensure `docs/release-checklist.md` contains:

````md
# Release Checklist

## Automated Checks

```bash
bun test
bun run typecheck
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/extensions").then(() => console.log("extensions export ok"))'
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/plugins").then((m) => console.log(typeof m.getPluginSettings))'
omp plugin link .
omp install github:mainuli/omp-otty-bridge --dry-run
```

## Compatibility Spike

- OMP version tested: 16.3.4
- Extension import surface: pass
- Plugin settings import surface: pass
- Otty title API: pass
- Base title API: pass
- Idle API: pass
- Notify API: pass
- Context cwd API: pass
- Primary backend for v1: ui-title
- Compatibility notes: `ctx.ui.setTitle()` updates the Otty tab title; `ctx.sessionManager.getSessionName()`, `ctx.isIdle()`, `ctx.ui.notify()`, and `ctx.cwd` are available; `getPluginSettings(pluginName, cwd)` is exported.

## Manual Otty Smoke Test

- Install or link the plugin.
- Start OMP inside Otty.
- Run `/otty-status` before the first prompt to confirm the linked plugin loaded from `package.json#omp.extensions`.
- Send a prompt that triggers at least one tool call.
- Confirm the tab title changes from `π: <title>` to `▶ π: <title> · <state>`.
- Trigger `/otty-status`.
- Confirm the diagnostic command reports Otty detected, backend `ui-title`, and output enabled.
- Let OMP return to idle.
- Confirm the tab title restores to `π: <title>`.
````

- [ ] **Step 3: Commit**

```bash
git add README.md docs/release-checklist.md
git commit -m "docs: document install configuration and release checks"
```

---

### Task 11: Final Verification

**Files:**
- Modify only if verification reveals a documented mismatch.

- [ ] **Step 1: Run all automated checks**

```bash
bun test
bun run typecheck
omp plugin link .
```

Expected: all commands pass.

- [ ] **Step 2: Validate install dry-run**

```bash
omp install github:mainuli/omp-otty-bridge --dry-run
```

Expected: OMP reports a successful dry run or displays the intended install action without manifest validation errors.

- [ ] **Step 3: Validate linked plugin runtime load**

From an Otty tab after `omp plugin link .`, start OMP in this repository and run:

```text
/otty-status
```

Expected: the command exists and reports Otty detection, output status, backend, and settings. If the command is unknown, OMP did not load `src/index.ts` from `package.json#omp.extensions`.

- [ ] **Step 4: Run manual Otty smoke test**

Follow `docs/release-checklist.md`.

Expected: Otty title updates through `ui-title`, `/otty-status` reports output enabled, and idle restores the base title.

- [ ] **Step 5: Fix any verification mismatch**

If a command fails, make the smallest code or documentation change that aligns implementation with the spec. Then rerun the failed command and the full command set:

```bash
bun test
bun run typecheck
omp plugin link .
```

Expected: all commands pass.

- [ ] **Step 6: Commit final verification fixes**

If Step 5 changed files:

```bash
git add .
git commit -m "fix: align bridge with release verification"
```

If Step 5 did not change files, do not create an empty commit.
