import { describe, it, expect, vi, beforeEach } from "vitest";
import { createKeyHandler, parseKeys } from "../src/input.js";
import { DEFAULTS } from "../src/core.js";

function press(target, key, init = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe("createKeyHandler", () => {
  let actions;

  beforeEach(() => {
    document.body.innerHTML = "";
    actions = { up: vi.fn(), down: vi.fn(), reset: vi.fn() };
  });

  function attach(keys = DEFAULTS) {
    const handler = createKeyHandler({ keys, actions });
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }

  it("maps ] [ \\ to up, down, reset", () => {
    const detach = attach();
    press(document.body, "]");
    press(document.body, "[");
    press(document.body, "\\");
    detach();
    expect(actions.up).toHaveBeenCalledOnce();
    expect(actions.down).toHaveBeenCalledOnce();
    expect(actions.reset).toHaveBeenCalledOnce();
  });

  it("prevents default for handled keys only", () => {
    const detach = attach();
    expect(press(document.body, "]").defaultPrevented).toBe(true);
    expect(press(document.body, "a").defaultPrevented).toBe(false);
    detach();
  });

  it.each([
    ["input", "<input id='t'>"],
    ["textarea", "<textarea id='t'></textarea>"],
    ["contenteditable", "<div contenteditable='true'><span id='t'>x</span></div>"],
  ])("ignores keys typed into %s", (_, html) => {
    document.body.innerHTML = html;
    const detach = attach();
    press(document.getElementById("t"), "]");
    detach();
    expect(actions.up).not.toHaveBeenCalled();
  });

  it.each(["ctrlKey", "altKey", "metaKey"])("ignores combos with %s", (modifier) => {
    const detach = attach();
    press(document.body, "]", { [modifier]: true });
    detach();
    expect(actions.up).not.toHaveBeenCalled();
  });

  it("maps the layout-friendly defaults + - * too", () => {
    const detach = attach();
    press(document.body, "+");
    press(document.body, "-");
    press(document.body, "*");
    detach();
    expect(actions.up).toHaveBeenCalledOnce();
    expect(actions.down).toHaveBeenCalledOnce();
    expect(actions.reset).toHaveBeenCalledOnce();
  });

  it("accepts AltGr keys (Windows reports AltGr as Ctrl+Alt), e.g. ] on a Swedish layout", () => {
    const detach = attach();
    press(document.body, "]", { ctrlKey: true, altKey: true });
    press(document.body, "\\", { ctrlKey: true, altKey: true });
    detach();
    expect(actions.up).toHaveBeenCalledOnce();
    expect(actions.reset).toHaveBeenCalledOnce();
  });

  it("accepts the AltGraph modifier state", () => {
    const handler = createKeyHandler({ keys: DEFAULTS, actions });
    const event = {
      key: "[",
      ctrlKey: false,
      altKey: true,
      metaKey: false,
      target: document.body,
      getModifierState: (m) => m === "AltGraph",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    expect(handler(event)).toBe(true);
    expect(actions.down).toHaveBeenCalledOnce();
  });

  it("leaves digits alone (jellyfin-web seeks with 0-9)", () => {
    const detach = attach();
    expect(press(document.body, "8").defaultPrevented).toBe(false);
    expect(press(document.body, "9").defaultPrevented).toBe(false);
    detach();
    expect(actions.up).not.toHaveBeenCalled();
  });

  it("parseKeys splits on whitespace", () => {
    expect(parseKeys("+ ]")).toEqual(["+", "]"]);
    expect(parseKeys("  F9  ")).toEqual(["F9"]);
    expect(parseKeys(undefined)).toEqual([]);
  });

  it("respects custom bindings", () => {
    const detach = attach({ ...DEFAULTS, increaseKey: "+", decreaseKey: "-" });
    press(document.body, "+");
    press(document.body, "]");
    press(document.body, "-");
    detach();
    expect(actions.up).toHaveBeenCalledOnce();
    expect(actions.down).toHaveBeenCalledOnce();
  });
});
