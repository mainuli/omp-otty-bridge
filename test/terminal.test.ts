import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, type BridgeSettings } from "../src/settings";
import { detectTerminal, shouldEmitTitles, type TerminalDetection } from "../src/terminal";

describe("detectTerminal", () => {
  test("detects Otty only from TERM_PROGRAM", () => {
    expect(detectTerminal({ TERM_PROGRAM: "otty" })).toStrictEqual({
      isOtty: true,
      diagnostics: {
        termProgram: "otty",
      },
    });

    expect(
      detectTerminal({
        TERM_PROGRAM: "Apple_Terminal",
        CW_TERM: "otty",
        OTTY_SHELL_INTEGRATION: "1",
      }),
    ).toStrictEqual({
      isOtty: false,
      diagnostics: {
        termProgram: "Apple_Terminal",
        cwTerm: "otty",
        ottyShellIntegration: "1",
      },
    });
  });

  test("reports secondary Otty values for diagnostics", () => {
    expect(
      detectTerminal({
        CW_TERM: "otty",
        OTTY_SHELL_INTEGRATION: "enabled",
      }),
    ).toStrictEqual({
      isOtty: false,
      diagnostics: {
        cwTerm: "otty",
        ottyShellIntegration: "enabled",
      },
    });
  });
});

describe("shouldEmitTitles", () => {
  const ottyTerminal: TerminalDetection = {
    isOtty: true,
    diagnostics: {
      termProgram: "otty",
    },
  };

  const nonOttyTerminal: TerminalDetection = {
    isOtty: false,
    diagnostics: {
      termProgram: "Apple_Terminal",
    },
  };

  function settings(overrides: Partial<BridgeSettings> = {}): BridgeSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...overrides,
    };
  }

  test("emits in Otty when enabled", () => {
    expect(shouldEmitTitles(ottyTerminal, settings({ enabled: true }))).toBe(true);
  });

  test("suppresses outside Otty by default", () => {
    expect(shouldEmitTitles(nonOttyTerminal, settings())).toBe(false);
  });

  test("allows non-Otty when setting enabled", () => {
    expect(
      shouldEmitTitles(
        nonOttyTerminal,
        settings({
          nonOttyBehavior: "enabled",
        }),
      ),
    ).toBe(true);
  });

  test("suppresses when disabled", () => {
    expect(
      shouldEmitTitles(
        ottyTerminal,
        settings({
          enabled: false,
          nonOttyBehavior: "enabled",
        }),
      ),
    ).toBe(false);
  });
});
