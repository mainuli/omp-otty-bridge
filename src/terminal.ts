import type { BridgeSettings } from "./settings";

export type TerminalDiagnostics = {
  termProgram?: string;
  cwTerm?: string;
  ottyShellIntegration?: string;
};

export type TerminalDetection = {
  isOtty: boolean;
  diagnostics: TerminalDiagnostics;
};

type TerminalEnv = Record<string, string | undefined>;

export function detectTerminal(env: TerminalEnv = process.env): TerminalDetection {
  const diagnostics: TerminalDiagnostics = {};

  if (env.TERM_PROGRAM !== undefined) {
    diagnostics.termProgram = env.TERM_PROGRAM;
  }

  if (env.CW_TERM !== undefined) {
    diagnostics.cwTerm = env.CW_TERM;
  }

  if (env.OTTY_SHELL_INTEGRATION !== undefined) {
    diagnostics.ottyShellIntegration = env.OTTY_SHELL_INTEGRATION;
  }

  return {
    isOtty: env.TERM_PROGRAM === "otty",
    diagnostics,
  };
}

export function shouldEmitTitles(
  terminal: TerminalDetection,
  settings: BridgeSettings,
): boolean {
  if (!settings.enabled) {
    return false;
  }

  return terminal.isOtty || settings.nonOttyBehavior === "enabled";
}
