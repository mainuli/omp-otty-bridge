import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SETTINGS,
  PLUGIN_NAME,
  loadBridgeSettings,
  normalizeSettings,
  type PluginSettingsReader,
} from "../src/settings";

describe("normalizeSettings", () => {
  test("uses defaults for empty input", () => {
    expect(normalizeSettings()).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  test("accepts valid settings", () => {
    expect(
      normalizeSettings({
        enabled: false,
        mode: "minimal",
        titleFormat: "glyph-only",
        maxTitleLength: 80,
        nonOttyBehavior: "enabled",
        multiplexerBehavior: "enabled",
        backend: "osc-tty",
      }),
    ).toEqual({
      enabled: false,
      mode: "minimal",
      titleFormat: "glyph-only",
      maxTitleLength: 80,
      nonOttyBehavior: "enabled",
      multiplexerBehavior: "enabled",
      backend: "osc-tty",
    });
  });

  test("rejects invalid enum and boolean values via defaults", () => {
    expect(
      normalizeSettings({
        enabled: "",
        mode: "verbose",
        titleFormat: "emoji-label",
        nonOttyBehavior: "ask",
        multiplexerBehavior: "auto",
        backend: "terminal",
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  test("clamps maxTitleLength to the supported integer range", () => {
    expect(normalizeSettings({ maxTitleLength: 40 }).maxTitleLength).toBe(40);
    expect(normalizeSettings({ maxTitleLength: 240 }).maxTitleLength).toBe(240);
    expect(normalizeSettings({ maxTitleLength: 39 }).maxTitleLength).toBe(40);
    expect(normalizeSettings({ maxTitleLength: 241 }).maxTitleLength).toBe(240);
    expect(normalizeSettings({ maxTitleLength: 99.8 }).maxTitleLength).toBe(99);
    expect(normalizeSettings({ maxTitleLength: Number.NaN }).maxTitleLength).toBe(
      DEFAULT_SETTINGS.maxTitleLength,
    );
    expect(normalizeSettings({ maxTitleLength: Number.POSITIVE_INFINITY }).maxTitleLength).toBe(
      DEFAULT_SETTINGS.maxTitleLength,
    );
    expect(normalizeSettings({ maxTitleLength: "80" }).maxTitleLength).toBe(
      DEFAULT_SETTINGS.maxTitleLength,
    );
  });
});

describe("loadBridgeSettings", () => {
  test("loads settings via reader using plugin name and cwd", async () => {
    const calls: Array<[string, string]> = [];
    const reader: PluginSettingsReader = async (pluginName, cwd) => {
      calls.push([pluginName, cwd]);
      return {
        enabled: false,
        mode: "minimal",
      };
    };

    await expect(loadBridgeSettings("/tmp/project", undefined, reader)).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      enabled: false,
      mode: "minimal",
    });
    expect(calls).toEqual([[PLUGIN_NAME, "/tmp/project"]]);
  });

  test("uses explicit overrides without calling reader", async () => {
    let called = false;
    const reader: PluginSettingsReader = async () => {
      called = true;
      return { enabled: false };
    };

    await expect(
      loadBridgeSettings(
        "/tmp/project",
        { titleFormat: "label-only", mode: "verbose" },
        reader,
      ),
    ).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      titleFormat: "label-only",
    });
    expect(called).toBe(false);
  });

  test("falls back to defaults when reader fails", async () => {
    const reader: PluginSettingsReader = async () => {
      throw new Error("settings unavailable");
    };

    const settings = await loadBridgeSettings("/tmp/project", undefined, reader);

    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings).not.toBe(DEFAULT_SETTINGS);
  });
});
