import { describe, it, expect, vi } from "vitest";
import { createPlayerPatch, isNativeShell } from "../src/playerPatch.js";
import { createStepper, STICK_MS } from "../src/core.js";
import { fakeApi, makePlayerClass, memoryStorage } from "./fixtures/jmpPlayer.js";

function setup({ max = 150, step = 5, storage = memoryStorage(), win: extraWin = {}, clock = { t: 0 } } = {}) {
  const api = fakeApi();
  const win = { api, ...extraWin };
  const logger = { warn: vi.fn() };
  const onChange = vi.fn();
  const stepLevel = createStepper({ getMax: () => max, getStep: () => step, now: () => clock.t });
  const patch = createPlayerPatch({ win, getMax: () => max, stepLevel, onChange, logger });
  return { api, win, patch, storage, logger, onChange };
}

describe("isNativeShell", () => {
  it("detects the JMP bridge", () => {
    expect(isNativeShell({ api: {} })).toBe(true);
    expect(isNativeShell({ apiPromise: Promise.resolve() })).toBe(true);
    expect(isNativeShell({ jmpInfo: {} })).toBe(true);
    expect(isNativeShell({})).toBe(false);
  });
});

describe("playerPatch", () => {
  it("lets volumeUp go past 100 and stop at max", () => {
    const { api, win, patch, storage } = setup();
    const Player = makePlayerClass(win.api, storage);
    win._mpvVideoPlayer = Player;
    patch.install();

    const p = new Player();
    p.volumeUp();
    expect(p.getVolume()).toBe(105);
    for (let i = 0; i < 20; i++) p.volumeUp();
    expect(p.getVolume()).toBe(150);
    expect(api.calls.at(-1)).toBe(150);
  });

  it("volumeUp held from below stops at 100 until input pauses", () => {
    const clock = { t: 0 };
    const { win, patch, storage } = setup({ clock });
    const Player = makePlayerClass(win.api, storage);
    patch.patchClass(Player);
    const p = new Player();
    p.setVolume(90);
    for (let i = 0; i < 8; i++) {
      p.volumeUp(); // key auto-repeat
      clock.t += 30;
    }
    expect(p.getVolume()).toBe(100);
    clock.t += STICK_MS;
    p.volumeUp();
    expect(p.getVolume()).toBe(105);
  });

  it("volumeDown stops at 0", () => {
    const { win, patch, storage } = setup();
    const Player = makePlayerClass(win.api, storage);
    patch.patchClass(Player);
    const p = new Player();
    p.setVolume(3);
    p.volumeDown();
    expect(p.getVolume()).toBe(0);
  });

  it("wrapped setVolume records the instance, saves and reports changes", () => {
    const { win, patch, storage, onChange } = setup();
    const Player = makePlayerClass(win.api, storage);
    patch.patchClass(Player);
    const p = new Player();
    p.setVolume(140);
    expect(patch.currentPlayer).toBe(p);
    expect(storage.getItem("volume")).toBe("1.4");
    expect(onChange).toHaveBeenLastCalledWith(140, expect.objectContaining({ user: true }));
  });

  it("a saved boost is restored by the next item's onPlaying (no timer)", () => {
    const { api, win, patch, storage, onChange } = setup();
    const Player = makePlayerClass(win.api, storage);
    patch.patchClass(Player);

    const first = new Player();
    first.setVolume(150);

    const next = new Player();
    next.onPlaying();
    expect(next.getVolume()).toBe(150);
    expect(api.calls.at(-1)).toBe(150);
    expect(onChange).toHaveBeenLastCalledWith(150, expect.objectContaining({ user: false }));
  });

  it("caps restored volumes at the configured max", () => {
    const storage = memoryStorage({ volume: "2" });
    const { api, win, patch } = setup({ max: 150, storage });
    const Player = makePlayerClass(win.api, storage);
    patch.patchClass(Player);
    const p = new Player();
    p.onPlaying();
    expect(p.getVolume()).toBe(150);
    expect(api.calls.at(-1)).toBe(150);
  });

  it("patches a class assigned after install()", () => {
    const { win, patch, storage } = setup();
    patch.install();
    const Player = makePlayerClass(win.api, storage);
    win._mpvVideoPlayer = Player; // what mpvVideoPlayer.js does when it loads
    expect(win._mpvVideoPlayer).toBe(Player);
    const p = new Player();
    for (let i = 0; i < 5; i++) p.volumeUp();
    expect(p.getVolume()).toBe(125);
  });

  it("does not double-wrap when patched twice", () => {
    const { api, win, patch, storage } = setup();
    const Player = makePlayerClass(win.api, storage);
    patch.patchClass(Player);
    const wrapped = Player.prototype.setVolume;
    patch.patchClass(Player);
    expect(Player.prototype.setVolume).toBe(wrapped);
    new Player().setVolume(120);
    expect(api.calls).toEqual([120]);
  });

  it("refuses classes without the expected shape", () => {
    const { patch, logger } = setup();
    expect(patch.patchClass(class Other {})).toBe(false);
    expect(patch.patchClass(undefined)).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("apply() goes through the active player so the level persists", () => {
    const { win, patch, storage } = setup();
    const Player = makePlayerClass(win.api, storage);
    patch.patchClass(Player);
    const p = new Player();
    p.onPlaying();
    expect(patch.apply(145)).toBe(true);
    expect(p.getVolume()).toBe(145);
    expect(storage.getItem("volume")).toBe("1.45");
  });

  it("apply() falls back to the native bridge and clamps", () => {
    const { api, patch } = setup({ max: 150 });
    expect(patch.apply(500)).toBe(true);
    expect(api.calls).toEqual([150]);
  });

  it("apply() is a no-op without a bridge and logs once", () => {
    const logger = { warn: vi.fn() };
    const patch = createPlayerPatch({ win: {}, getMax: () => 150, stepLevel: (v) => v, logger });
    expect(patch.apply(120)).toBe(false);
    expect(patch.apply(130)).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(patch.getLevel()).toBeNull();
  });

  it("swallows exceptions thrown by the native bridge and logs once", () => {
    const logger = { warn: vi.fn() };
    const win = { api: { player: { setVolume: () => { throw new Error("boom"); } } } };
    const patch = createPlayerPatch({ win, getMax: () => 150, stepLevel: (v) => v, logger });
    expect(patch.apply(120)).toBe(false);
    expect(patch.apply(120)).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
