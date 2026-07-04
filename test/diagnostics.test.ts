import { describe, expect, test } from "bun:test";
import { formatDiagnostics, type DiagnosticsInput } from "../src/diagnostics";
import { DEFAULT_SETTINGS, type BridgeSettings } from "../src/settings";

function settings(overrides: Partial<BridgeSettings> = {}): BridgeSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };
}

function diagnosticsInput(overrides: Partial<DiagnosticsInput> = {}): DiagnosticsInput {
  return {
    detectedOtty: true,
    outputEnabled: true,
    settings: settings(),
    backendName: "ui-title",
    lastState: {
      kind: "tool",
      label: "bash",
      glyph: "▶",
    },
    lastTitle: "π: project",
    terminal: {
      termProgram: "otty",
      cwTerm: "otty",
      ottyShellIntegration: "enabled",
    },
    ...overrides,
  };
}

describe("formatDiagnostics", () => {
  test("formats bridge status and contains detected Otty status", () => {
    const report = formatDiagnostics(diagnosticsInput());

    expect(report).toContain("OMP Otty Bridge");
    expect(report).toContain("Otty detected: yes");
    expect(report).toContain("Output enabled: yes");
    expect(report).toContain("Backend: ui-title");
    expect(report).toContain("State: tool (bash)");
    expect(report).toContain("TERM_PROGRAM: otty");
    expect(report).toContain("CW_TERM: otty");
    expect(report).toContain("OTTY_SHELL_INTEGRATION: enabled");
    expect(report).toContain(`Settings: ${JSON.stringify(DEFAULT_SETTINGS)}`);
  });

  test("sanitizes last emitted title", () => {
    const report = formatDiagnostics(
      diagnosticsInput({
        settings: settings({ maxTitleLength: 10 }),
        lastTitle: "abc\u0000def\u001fghijkl",
      }),
    );

    expect(report).toContain("Last title: abcdefghij");
    expect(report).not.toContain("\u0000");
    expect(report).not.toContain("\u001f");
  });

  test("includes unset marker for missing terminal diagnostics", () => {
    const report = formatDiagnostics(
      diagnosticsInput({
        detectedOtty: false,
        outputEnabled: false,
        terminal: {},
      }),
    );

    expect(report).toContain("Otty detected: no");
    expect(report).toContain("Output enabled: no");
    expect(report).toContain("TERM_PROGRAM: (unset)");
    expect(report).toContain("CW_TERM: (unset)");
    expect(report).toContain("OTTY_SHELL_INTEGRATION: (unset)");
  });

  test("formats state label only when non-empty", () => {
    expect(formatDiagnostics(diagnosticsInput())).toContain("State: tool (bash)");
    expect(
      formatDiagnostics(
        diagnosticsInput({
          lastState: {
            kind: "idle",
            label: "",
            glyph: "",
          },
        }),
      ),
    ).toContain("State: idle\n");
  });
});
