import type {
  ExtensionAPI,
  ExtensionContext,
} from "@oh-my-pi/pi-coding-agent/extensibility/extensions";
import {
  createDevNullBackend,
  createOscTtyBackend,
  createUiTitleBackend,
  type TitleBackend,
} from "./backend";
import { formatDiagnostics } from "./diagnostics";
import {
  loadBridgeSettings,
  type BridgeSettings,
  type PluginSettingsReader,
} from "./settings";
import { BridgeState, type BridgeEvent, type DisplayState } from "./state";
import { detectTerminal, shouldEmitTitles, type TerminalDetection } from "./terminal";
import { baseTitleFromContext, composeTitle } from "./title";

export interface TestOverrides {
  env?: Record<string, string | undefined>;
  settings?: Record<string, unknown>;
  settingsReader?: PluginSettingsReader;
  backendFactories?: {
    oscTty?: () => TitleBackend;
  };
}

type Runtime = {
  state: BridgeState;
  settings: BridgeSettings;
  terminal: TerminalDetection;
  backend: TitleBackend;
  outputEnabled: boolean;
  lastState: DisplayState;
  lastTitle: string;
};

const IDLE_STATE: DisplayState = {
  kind: "idle",
  label: "",
  glyph: "",
};

function hasUiTitle(ctx: ExtensionContext): ctx is ExtensionContext & {
  ui: { setTitle: (title: string) => void };
} {
  return typeof ctx.ui?.setTitle === "function";
}

function hasNotify(ctx: ExtensionContext): ctx is ExtensionContext & {
  ui: { notify: (message: string, type?: "info" | "warning" | "error") => void };
} {
  return typeof ctx.ui?.notify === "function";
}

function isContextIdle(ctx: ExtensionContext): boolean {
  return typeof ctx.isIdle === "function" ? ctx.isIdle() : false;
}

function notify(ctx: ExtensionContext, message: string): void {
  if (hasNotify(ctx)) {
    ctx.ui.notify(message, "info");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function createRuntime(
  ctx: ExtensionContext,
  settings: BridgeSettings,
  terminal: TerminalDetection,
  overrides: TestOverrides,
): Runtime {
  const outputEnabled = shouldEmitTitles(terminal, settings);
  const backend = createBackend(ctx, settings, outputEnabled, overrides);

  return {
    state: new BridgeState(),
    settings,
    terminal,
    backend,
    outputEnabled,
    lastState: IDLE_STATE,
    lastTitle: "",
  };
}

function createBackend(
  ctx: ExtensionContext,
  settings: BridgeSettings,
  outputEnabled: boolean,
  overrides: TestOverrides,
): TitleBackend {
  if (!outputEnabled) {
    return createDevNullBackend(settings.backend);
  }

  if (settings.backend === "osc-tty") {
    return overrides.backendFactories?.oscTty?.() ?? createOscTtyBackend();
  }

  if (hasUiTitle(ctx)) {
    return createUiTitleBackend(ctx);
  }

  return createDevNullBackend("ui-title");
}

function toBridgeEvent(value: unknown): BridgeEvent | null {
  const event = asRecord(value);

  if (event === null) {
    return null;
  }

  switch (event.type) {
    case "session_start":
    case "session_shutdown":
    case "session_stop":
    case "session_switch":
    case "session_branch":
    case "agent_start":
    case "agent_end":
    case "turn_start":
    case "turn_end":
    case "session_before_compact":
    case "session.compacting":
    case "session_compact":
    case "auto_compaction_end":
    case "auto_retry_end":
      return { type: event.type };

    case "tool_execution_start":
    case "tool_call":
      if (typeof event.toolCallId !== "string" || typeof event.toolName !== "string") {
        return null;
      }

      return {
        type: event.type,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      };

    case "tool_execution_end":
    case "tool_result":
      if (typeof event.toolCallId !== "string") {
        return null;
      }

      return {
        type: event.type,
        toolCallId: event.toolCallId,
      };

    case "tool_approval_requested":
      if (typeof event.toolCallId !== "string") {
        return null;
      }

      return {
        type: "tool_approval_requested",
        toolCallId: event.toolCallId,
        ...(typeof event.toolName === "string" ? { toolName: event.toolName } : {}),
      };

    case "tool_approval_resolved":
      if (typeof event.toolCallId !== "string") {
        return null;
      }

      return {
        type: "tool_approval_resolved",
        toolCallId: event.toolCallId,
      };

    case "auto_compaction_start":
      return {
        type: "auto_compaction_start",
        ...(typeof event.action === "string" ? { action: event.action } : {}),
      };

    case "auto_retry_start":
      return {
        type: "auto_retry_start",
        ...(typeof event.attempt === "number" ? { attempt: event.attempt } : {}),
        ...(typeof event.maxAttempts === "number" ? { maxAttempts: event.maxAttempts } : {}),
      };

    default:
      return null;
  }
}

function shouldForceIdle(bridgeEvent: BridgeEvent | null): boolean {
  return bridgeEvent?.type === "session_shutdown" || bridgeEvent?.type === "session_stop";
}

export default function ompOttyBridge(
  pi: ExtensionAPI,
  overrides: TestOverrides = {},
): void {
  const terminal = detectTerminal(overrides.env);
  let runtime: Runtime | null = null;
  let runtimePromise: Promise<Runtime> | null = null;

  const getRuntime = async (ctx: ExtensionContext): Promise<Runtime> => {
    if (runtime !== null) {
      return runtime;
    }

    runtimePromise ??= loadBridgeSettings(
      ctx.cwd,
      overrides.settings,
      overrides.settingsReader,
    ).then((settings) => createRuntime(ctx, settings, terminal, overrides));
    runtime = await runtimePromise;

    return runtime;
  };

  const handle = async (event: unknown, ctx: ExtensionContext): Promise<void> => {
    try {
      const activeRuntime = await getRuntime(ctx);
      const bridgeEvent = toBridgeEvent(event);

      if (bridgeEvent !== null) {
        activeRuntime.state.apply(bridgeEvent);
      }

      const snapshot = activeRuntime.state.snapshot(
        shouldForceIdle(bridgeEvent) ? true : isContextIdle(ctx),
        activeRuntime.settings,
      );
      const title = composeTitle(
        baseTitleFromContext(ctx),
        snapshot,
        activeRuntime.settings,
      );

      activeRuntime.lastState = snapshot;

      if (title !== activeRuntime.lastTitle) {
        activeRuntime.backend.setTitle(title);
        activeRuntime.lastTitle = title;
      }
    } catch (error) {
      pi.logger.warn("omp-otty-bridge handler failed", { error: String(error) });
    }
  };

  pi.on("session_start", (event, ctx) => handle(event, ctx));
  pi.on("session_shutdown", (event, ctx) => handle(event, ctx));
  pi.on("session_stop", (event, ctx) => handle(event, ctx));
  pi.on("session_switch", (event, ctx) => handle(event, ctx));
  pi.on("session_branch", (event, ctx) => handle(event, ctx));
  pi.on("session_before_compact", (event, ctx) => handle(event, ctx));
  pi.on("session.compacting", (event, ctx) => handle(event, ctx));
  pi.on("session_compact", (event, ctx) => handle(event, ctx));
  pi.on("agent_start", (event, ctx) => handle(event, ctx));
  pi.on("agent_end", (event, ctx) => handle(event, ctx));
  pi.on("turn_start", (event, ctx) => handle(event, ctx));
  pi.on("turn_end", (event, ctx) => handle(event, ctx));
  pi.on("tool_execution_start", (event, ctx) => handle(event, ctx));
  pi.on("tool_execution_end", (event, ctx) => handle(event, ctx));
  pi.on("tool_call", (event, ctx) => handle(event, ctx));
  pi.on("tool_result", (event, ctx) => handle(event, ctx));
  pi.on("tool_approval_requested", (event, ctx) => handle(event, ctx));
  pi.on("tool_approval_resolved", (event, ctx) => handle(event, ctx));
  pi.on("auto_compaction_start", (event, ctx) => handle(event, ctx));
  pi.on("auto_compaction_end", (event, ctx) => handle(event, ctx));
  pi.on("auto_retry_start", (event, ctx) => handle(event, ctx));
  pi.on("auto_retry_end", (event, ctx) => handle(event, ctx));

  pi.registerCommand("otty-status", {
    description: "Show OMP Otty bridge status",
    handler: async (_args, ctx) => {
      const activeRuntime = await getRuntime(ctx);
      const report = formatDiagnostics({
        detectedOtty: activeRuntime.terminal.isOtty,
        outputEnabled: activeRuntime.outputEnabled,
        settings: activeRuntime.settings,
        backendName: activeRuntime.backend.name,
        lastState: activeRuntime.lastState,
        lastTitle: activeRuntime.lastTitle,
        terminal: activeRuntime.terminal.diagnostics,
      });

      notify(ctx, report);
    },
  });
}
