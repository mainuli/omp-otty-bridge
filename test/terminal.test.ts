import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, type BridgeSettings } from "../src/settings";
import {
  decideTitleOutput,
  detectTerminal,
  type MultiplexerName,
  type TerminalDetection,
} from "../src/terminal";

const NESTED_MULTIPLEXERS: readonly MultiplexerName[] = ["tmux", "zellij", "screen"];

function settings(overrides: Partial<BridgeSettings> = {}): BridgeSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };
}

function terminal(
  isOtty: boolean,
  multiplexers: readonly MultiplexerName[] = [],
): TerminalDetection {
  return {
    isOtty,
    multiplexers,
    diagnostics: {
      termProgram: isOtty ? "otty" : "Apple_Terminal",
    },
  };
}

describe("detectTerminal", () => {
  test("detects direct Otty only from the exact TERM_PROGRAM value", () => {
    expect(detectTerminal({ TERM_PROGRAM: "otty" })).toStrictEqual({
      isOtty: true,
      multiplexers: [],
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
      multiplexers: [],
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
      multiplexers: [],
      diagnostics: {
        cwTerm: "otty",
        ottyShellIntegration: "enabled",
      },
    });
  });

  test("detects every non-empty multiplexer marker under inherited Otty", () => {
    const cases: ReadonlyArray<{
      name: MultiplexerName;
      env: Record<string, string>;
    }> = [
      { name: "herdr", env: { HERDR_ENV: "1" } },
      { name: "tmux", env: { TMUX: "/tmp/tmux-501/default,1,0" } },
      { name: "zellij", env: { ZELLIJ: "0" } },
      { name: "screen", env: { STY: "12345.pts-0.host" } },
    ];

    for (const { name, env } of cases) {
      expect(detectTerminal({ TERM_PROGRAM: "otty", ...env })).toStrictEqual({
        isOtty: true,
        multiplexers: [name],
        diagnostics: {
          termProgram: "otty",
        },
      });
    }
  });

  test("retains all multiplexer markers in stable diagnostic order", () => {
    expect(
      detectTerminal({
        TERM_PROGRAM: "otty",
        STY: "screen-session",
        ZELLIJ: "zellij-session",
        TMUX: "/tmp/tmux",
        HERDR_ENV: "1",
      }),
    ).toStrictEqual({
      isOtty: true,
      multiplexers: ["herdr", "tmux", "zellij", "screen"],
      diagnostics: {
        termProgram: "otty",
      },
    });
  });

  test("ignores empty markers and noncanonical Herdr values", () => {
    expect(
      detectTerminal({
        TERM_PROGRAM: "otty",
        HERDR_ENV: "true",
        TMUX: "",
        ZELLIJ: "",
        STY: "",
      }),
    ).toStrictEqual({
      isOtty: true,
      multiplexers: [],
      diagnostics: {
        termProgram: "otty",
      },
    });
  });
});

describe("decideTitleOutput", () => {
  test("enables direct Otty output", () => {
    expect(decideTitleOutput(terminal(true), settings())).toEqual({
      enabled: true,
      reason: "direct-otty",
    });
  });

  test("treats enabled false as the highest-precedence hard-off switch", () => {
    expect(
      decideTitleOutput(
        terminal(true, ["herdr", "tmux", "zellij", "screen"]),
        settings({
          enabled: false,
          multiplexerBehavior: "enabled",
          nonOttyBehavior: "enabled",
        }),
      ),
    ).toEqual({
      enabled: false,
      reason: "disabled-by-setting",
    });
  });

  test("suppresses tmux, Zellij, and screen under inherited Otty by default", () => {
    for (const multiplexer of NESTED_MULTIPLEXERS) {
      expect(decideTitleOutput(terminal(true, [multiplexer]), settings())).toEqual({
        enabled: false,
        reason: "multiplexer-disabled",
      });
    }
  });

  test("allows best-effort tmux, Zellij, and screen output when opted in", () => {
    for (const multiplexer of NESTED_MULTIPLEXERS) {
      expect(
        decideTitleOutput(
          terminal(true, [multiplexer]),
          settings({ multiplexerBehavior: "enabled" }),
        ),
      ).toEqual({
        enabled: true,
        reason: "multiplexer-enabled",
      });
    }
  });

  test("always delegates Herdr even when every opt-in is enabled", () => {
    expect(
      decideTitleOutput(
        terminal(true, ["herdr", "tmux", "zellij", "screen"]),
        settings({
          multiplexerBehavior: "enabled",
          nonOttyBehavior: "enabled",
        }),
      ),
    ).toEqual({
      enabled: false,
      reason: "delegated-to-herdr",
    });
  });

  test("requires the non-Otty opt-in outside Otty", () => {
    expect(decideTitleOutput(terminal(false), settings())).toEqual({
      enabled: false,
      reason: "non-otty-disabled",
    });
    expect(
      decideTitleOutput(terminal(false), settings({ nonOttyBehavior: "enabled" })),
    ).toEqual({
      enabled: true,
      reason: "non-otty-enabled",
    });
  });

  test("requires both opt-ins for a non-Otty nested multiplexer", () => {
    expect(
      decideTitleOutput(
        terminal(false, ["tmux"]),
        settings({
          multiplexerBehavior: "disabled",
          nonOttyBehavior: "enabled",
        }),
      ),
    ).toEqual({
      enabled: false,
      reason: "multiplexer-disabled",
    });
    expect(
      decideTitleOutput(
        terminal(false, ["tmux"]),
        settings({
          multiplexerBehavior: "enabled",
          nonOttyBehavior: "disabled",
        }),
      ),
    ).toEqual({
      enabled: false,
      reason: "non-otty-disabled",
    });
    expect(
      decideTitleOutput(
        terminal(false, ["tmux"]),
        settings({
          multiplexerBehavior: "enabled",
          nonOttyBehavior: "enabled",
        }),
      ),
    ).toEqual({
      enabled: true,
      reason: "multiplexer-enabled",
    });
  });
});
