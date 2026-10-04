import { describe, it, expect, vi, afterEach } from "vitest";
import { init, clampSavedVolume } from "../src/main.js";
import { fakeApi, makePlayerClass, memoryStorage } from "./fixtures/jmpPlayer.js";

function fakeWindow({ native = true, storage = memoryStorage() } = {}) {
  const win = { document, localStorage: storage };
  if (native) win.api = fakeApi();
  return win;
}

function press(key) {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

const silent = { logger: { warn: vi.fn() } };

describe("init", () => {
  let win;

  afterEach(() => {
    win?.__volumeBooster?.dispose?.();
    document.body.innerHTML = "";
  });

  it("is idempotent", () => {
    win = fakeWindow();
    const a = init(win, {}, silent);
    const b = init(win, {}, silent);
    expect(a).toBe(b);
    expect(a.active).toBe(true);
  });

  it("does nothing when disabled", () => {
    win = fakeWindow();
    expect(init(win, { enabled: false }, silent).active).toBe(false);
  });

  it("stays inactive in a normal browser and repairs a boosted saved volume", () => {
    const storage = memoryStorage({ volume: "1.5" });
    win = fakeWindow({ native: false, storage });
    const result = init(win, {}, silent);
    expect(result.active).toBe(false);
    expect(storage.getItem("volume")).toBe("1");
  });

  it("resetOnStart lowers a boosted saved volume to 100%", () => {
    const storage = memoryStorage({ volume: "1.4" });
    win = fakeWindow({ storage });
    init(win, { resetOnStart: true }, silent);
    expect(storage.getItem("volume")).toBe("1");
  });

  it("keeps a saved boost within the cap by default", () => {
    const storage = memoryStorage({ volume: "1.8" });
    win = fakeWindow({ storage });
    init(win, { maxPercent: 150 }, silent);
    expect(storage.getItem("volume")).toBe("1.5");
  });

  it("extra keys step the active player past 100 and show the indicator", () => {
    const storage = memoryStorage();
    win = fakeWindow({ storage });
    const vb = init(win, { maxPercent: 150, stepPercent: 5 }, silent);
    const Player = makePlayerClass(win.api, storage);
    win._mpvVideoPlayer = Player;

    const p = new Player();
    p.onPlaying();
    for (let i = 0; i < 10; i++) press("]");
    expect(p.getVolume()).toBe(150);
    expect(win.api.calls.at(-1)).toBe(150);
    expect(storage.getItem("volume")).toBe("1.5");
    expect(vb.indicator.element.textContent).toBe("Volume 150% (+10.6 dB)");

    press("\\");
    expect(p.getVolume()).toBe(100);
  });

  it("built-in volumeUp also goes past 100", () => {
    win = fakeWindow();
    init(win, { maxPercent: 120, stepPercent: 2 }, silent);
    const Player = makePlayerClass(win.api, win.localStorage);
    win._mpvAudioPlayer = Player;
    const p = new Player();
    for (let i = 0; i < 20; i++) p.volumeUp();
    expect(p.getVolume()).toBe(120);
  });

  it("does not show the indicator for automatic restores", () => {
    const storage = memoryStorage({ volume: "1.2" });
    win = fakeWindow({ storage });
    const vb = init(win, {}, silent);
    const Player = makePlayerClass(win.api, storage);
    win._mpvVideoPlayer = Player;
    new Player().onPlaying();
    expect(vb.indicator.element).toBeNull();
  });

  it("keys do nothing before any player is active", () => {
    win = fakeWindow();
    init(win, {}, silent);
    press("]");
    expect(win.api.calls).toEqual([]);
  });
});

describe("clampSavedVolume", () => {
  it("only lowers values above the limit", () => {
    const s = memoryStorage({ volume: "0.8" });
    expect(clampSavedVolume(s, 1)).toBe(false);
    expect(s.getItem("volume")).toBe("0.8");
    expect(clampSavedVolume(memoryStorage(), 1)).toBe(false);
  });

  it("survives a throwing storage", () => {
    const s = { getItem: () => { throw new Error("denied"); }, setItem: () => {} };
    expect(clampSavedVolume(s, 1)).toBe(false);
  });
});
