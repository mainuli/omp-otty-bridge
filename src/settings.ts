import { getPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins";

export type BridgeMode = "minimal" | "detailed";
export type TitleFormat = "glyph-label" | "label-only" | "glyph-only";
export type NonOttyBehavior = "disabled" | "enabled";
export type BackendName = "ui-title" | "osc-tty";

export type BridgeSettings = {
  enabled: boolean;
  mode: BridgeMode;
  titleFormat: TitleFormat;
  maxTitleLength: number;
  nonOttyBehavior: NonOttyBehavior;
  backend: BackendName;
};

export const PLUGIN_NAME = "omp-otty-bridge";

export type PluginSettingsReader = (
  pluginName: string,
  cwd: string,
) => Promise<Record<string, unknown>>;

export const DEFAULT_SETTINGS: BridgeSettings = {
  enabled: true,
  mode: "detailed",
  titleFormat: "glyph-label",
  maxTitleLength: 120,
  nonOttyBehavior: "disabled",
  backend: "ui-title",
};

const BRIDGE_MODES: readonly BridgeMode[] = ["minimal", "detailed"];
const TITLE_FORMATS: readonly TitleFormat[] = ["glyph-label", "label-only", "glyph-only"];
const NON_OTTY_BEHAVIORS: readonly NonOttyBehavior[] = ["disabled", "enabled"];
const BACKEND_NAMES: readonly BackendName[] = ["ui-title", "osc-tty"];

function normalizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeMaxTitleLength(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.maxTitleLength;
  }

  return Math.min(240, Math.max(40, Math.floor(value)));
}

export function normalizeSettings(input: Record<string, unknown> = {}): BridgeSettings {
  return {
    enabled: normalizeBoolean(input.enabled, DEFAULT_SETTINGS.enabled),
    mode: normalizeEnum(input.mode, BRIDGE_MODES, DEFAULT_SETTINGS.mode),
    titleFormat: normalizeEnum(
      input.titleFormat,
      TITLE_FORMATS,
      DEFAULT_SETTINGS.titleFormat,
    ),
    maxTitleLength: normalizeMaxTitleLength(input.maxTitleLength),
    nonOttyBehavior: normalizeEnum(
      input.nonOttyBehavior,
      NON_OTTY_BEHAVIORS,
      DEFAULT_SETTINGS.nonOttyBehavior,
    ),
    backend: normalizeEnum(input.backend, BACKEND_NAMES, DEFAULT_SETTINGS.backend),
  };
}

export async function loadBridgeSettings(
  cwd: string,
  overrides?: Record<string, unknown>,
  reader: PluginSettingsReader = getPluginSettings,
): Promise<BridgeSettings> {
  if (overrides !== undefined) {
    return normalizeSettings(overrides);
  }

  try {
    return normalizeSettings(await reader(PLUGIN_NAME, cwd));
  } catch {
    return DEFAULT_SETTINGS;
  }
}
