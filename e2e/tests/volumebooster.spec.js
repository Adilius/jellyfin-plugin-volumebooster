import { test, expect } from "@playwright/test";

// A normal browser uses jellyfin-web's HTML5 player, not JMP's mpv wrappers,
// so the native path is exercised with a stubbed `window.api` and a fixture
// class that mirrors JMP 1.12's native/mpvVideoPlayer.js volume methods.

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return () => errors.filter((e) => /volume ?boost/i.test(e));
}

test("server adds the script tag to index.html and serves the script", async ({ request }) => {
  for (const path of ["/web/", "/web/index.html"]) {
    const html = await (await request.get(path)).text();
    expect(html.match(/<!-- Volume Booster -->/g)).toHaveLength(1);
    expect(html).toMatch(/<script defer src="\.\.\/VolumeBooster\/ClientScript\?v=[0-9a-f]{12}"><\/script>/);
  }

  // Exactly what the page references (relative to /web/).
  const html = await (await request.get("/web/")).text();
  const src = html.match(/src="\.\.\/(VolumeBooster\/ClientScript\?v=[0-9a-f]+)"/)[1];
  const res = await request.get(`/${src}`);
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("javascript");
  const body = await res.text();
  expect(body).toContain("window.VolumeBoosterConfig = {");
  expect(body).toContain("_mpvVideoPlayer");
});

test("normal browser: stays inactive and repairs a boosted saved volume", async ({ page }) => {
  const ourErrors = collectErrors(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("vb-seeded")) {
      localStorage.setItem("volume", "1.5");
      sessionStorage.setItem("vb-seeded", "1");
    }
  });
  await page.goto("/web/");
  await page.waitForFunction(() => window.__volumeBooster !== undefined);

  const state = await page.evaluate(() => ({
    active: window.__volumeBooster.active,
    reason: window.__volumeBooster.reason,
    saved: localStorage.getItem("volume"),
  }));
  expect(state).toEqual({ active: false, reason: "not-native-shell", saved: "1" });
  expect(ourErrors()).toEqual([]);
});

test("stubbed JMP shell: volume keys go past 100 and persist", async ({ page }) => {
  const ourErrors = collectErrors(page);
  await page.addInitScript(() => {
    window.__nativeCalls = [];
    window.api = { player: { setVolume: (v) => window.__nativeCalls.push(v) } };
  });
  await page.goto("/web/");
  await page.waitForFunction(() => window.__volumeBooster && window.__volumeBooster.active);

  const result = await page.evaluate(() => {
    localStorage.removeItem("volume");
    class mpvVideoPlayer {
      constructor() {
        this._volume = 100;
        this._started = false;
      }
      getSavedVolume() {
        return localStorage.getItem("volume") || 1;
      }
      saveVolume(v) {
        if (v) localStorage.setItem("volume", v);
      }
      setVolume(val, save = true) {
        val = Number(val);
        if (!isNaN(val)) {
          this._volume = val;
          if (save) this.saveVolume(val / 100);
          window.api.player.setVolume(val);
        }
      }
      getVolume() {
        return this._volume;
      }
      volumeUp() {
        this.setVolume(Math.min(this.getVolume() + 2, 100));
      }
      volumeDown() {
        this.setVolume(Math.max(this.getVolume() - 2, 0));
      }
      onPlaying() {
        if (!this._started) {
          this._started = true;
          this.setVolume(this.getSavedVolume() * 100, false);
        }
      }
    }
    // What mpvVideoPlayer.js does when JMP loads it.
    window._mpvVideoPlayer = mpvVideoPlayer;

    const { maxPercent, stepPercent } = window.__volumeBooster.config;
    const first = new mpvVideoPlayer();
    first.onPlaying();
    const presses = Math.ceil((maxPercent - 100) / stepPercent) + 3;
    for (let i = 0; i < presses; i++) first.volumeUp();

    const next = new mpvVideoPlayer();
    next.onPlaying();
    return {
      maxPercent,
      afterUp: first.getVolume(),
      lastNative: window.__nativeCalls[window.__nativeCalls.length - 1],
      saved: localStorage.getItem("volume"),
      nextItem: next.getVolume(),
    };
  });

  expect(result.afterUp).toBe(result.maxPercent);
  expect(result.lastNative).toBe(result.maxPercent);
  expect(Number(result.saved)).toBeCloseTo(result.maxPercent / 100);
  expect(result.nextItem).toBe(result.maxPercent);

  // Extra key: reset to 100, then one step up via the keyboard.
  await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await page.keyboard.press("Backslash");
  await page.keyboard.press("BracketRight");
  const level = await page.evaluate(() => window.__volumeBooster.getLevel());
  const step = await page.evaluate(() => window.__volumeBooster.config.stepPercent);
  expect(level).toBe(100 + step);
  await expect(page.locator("#volumeBoosterIndicator")).toHaveText(new RegExp(`Volume ${100 + step}%`));
  expect(ourErrors()).toEqual([]);
});
