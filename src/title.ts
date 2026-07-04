import { basename } from "node:path";

export type DisplayStateLike = {
  kind: "idle" | "working" | "tool" | "tools" | "awaiting" | "compacting" | "retry";
  label: string;
  glyph: "" | "▶" | "✋" | "◌" | "↻";
};

export type TitleSettingsLike = {
  titleFormat: "glyph-label" | "label-only" | "glyph-only";
  maxTitleLength: number;
};

export type TitleContextLike = {
  cwd: string;
  sessionManager?: {
    getSessionName?: () => unknown;
  };
};

const ASCII_CONTROLS = /[\x00-\x1f\x7f]/g;

export function sanitizeTitle(title: string, maxLength: number): string {
  const sanitized = title.replace(ASCII_CONTROLS, "");
  return sanitized.slice(0, Math.max(0, Math.floor(maxLength)));
}

export function composeTitle(
  baseTitle: string,
  state: DisplayStateLike,
  settings: TitleSettingsLike,
): string {
  const base = sanitizeTitle(baseTitle, settings.maxTitleLength);

  if (state.kind === "idle") {
    return base;
  }

  const detail = sanitizeTitle(state.label, settings.maxTitleLength);
  let title: string;

  switch (settings.titleFormat) {
    case "label-only":
      title = detail === "" ? base : `${base} · ${detail}`;
      break;
    case "glyph-only":
      title = state.glyph === "" ? base : `${state.glyph} ${base}`;
      break;
    case "glyph-label":
      title = [
        state.glyph,
        base,
        detail === "" ? "" : `· ${detail}`,
      ].filter(Boolean).join(" ");
      break;
  }

  return sanitizeTitle(title, settings.maxTitleLength);
}

export function baseTitleFromContext(ctx: TitleContextLike): string {
  const sessionName = ctx.sessionManager?.getSessionName?.();

  if (typeof sessionName === "string" && sessionName.trim().length > 0) {
    return sessionName;
  }

  return `π: ${basename(ctx.cwd) || "omp"}`;
}
