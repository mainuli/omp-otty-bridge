import { describe, expect, test } from "bun:test";
import {
  createDevNullBackend,
  createOscTtyBackend,
  createUiTitleBackend,
} from "../src/backend";

const decoder = new TextDecoder();

describe("createUiTitleBackend", () => {
  test("calls ctx ui setTitle and reports ui-title name", () => {
    const titles: string[] = [];
    const backend = createUiTitleBackend({
      ui: {
        setTitle: (title: string) => {
          titles.push(title);
        },
      },
    });

    backend.setTitle("π: project");

    expect(backend.name).toBe("ui-title");
    expect(titles).toEqual(["π: project"]);
  });
});

describe("createOscTtyBackend", () => {
  test("writes OSC 0 title frame and reports osc-tty name", () => {
    const writes: Uint8Array[] = [];
    const backend = createOscTtyBackend({
      write: (frame) => {
        writes.push(frame);
      },
    });

    backend.setTitle("π: project");

    expect(backend.name).toBe("osc-tty");
    expect(writes.map((frame) => decoder.decode(frame))).toEqual(["\x1b]0;π: project\x07"]);
  });

  test("swallows writer failures", () => {
    const backend = createOscTtyBackend({
      write: () => {
        throw new Error("tty unavailable");
      },
    });

    expect(() => backend.setTitle("π: project")).not.toThrow();
  });

  test("strips control characters before writing frames", () => {
    const writes: Uint8Array[] = [];
    const backend = createOscTtyBackend({
      write: (frame) => {
        writes.push(frame);
      },
    });

    backend.setTitle("safe\x1b]2;injected\x07\x00title\x7f");

    expect(writes.map((frame) => decoder.decode(frame))).toEqual([
      "\x1b]0;safe]2;injectedtitle\x07",
    ]);
  });
});

describe("createDevNullBackend", () => {
  test("no-ops and reports the default name", () => {
    const backend = createDevNullBackend();

    expect(() => backend.setTitle("π: project")).not.toThrow();
    expect(backend.name).toBe("ui-title");
  });

  test("no-ops and reports the provided name", () => {
    const backend = createDevNullBackend("osc-tty");

    expect(() => backend.setTitle("π: project")).not.toThrow();
    expect(backend.name).toBe("osc-tty");
  });
});
