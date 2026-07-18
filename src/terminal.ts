import type { BridgeSettings } from "./settings";

export type MultiplexerName = "herdr" | "tmux" | "zellij" | "screen";

export type TerminalDiagnostics = {
  termProgram?: string;
  cwTerm?: string;
  ottyShellIntegration?: string;
};

export type TerminalDetection = {
  isOtty: boolean;
  multiplexers: readonly MultiplexerName[];
  diagnostics: TerminalDiagnostics;
};

export type TitleOutputReason =
  | "disabled-by-setting"
  | "delegated-to-herdr"
  | "multiplexer-disabled"
  | "non-otty-disabled"
  | "direct-otty"
  | "multiplexer-enabled"
  | "non-otty-enabled";

export type TitleOutputDecision = {
  enabled: boolean;
  reason: TitleOutputReason;
};

type TerminalEnv = Record<string, string | undefined>;

export function detectTerminal(env: TerminalEnv = process.env): TerminalDetection {
  const diagnostics: TerminalDiagnostics = {};
  const multiplexers: MultiplexerName[] = [];

  if (env.TERM_PROGRAM !== undefined) {
    diagnostics.termProgram = env.TERM_PROGRAM;
  }

  if (env.CW_TERM !== undefined) {
    diagnostics.cwTerm = env.CW_TERM;
  }

  if (env.OTTY_SHELL_INTEGRATION !== undefined) {
    diagnostics.ottyShellIntegration = env.OTTY_SHELL_INTEGRATION;
  }

  if (env.HERDR_ENV === "1") {
    multiplexers.push("herdr");
  }

  if (env.TMUX) {
    multiplexers.push("tmux");
  }

  if (env.ZELLIJ) {
    multiplexers.push("zellij");
  }

  if (env.STY) {
    multiplexers.push("screen");
  }

  return {
    isOtty: env.TERM_PROGRAM === "otty",
    multiplexers,
    diagnostics,
  };
}

export function decideTitleOutput(
  terminal: TerminalDetection,
  settings: BridgeSettings,
): TitleOutputDecision {
  if (!settings.enabled) {
    return { enabled: false, reason: "disabled-by-setting" };
  }

  if (terminal.multiplexers.includes("herdr")) {
    return { enabled: false, reason: "delegated-to-herdr" };
  }

  const isMultiplexed = terminal.multiplexers.length > 0;

  if (isMultiplexed && settings.multiplexerBehavior === "disabled") {
    return { enabled: false, reason: "multiplexer-disabled" };
  }

  if (!terminal.isOtty && settings.nonOttyBehavior === "disabled") {
    return { enabled: false, reason: "non-otty-disabled" };
  }

  if (isMultiplexed) {
    return { enabled: true, reason: "multiplexer-enabled" };
  }

  if (terminal.isOtty) {
    return { enabled: true, reason: "direct-otty" };
  }

  return { enabled: true, reason: "non-otty-enabled" };
}
