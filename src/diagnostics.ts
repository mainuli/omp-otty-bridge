import type { BackendName, BridgeSettings } from "./settings";
import type { DisplayState } from "./state";
import type { TerminalDetection, TitleOutputDecision } from "./terminal";
import { sanitizeTitle } from "./title";

const CONTROL_CHARS = /[\x00-\x1f\x7f-\x9f]/g;

export interface DiagnosticsInput {
  terminal: TerminalDetection;
  outputDecision: TitleOutputDecision;
  settings: BridgeSettings;
  backendName: BackendName;
  lastState: DisplayState;
  lastComposedTitle: string;
}

export function formatDiagnostics(input: DiagnosticsInput): string {
  const sanitizedStateLabel = sanitizeReportField(input.lastState.label);
  const stateLabel = sanitizedStateLabel === "" ? "" : ` (${sanitizedStateLabel})`;

  return [
    "OMP Otty Bridge",
    `Otty detected: ${formatBoolean(input.terminal.isOtty)}`,
    `Multiplexers: ${
      input.terminal.multiplexers.length === 0
        ? "none"
        : input.terminal.multiplexers.join(", ")
    }`,
    `Output enabled: ${formatBoolean(input.outputDecision.enabled)}`,
    `Output reason: ${input.outputDecision.reason}`,
    `Backend: ${input.backendName}`,
    `State: ${input.lastState.kind}${stateLabel}`,
    `Last composed title: ${sanitizeTitle(
      input.lastComposedTitle,
      input.settings.maxTitleLength,
    )}`,
    `TERM_PROGRAM: ${formatTerminalValue(input.terminal.diagnostics.termProgram)}`,
    `CW_TERM: ${formatTerminalValue(input.terminal.diagnostics.cwTerm)}`,
    `OTTY_SHELL_INTEGRATION: ${formatTerminalValue(
      input.terminal.diagnostics.ottyShellIntegration,
    )}`,
    `Settings: ${JSON.stringify(input.settings)}`,
  ].join("\n");
}

function formatBoolean(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}


function formatTerminalValue(value: string | undefined): string {
  return value === undefined ? "(unset)" : sanitizeReportField(value);
}

function sanitizeReportField(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}
