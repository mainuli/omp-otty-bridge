import { describe, expect, test } from "bun:test";
import extension from "../src/index";
import type { BackendName } from "../src/settings";

type TestCtx = {
  cwd: string;
  isIdle?: () => boolean;
  sessionManager?: {
    getSessionName?: () => unknown;
  };
  ui?: {
    setTitle?: (title: string) => void;
    notify?: (message: string, type?: "info" | "warning" | "error") => void;
  };
};

type Handler = (event: Record<string, unknown>, ctx: TestCtx) => void | Promise<void>;
type Command = {
  description?: string;
  handler: (args: string, ctx: TestCtx) => void | Promise<void>;
};

function makePi() {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, Command>();
  const warnings: unknown[] = [];

  return {
    handlers,
    commands,
    warnings,
    pi: {
      logger: {
        warn: (...args: unknown[]) => {
          warnings.push(args);
        },
        info: () => undefined,
        debug: () => undefined,
      },
      on: (event: string, handler: Handler) => {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
      registerCommand: (name: string, options: Command) => {
        commands.set(name, options);
      },
    },
  };
}

function makeCtx(overrides: Partial<TestCtx> = {}): TestCtx {
  return {
    cwd: "/tmp/project",
    isIdle: () => false,
    sessionManager: {
      getSessionName: () => "pi: project",
    },
    ui: {
      setTitle: () => undefined,
      notify: () => undefined,
    },
    ...overrides,
  };
}

async function emit(
  handlers: Map<string, Handler[]>,
  eventName: string,
  event: Record<string, unknown>,
  ctx: TestCtx,
): Promise<void> {
  const handler = handlers.get(eventName)?.[0];
  expect(handler).toBeFunction();
  await handler?.(event, ctx);
}

describe("ompOttyBridge", () => {
  test("registers lifecycle handlers and diagnostics command", () => {
    const fake = makePi();

    extension(fake.pi as never);

    expect([...fake.handlers.keys()].sort()).toEqual([
      "agent_end",
      "agent_start",
      "auto_compaction_end",
      "auto_compaction_start",
      "auto_retry_end",
      "auto_retry_start",
      "session.compacting",
      "session_before_compact",
      "session_branch",
      "session_compact",
      "session_shutdown",
      "session_start",
      "session_stop",
      "session_switch",
      "tool_approval_requested",
      "tool_approval_resolved",
      "tool_call",
      "tool_execution_end",
      "tool_execution_start",
      "tool_result",
      "turn_end",
      "turn_start",
    ]);
    expect(fake.handlers.has("session_before_switch")).toBe(false);
    expect(fake.handlers.has("session_before_branch")).toBe(false);
    expect(fake.commands.get("otty-status")?.description).toBeString();
  });

  test("suppresses title output outside Otty by default", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "Apple_Terminal" }, settings: {} });

    await emit(
      fake.handlers,
      "agent_start",
      { type: "agent_start" },
      makeCtx({ ui: { setTitle: (title) => titles.push(title) } }),
    );

    expect(titles).toEqual([]);
  });

  test("updates title in Otty for a tool execution event", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });

    await emit(
      fake.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
      makeCtx({ ui: { setTitle: (title) => titles.push(title) } }),
    );

    expect(titles).toEqual(["▶ pi: project · bash"]);
  });

  test("restores base title on shutdown even when context is not idle", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });
    const ctx = makeCtx({ ui: { setTitle: (title) => titles.push(title) } });

    await emit(
      fake.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
      ctx,
    );
    await emit(fake.handlers, "session_shutdown", { type: "session_shutdown" }, ctx);

    expect(titles).toEqual(["▶ pi: project · bash", "pi: project"]);
  });

  test("restores base title on session stop even when context is not idle", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });
    const ctx = makeCtx({ ui: { setTitle: (title) => titles.push(title) } });

    await emit(
      fake.handlers,
      "auto_retry_start",
      { type: "auto_retry_start", attempt: 2, maxAttempts: 5 },
      ctx,
    );
    await emit(fake.handlers, "session_stop", { type: "session_stop" }, ctx);

    expect(titles).toEqual(["↻ pi: project · retry 2/5", "pi: project"]);
  });

  test("loads project settings through settingsReader and applies titleFormat label-only", async () => {
    const fake = makePi();
    const titles: string[] = [];
    const calls: Array<[string, string]> = [];
    extension(fake.pi as never, {
      env: { TERM_PROGRAM: "otty" },
      settingsReader: async (pluginName, cwd) => {
        calls.push([pluginName, cwd]);
        return { titleFormat: "label-only" };
      },
    });

    await emit(
      fake.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
      makeCtx({ ui: { setTitle: (title) => titles.push(title) } }),
    );

    expect(calls).toEqual([["omp-otty-bridge", "/tmp/project"]]);
    expect(titles).toEqual(["pi: project · bash"]);
  });

  test("suppresses output when enabled false", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, {
      env: { TERM_PROGRAM: "otty" },
      settings: { enabled: false },
    });

    await emit(
      fake.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
      makeCtx({ ui: { setTitle: (title) => titles.push(title) } }),
    );

    expect(titles).toEqual([]);
  });

  test("preserves cold runtime event order across async settings load", async () => {
    const fake = makePi();
    const titles: string[] = [];
    let resolveSettings: (settings: Record<string, unknown>) => void = () => undefined;
    extension(fake.pi as never, {
      env: { TERM_PROGRAM: "otty" },
      settingsReader: () =>
        new Promise((resolve) => {
          resolveSettings = resolve;
        }),
    });
    const ctx = makeCtx({ ui: { setTitle: (title) => titles.push(title) } });

    const agentStart = fake.handlers.get("agent_start")?.[0];
    const toolStart = fake.handlers.get("tool_execution_start")?.[0];
    expect(agentStart).toBeFunction();
    expect(toolStart).toBeFunction();
    const pending = Promise.all([
      agentStart?.({ type: "agent_start" }, ctx),
      toolStart?.(
        { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
        ctx,
      ),
    ]);
    resolveSettings({});
    await pending;

    expect(titles).toEqual(["▶ pi: project · working", "▶ pi: project · bash"]);
  });

  test("wires session_switch and session_branch so reducer reset is reachable", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });
    const ctx = makeCtx({
      isIdle: () => true,
      ui: { setTitle: (title) => titles.push(title) },
    });

    await emit(
      fake.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
      ctx,
    );
    await emit(fake.handlers, "session_switch", { type: "session_switch" }, ctx);
    await emit(
      fake.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "2", toolName: "grep" },
      ctx,
    );
    await emit(fake.handlers, "session_branch", { type: "session_branch" }, ctx);

    expect(titles).toEqual([
      "▶ pi: project · bash",
      "pi: project",
      "▶ pi: project · grep",
      "pi: project",
    ]);
  });

  test("handles backend osc-tty without calling ctx.ui.setTitle", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, {
      env: { TERM_PROGRAM: "otty" },
      settings: { backend: "osc-tty" },
      backendFactories: {
        oscTty: () => ({
          name: "osc-tty" as BackendName,
          setTitle: (title: string) => titles.push(title),
        }),
      },
    });

    await emit(
      fake.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
      makeCtx({
        ui: {
          setTitle: () => {
            throw new Error("ui title backend should not be used");
          },
        },
      }),
    );

    expect(titles).toEqual(["▶ pi: project · bash"]);
  });

  test("/otty-status command notifies a report containing backend and output state", async () => {
    const fake = makePi();
    const notifications: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });

    await fake.commands.get("otty-status")?.handler(
      "",
      makeCtx({ ui: { notify: (message) => notifications.push(message) } }),
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain("Backend: ui-title");
    expect(notifications[0]).toContain("Output enabled: yes");
  });

  test("handler logs warning instead of throwing on bad ctx/backend errors", async () => {
    const fake = makePi();
    extension(fake.pi as never, {
      env: { TERM_PROGRAM: "otty" },
      settings: { backend: "osc-tty" },
      backendFactories: {
        oscTty: () => ({
          name: "osc-tty" as BackendName,
          setTitle: () => {
            throw new Error("backend failed");
          },
        }),
      },
    });

    await expect(
      emit(
        fake.handlers,
        "tool_execution_start",
        { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
        makeCtx({ ui: undefined }),
      ),
    ).resolves.toBeUndefined();

    expect(fake.warnings).toHaveLength(1);
    expect(fake.warnings[0]).toEqual([
      "omp-otty-bridge handler failed",
      { error: "Error: backend failed" },
    ]);
  });
});
