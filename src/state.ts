import type { BridgeSettings } from "./settings";

export type DisplayState = {
  kind: "idle" | "working" | "tool" | "tools" | "awaiting" | "compacting" | "retry";
  label: string;
  glyph: "" | "▶" | "✋" | "◌" | "↻";
};

type EventBase<T extends string> = {
  type: T;
};

type ToolStartEvent = EventBase<"tool_execution_start" | "tool_call"> & {
  toolCallId: string;
  toolName: string;
};

type ToolEndEvent = EventBase<"tool_execution_end" | "tool_result"> & {
  toolCallId: string;
};

type ApprovalRequestedEvent = EventBase<"tool_approval_requested"> & {
  toolCallId: string;
  toolName?: string;
};

type ApprovalResolvedEvent = EventBase<"tool_approval_resolved"> & {
  toolCallId: string;
};

type AutoCompactionStartEvent = EventBase<"auto_compaction_start"> & {
  action?: string;
};

type AutoRetryStartEvent = EventBase<"auto_retry_start"> & {
  attempt?: number;
  maxAttempts?: number;
};

export type BridgeEvent =
  | EventBase<"session_start">
  | EventBase<"session_shutdown">
  | EventBase<"agent_start">
  | EventBase<"agent_end">
  | EventBase<"turn_start">
  | EventBase<"turn_end">
  | EventBase<"session_before_compact">
  | EventBase<"session.compacting">
  | EventBase<"session_compact">
  | ToolStartEvent
  | ToolEndEvent
  | ApprovalRequestedEvent
  | ApprovalResolvedEvent
  | AutoCompactionStartEvent
  | EventBase<"auto_compaction_end">
  | AutoRetryStartEvent
  | EventBase<"auto_retry_end">;

type RetryState = {
  attempt?: number;
  maxAttempts?: number;
};

export class BridgeState {
  private agentActive = false;
  private readonly runningTools = new Map<string, string>();
  private readonly pendingApprovals = new Set<string>();
  private autoCompactionActive = false;
  private autoCompactionAction: string | undefined;
  private sessionCompacting = false;
  private retry: RetryState | undefined;

  apply(event: BridgeEvent): void {
    switch (event.type) {
      case "session_start":
      case "session_shutdown":
        this.reset();
        break;

      case "agent_start":
      case "turn_start":
        this.agentActive = true;
        break;

      case "agent_end":
      case "turn_end":
        this.agentActive = false;
        this.runningTools.clear();
        this.pendingApprovals.clear();
        break;

      case "tool_execution_start":
      case "tool_call":
        this.runningTools.set(event.toolCallId, event.toolName);
        break;

      case "tool_execution_end":
      case "tool_result":
        this.runningTools.delete(event.toolCallId);
        this.pendingApprovals.delete(event.toolCallId);
        break;

      case "tool_approval_requested":
        this.pendingApprovals.add(event.toolCallId);
        break;

      case "tool_approval_resolved":
        this.pendingApprovals.delete(event.toolCallId);
        break;

      case "session_before_compact":
      case "session.compacting":
        this.sessionCompacting = true;
        break;

      case "session_compact":
        this.sessionCompacting = false;
        break;

      case "auto_compaction_start":
        this.autoCompactionActive = true;
        this.autoCompactionAction = event.action;
        break;

      case "auto_compaction_end":
        this.autoCompactionActive = false;
        this.autoCompactionAction = undefined;
        break;

      case "auto_retry_start":
        this.retry = {
          attempt: event.attempt,
          maxAttempts: event.maxAttempts,
        };
        break;

      case "auto_retry_end":
        this.retry = undefined;
        break;
    }
  }

  snapshot(isIdle: boolean, settings: Pick<BridgeSettings, "mode">): DisplayState {
    const minimal = settings.mode === "minimal";

    if (this.pendingApprovals.size > 0) {
      return {
        kind: "awaiting",
        label: "awaiting input",
        glyph: "✋",
      };
    }

    if (this.retry !== undefined) {
      return {
        kind: "retry",
        label: minimal ? "retry" : this.retryLabel(this.retry),
        glyph: "↻",
      };
    }

    if (this.autoCompactionActive) {
      return {
        kind: "compacting",
        label: minimal ? "compacting" : this.autoCompactionAction || "compacting",
        glyph: "◌",
      };
    }

    if (this.sessionCompacting) {
      return {
        kind: "compacting",
        label: "compacting",
        glyph: "◌",
      };
    }

    if (this.runningTools.size === 1) {
      return {
        kind: "tool",
        label: minimal ? "working" : [...this.runningTools.values()][0] ?? "tool",
        glyph: "▶",
      };
    }

    if (this.runningTools.size > 1) {
      return {
        kind: "tools",
        label: minimal ? "working" : `tools:${this.runningTools.size}`,
        glyph: "▶",
      };
    }

    if (!isIdle || this.agentActive) {
      return this.working();
    }

    return {
      kind: "idle",
      label: "",
      glyph: "",
    };
  }

  private reset(): void {
    this.agentActive = false;
    this.runningTools.clear();
    this.pendingApprovals.clear();
    this.autoCompactionActive = false;
    this.autoCompactionAction = undefined;
    this.sessionCompacting = false;
    this.retry = undefined;
  }

  private working(): DisplayState {
    return {
      kind: "working",
      label: "working",
      glyph: "▶",
    };
  }

  private retryLabel(retry: RetryState): string {
    if (retry.attempt !== undefined && retry.maxAttempts !== undefined) {
      return `retry ${retry.attempt}/${retry.maxAttempts}`;
    }

    if (retry.attempt !== undefined) {
      return `retry ${retry.attempt}`;
    }

    return "retry";
  }
}
