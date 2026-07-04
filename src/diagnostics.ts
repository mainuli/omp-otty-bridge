import type { BackendName, BridgeSettings } from "./settings";
import type { DisplayState } from "./state";
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

export function formatDiagnostics(input: DiagnosticsInput): string {
  const stateLabel = input.lastState.label === "" ? "" : ` (${input.lastState.label})`;

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
  return value ?? "(unset)";
}
