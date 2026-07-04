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

  test("strips C0, DEL, and C1 controls from state labels", () => {
    const report = formatDiagnostics(
      diagnosticsInput({
        lastState: {
          kind: "tool",
          label: "bash\nOutput enabled: yes\u001b[31m\u0000\u0085\u009b",
          glyph: "▶",
        },
      }),
    );

    const stateLine = report.split("\n").find((line) => line.startsWith("State: "));

    expect(stateLine).toBe("State: tool (bashOutput enabled: yes[31m)");
    expect(report).not.toContain("\u001b");
    expect(report).not.toContain("\u0000");
    expect(report).not.toContain("\u0085");
    expect(report).not.toContain("\u009b");
  });

  test("strips C0, DEL, and C1 controls from terminal diagnostics", () => {
    const report = formatDiagnostics(
      diagnosticsInput({
        terminal: {
          termProgram: "otty\nBackend: spoofed\u001b[31m\u0085",
          cwTerm: "cw\rState: spoofed\u0007\u009b",
          ottyShellIntegration: "enabled\u0000\nLast title: spoofed\u007f\u0085",
        },
      }),
    );

    expect(report).toContain("TERM_PROGRAM: ottyBackend: spoofed[31m");
    expect(report).toContain("CW_TERM: cwState: spoofed");
    expect(report).toContain("OTTY_SHELL_INTEGRATION: enabledLast title: spoofed");
    expect(report).not.toContain("\nBackend: spoofed");
    expect(report).not.toContain("\rState: spoofed");
    expect(report).not.toContain("\nLast title: spoofed");
    expect(report).not.toContain("\u001b");
    expect(report).not.toContain("\u0007");
    expect(report).not.toContain("\u0000");
    expect(report).not.toContain("\u007f");
    expect(report).not.toContain("\u0085");
    expect(report).not.toContain("\u009b");
  });
});
