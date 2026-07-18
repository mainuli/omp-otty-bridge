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

const MULTIPLEXER_CASES = [
  { name: "tmux", env: { TMUX: "/tmp/tmux" } },
  { name: "zellij", env: { ZELLIJ: "zellij-session" } },
  { name: "screen", env: { STY: "screen-session" } },
] as const;

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

function nextTimer(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      "tool_execution_end",
      "tool_execution_start",
      "turn_end",
      "turn_start",
    ]);
    expect(fake.handlers.has("session_before_switch")).toBe(false);
    expect(fake.handlers.has("session_before_branch")).toBe(false);
    expect(fake.handlers.has("tool_call")).toBe(false);
    expect(fake.handlers.has("tool_result")).toBe(false);
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

  for (const { name, env } of MULTIPLEXER_CASES) {
    test(`suppresses inherited Otty output inside ${name} by default`, async () => {
      const fake = makePi();
      const titles: string[] = [];
      extension(fake.pi as never, {
        env: { TERM_PROGRAM: "otty", ...env },
        settings: {},
      });

      await emit(
        fake.handlers,
        "tool_execution_start",
        { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
        makeCtx({ ui: { setTitle: (title) => titles.push(title) } }),
      );

      expect(titles).toEqual([]);
    });

    test(`emits best-effort inherited Otty output inside ${name} when opted in`, async () => {
      const fake = makePi();
      const titles: string[] = [];
      extension(fake.pi as never, {
        env: { TERM_PROGRAM: "otty", ...env },
        settings: { multiplexerBehavior: "enabled" },
      });

      await emit(
        fake.handlers,
        "tool_execution_start",
        { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
        makeCtx({ ui: { setTitle: (title) => titles.push(title) } }),
      );

      expect(titles).toEqual(["▶ pi: project · bash"]);
    });
  }

  test("always delegates Herdr even when every output opt-in is enabled", async () => {
    const fake = makePi();
    const titles: string[] = [];
    extension(fake.pi as never, {
      env: {
        TERM_PROGRAM: "otty",
        HERDR_ENV: "1",
        TMUX: "/tmp/tmux",
        ZELLIJ: "zellij-session",
        STY: "screen-session",
      },
      settings: {
        multiplexerBehavior: "enabled",
        nonOttyBehavior: "enabled",
      },
    });

    await emit(
      fake.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
      makeCtx({ ui: { setTitle: (title) => titles.push(title) } }),
    );

    expect(titles).toEqual([]);
  });

  test("keeps a shared title sink empty across two default-suppressed tmux bridges", async () => {
    const bridgeA = makePi();
    const bridgeB = makePi();
    const titles: string[] = [];
    const ctx = makeCtx({ ui: { setTitle: (title) => titles.push(title) } });
    const overrides = {
      env: { TERM_PROGRAM: "otty", TMUX: "/tmp/tmux" },
      settings: {},
    };

    extension(bridgeA.pi as never, overrides);
    extension(bridgeB.pi as never, overrides);

    await emit(bridgeA.handlers, "agent_start", { type: "agent_start" }, ctx);
    await emit(
      bridgeB.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
      ctx,
    );
    await emit(
      bridgeA.handlers,
      "session_shutdown",
      { type: "session_shutdown" },
      ctx,
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

  test("restores base title after end event when idle flag settles later", async () => {
    const fake = makePi();
    const titles: string[] = [];
    let idle = false;
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });
    const ctx = makeCtx({
      isIdle: () => idle,
      ui: { setTitle: (title) => titles.push(title) },
    });

    await emit(fake.handlers, "agent_start", { type: "agent_start" }, ctx);
    await emit(fake.handlers, "agent_end", { type: "agent_end" }, ctx);
    idle = true;
    await nextTimer();

    expect(titles).toEqual(["▶ pi: project · working", "pi: project"]);
  });

  test("retries idle restoration when idle flag settles after the next timer", async () => {
    const fake = makePi();
    const titles: string[] = [];
    let idle = false;
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });
    const ctx = makeCtx({
      isIdle: () => idle,
      ui: { setTitle: (title) => titles.push(title) },
    });

    await emit(fake.handlers, "agent_start", { type: "agent_start" }, ctx);
    await emit(fake.handlers, "agent_end", { type: "agent_end" }, ctx);
    await nextTimer();
    idle = true;
    await wait(75);

    expect(titles).toEqual(["▶ pi: project · working", "pi: project"]);
  });

  test("keeps pending idle restoration across ignored event payloads", async () => {
    const fake = makePi();
    const titles: string[] = [];
    let idle = false;
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });
    const ctx = makeCtx({
      isIdle: () => idle,
      ui: { setTitle: (title) => titles.push(title) },
    });

    await emit(fake.handlers, "agent_start", { type: "agent_start" }, ctx);
    await emit(fake.handlers, "agent_end", { type: "agent_end" }, ctx);
    await emit(fake.handlers, "tool_execution_end", { type: "tool_execution_end" }, ctx);
    idle = true;
    await nextTimer();

    expect(titles).toEqual(["▶ pi: project · working", "pi: project"]);
  });

  test("does not restore idle title after a newer bridge event starts", async () => {
    const fake = makePi();
    const titles: string[] = [];
    let idle = false;
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });
    const ctx = makeCtx({
      isIdle: () => idle,
      ui: { setTitle: (title) => titles.push(title) },
    });

    await emit(fake.handlers, "agent_start", { type: "agent_start" }, ctx);
    await emit(fake.handlers, "agent_end", { type: "agent_end" }, ctx);
    await emit(fake.handlers, "agent_start", { type: "agent_start" }, ctx);
    idle = true;
    await wait(75);

    expect(titles).toEqual(["▶ pi: project · working"]);
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

  test("/otty-status reports direct-Otty topology and output decision", async () => {
    const fake = makePi();
    const notifications: string[] = [];
    extension(fake.pi as never, { env: { TERM_PROGRAM: "otty" }, settings: {} });

    await fake.commands.get("otty-status")?.handler(
      "",
      makeCtx({ ui: { notify: (message) => notifications.push(message) } }),
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain("Backend: ui-title");
    expect(notifications[0]).toContain("Multiplexers: none");
    expect(notifications[0]).toContain("Output enabled: yes");
    expect(notifications[0]).toContain("Output reason: direct-otty");
  });

  test("/otty-status reports suppressed topology and composed state", async () => {
    const fake = makePi();
    const notifications: string[] = [];
    const titles: string[] = [];
    extension(fake.pi as never, {
      env: { TERM_PROGRAM: "otty", TMUX: "/tmp/tmux" },
      settings: {},
    });
    const ctx = makeCtx({
      ui: {
        setTitle: (title) => titles.push(title),
        notify: (message) => notifications.push(message),
      },
    });

    await emit(
      fake.handlers,
      "tool_execution_start",
      { type: "tool_execution_start", toolCallId: "1", toolName: "bash" },
      ctx,
    );
    await fake.commands.get("otty-status")?.handler("", ctx);

    expect(titles).toEqual([]);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain("Multiplexers: tmux");
    expect(notifications[0]).toContain("Output enabled: no");
    expect(notifications[0]).toContain("Output reason: multiplexer-disabled");
    expect(notifications[0]).toContain("State: tool (bash)");
    expect(notifications[0]).toContain("Last composed title: ▶ pi: project · bash");
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
