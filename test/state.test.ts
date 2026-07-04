import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, type BridgeSettings } from "../src/settings";
import { BridgeState, type BridgeEvent } from "../src/state";

function settings(overrides: Partial<BridgeSettings> = {}): BridgeSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };
}

function snapshotAfter(
  events: BridgeEvent[],
  options: { isIdle?: boolean; settings?: BridgeSettings } = {},
) {
  const state = new BridgeState();

  for (const event of events) {
    state.apply(event);
  }

  return state.snapshot(options.isIdle ?? true, options.settings ?? settings());
}

describe("BridgeState", () => {
  test("starts idle when context is idle", () => {
    expect(new BridgeState().snapshot(true, settings())).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("shows working during agent run", () => {
    expect(snapshotAfter([{ type: "agent_start" }])).toEqual({
      kind: "working",
      label: "working",
      glyph: "▶",
    });
  });

  test("shows working when context is not idle", () => {
    expect(snapshotAfter([], { isIdle: false })).toEqual({
      kind: "working",
      label: "working",
      glyph: "▶",
    });
  });

  test("shows one running tool by name in detailed mode", () => {
    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
      ]),
    ).toEqual({
      kind: "tool",
      label: "bash",
      glyph: "▶",
    });
  });

  test("summarizes multiple tools", () => {
    expect(
      snapshotAfter([
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "tool_execution_start", toolCallId: "tool-2", toolName: "read" },
      ]),
    ).toEqual({
      kind: "tools",
      label: "tools:2",
      glyph: "▶",
    });
  });

  test("clears running tool on execution end", () => {
    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "tool_execution_end", toolCallId: "tool-1" },
      ]),
    ).toEqual({
      kind: "working",
      label: "working",
      glyph: "▶",
    });
  });

  test("awaiting approval wins over tools", () => {
    expect(
      snapshotAfter([
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        {
          type: "tool_approval_requested",
          toolCallId: "approval-1",
          toolName: "edit",
        },
      ]),
    ).toEqual({
      kind: "awaiting",
      label: "awaiting input",
      glyph: "✋",
    });
  });

  test("retry wins over compaction and tools", () => {
    expect(
      snapshotAfter([
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "auto_retry_start", attempt: 2, maxAttempts: 5 },
      ]),
    ).toEqual({
      kind: "retry",
      label: "retry 2/5",
      glyph: "↻",
    });
  });

  test("minimal mode uses coarse labels", () => {
    expect(
      snapshotAfter(
        [{ type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" }],
        { settings: settings({ mode: "minimal" }) },
      ),
    ).toEqual({
      kind: "tool",
      label: "working",
      glyph: "▶",
    });

    expect(
      snapshotAfter(
        [{ type: "auto_compaction_start", action: "summarizing" }],
        { settings: settings({ mode: "minimal" }) },
      ),
    ).toEqual({
      kind: "compacting",
      label: "compacting",
      glyph: "◌",
    });

    expect(
      snapshotAfter(
        [{ type: "auto_retry_start", attempt: 2, maxAttempts: 5 }],
        { settings: settings({ mode: "minimal" }) },
      ),
    ).toEqual({
      kind: "retry",
      label: "retry",
      glyph: "↻",
    });
  });

  test("detailed mode shows compaction action", () => {
    expect(
      snapshotAfter([{ type: "auto_compaction_start", action: "snapcompact" }]),
    ).toEqual({
      kind: "compacting",
      label: "snapcompact",
      glyph: "◌",
    });
  });

  test("shows compacting when auto compaction action is missing", () => {
    expect(snapshotAfter([{ type: "auto_compaction_start" }])).toEqual({
      kind: "compacting",
      label: "compacting",
      glyph: "◌",
    });
  });

  test("session reset clears all internal state", () => {
    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "tool_approval_requested", toolCallId: "tool-1", toolName: "bash" },
        { type: "auto_retry_start", attempt: 1, maxAttempts: 3 },
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "session_start" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("turn end marks inactive and clears tools and approvals", () => {
    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "tool_approval_requested", toolCallId: "approval-1", toolName: "edit" },
        { type: "turn_end" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("turn end clears stale compaction and retry transients", () => {
    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "auto_retry_start", attempt: 2, maxAttempts: 5 },
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "session.compacting" },
        { type: "turn_end" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("agent end clears stale compaction and retry transients", () => {
    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "auto_retry_start", attempt: 2, maxAttempts: 5 },
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "session.compacting" },
        { type: "agent_end" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("session stop resets transient state", () => {
    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "tool_approval_requested", toolCallId: "approval-1", toolName: "edit" },
        { type: "auto_retry_start", attempt: 2, maxAttempts: 5 },
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "session.compacting" },
        { type: "session_stop" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("tracks session compacting separately from auto compaction", () => {
    expect(
      snapshotAfter([{ type: "session.compacting" }]),
    ).toEqual({
      kind: "compacting",
      label: "compacting",
      glyph: "◌",
    });

    expect(
      snapshotAfter([
        { type: "session.compacting" },
        { type: "session_compact" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("end events clear approval, retry, and auto compaction state", () => {
    expect(
      snapshotAfter([
        { type: "tool_approval_requested", toolCallId: "approval-1", toolName: "edit" },
        { type: "tool_approval_resolved", toolCallId: "approval-1" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });

    expect(
      snapshotAfter([
        { type: "auto_retry_start", attempt: 1, maxAttempts: 3 },
        { type: "auto_retry_end" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });

    expect(
      snapshotAfter([
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "auto_compaction_end" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("session shutdown and agent end clear active state", () => {
    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "session_shutdown" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });

    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "agent_end" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("completed session switch and branch reset all internal state", () => {
    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "tool_approval_requested", toolCallId: "approval-1", toolName: "edit" },
        { type: "auto_retry_start", attempt: 2, maxAttempts: 5 },
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "session.compacting" },
        { type: "session_switch" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });

    expect(
      snapshotAfter([
        { type: "agent_start" },
        { type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash" },
        { type: "tool_approval_requested", toolCallId: "approval-1", toolName: "edit" },
        { type: "auto_retry_start", attempt: 2, maxAttempts: 5 },
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "session.compacting" },
        { type: "session_branch" },
      ]),
    ).toEqual({
      kind: "idle",
      label: "",
      glyph: "",
    });
  });

  test("compaction family end events only clear their own state", () => {
    expect(
      snapshotAfter([
        { type: "session.compacting" },
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "auto_compaction_end" },
      ]),
    ).toEqual({
      kind: "compacting",
      label: "compacting",
      glyph: "◌",
    });

    expect(
      snapshotAfter([
        { type: "session.compacting" },
        { type: "auto_compaction_start", action: "summarizing" },
        { type: "session_compact" },
      ]),
    ).toEqual({
      kind: "compacting",
      label: "summarizing",
      glyph: "◌",
    });
  });
});
