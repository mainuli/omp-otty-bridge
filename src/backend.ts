import { closeSync, openSync, writeSync } from "node:fs";
import type { BackendName } from "./settings";

export interface TitleBackend {
  readonly name: BackendName;
  setTitle(title: string): void;
}

export type UiTitleContext = {
  ui: {
    setTitle(title: string): void;
  };
};

export type OscTtyWriter = {
  write(frame: Uint8Array): void;
};

const ASCII_CONTROLS = /[\x00-\x1f\x7f]/g;

function sanitizeOscTitle(title: string): string {
  return title.replace(ASCII_CONTROLS, "");
}

function writeFrameToDevTty(frame: Uint8Array): void {
  const fd = openSync("/dev/tty", "w");

  try {
    writeSync(fd, frame);
  } finally {
    closeSync(fd);
  }
}

export function createUiTitleBackend(ctx: UiTitleContext): TitleBackend {
  return {
    name: "ui-title",
    setTitle(title: string) {
      ctx.ui.setTitle(title);
    },
  };
}

export function createOscTtyBackend(io: OscTtyWriter = { write: writeFrameToDevTty }): TitleBackend {
  return {
    name: "osc-tty",
    setTitle(title: string) {
      const sanitizedTitle = sanitizeOscTitle(title);
      const frame = Buffer.from(`\x1b]0;${sanitizedTitle}\x07`, "utf8");

      try {
        io.write(frame);
      } catch {
        // Best effort only: title updates must not interrupt the host session.
      }
    },
  };
}

export function createDevNullBackend(name: BackendName = "ui-title"): TitleBackend {
  return {
    name,
    setTitle() {},
  };
}
