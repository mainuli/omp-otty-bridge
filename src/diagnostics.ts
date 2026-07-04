import type { BackendName, BridgeSettings } from "./settings";
import type { DisplayState } from "./state";
import type { TerminalDiagnostics } from "./terminal";
import { sanitizeTitle } from "./title";

const ASCII_CONTROLS = /[\x00-\x1f\x7f]/g;

export interface DiagnosticsInput {
  detectedOtty: boolean;
  outputEnabled: boolean;
  settings: BridgeSettings;
  backendName: BackendName;
  lastState: DisplayState;
  lastTitle: string;
  terminal: TerminalDiagnostics;
}

export function formatDiagnostics(input: DiagnosticsInput): string {
  const sanitizedStateLabel = sanitizeReportField(input.lastState.label);
  const stateLabel = sanitizedStateLabel === "" ? "" : ` (${sanitizedStateLabel})`;

  return [
    "OMP Otty Bridge",
    `Otty detected: ${formatBoolean(input.detectedOtty)}`,
    `Output enabled: ${formatBoolean(input.outputEnabled)}`,
    `Backend: ${input.backendName}`,
    `State: ${input.lastState.kind}${stateLabel}`,
    `Last title: ${sanitizeTitle(input.lastTitle, input.settings.maxTitleLength)}`,
    `TERM_PROGRAM: ${formatTerminalValue(input.terminal.termProgram)}`,
    `CW_TERM: ${formatTerminalValue(input.terminal.cwTerm)}`,
    `OTTY_SHELL_INTEGRATION: ${formatTerminalValue(input.terminal.ottyShellIntegration)}`,
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
  return value.replace(ASCII_CONTROLS, "");
}
