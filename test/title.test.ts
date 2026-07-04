import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, type BridgeSettings } from "../src/settings";
import { baseTitleFromContext, composeTitle, sanitizeTitle } from "../src/title";

type TestDisplayState = {
  kind: "idle" | "working" | "tool" | "tools" | "awaiting" | "compacting" | "retry";
  label: string;
  glyph: "" | "▶" | "✋" | "◌" | "↻";
};

function settings(overrides: Partial<BridgeSettings> = {}): BridgeSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };
}

describe("sanitizeTitle", () => {
  test("strips C0, DEL, and C1 controls and limits length", () => {
    expect(sanitizeTitle("ab\u0000c\u001fd\u007fe\u0085f\u009bg", 6)).toBe("abcdef");
  });
});

describe("composeTitle", () => {
  const toolState: TestDisplayState = {
    kind: "tool",
    label: "bash",
    glyph: "▶",
  };

  test("composes default glyph-label title", () => {
    expect(composeTitle("π: project", toolState, settings())).toBe("▶ π: project · bash");
  });

  test("composes label-only title without glyph", () => {
    expect(
      composeTitle("π: project", toolState, settings({ titleFormat: "label-only" })),
    ).toBe("π: project · bash");
  });

  test("composes glyph-only title without detail label", () => {
    expect(
      composeTitle("π: project", toolState, settings({ titleFormat: "glyph-only" })),
    ).toBe("▶ π: project");
  });

  test("returns sanitized base title for idle state", () => {
    expect(
      composeTitle("π: project\u0000", { kind: "idle", label: "", glyph: "" }, settings()),
    ).toBe("π: project");
  });

  test("limits final composed title after adding prefix and detail", () => {
    const title = composeTitle(
      "π: very-long-project-name",
      toolState,
      settings({ maxTitleLength: 14 }),
    );

    expect(title).toBe("▶ π: very-long");
    expect(title.length).toBeLessThanOrEqual(14);
  });
});

describe("baseTitleFromContext", () => {
  test("uses session title when available", () => {
    expect(
      baseTitleFromContext({
        cwd: "/tmp/project",
        sessionManager: {
          getSessionName: () => "Daily driver",
        },
      }),
    ).toBe("Daily driver");
  });

  test("falls back to cwd basename", () => {
    expect(
      baseTitleFromContext({
        cwd: "/tmp/omp-otty-bridge",
      }),
    ).toBe("π: omp-otty-bridge");
  });

  test("falls back when session title is whitespace", () => {
    expect(
      baseTitleFromContext({
        cwd: "/tmp/project",
        sessionManager: {
          getSessionName: () => "  ",
        },
      }),
    ).toBe("π: project");
  });

  test("falls back to omp when cwd has no basename", () => {
    expect(
      baseTitleFromContext({
        cwd: "/",
      }),
    ).toBe("π: omp");
  });
});
