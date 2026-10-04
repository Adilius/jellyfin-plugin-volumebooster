import { createStepper, normalizeConfig } from "./core.js";
import { createPlayerPatch, isNativeShell } from "./playerPatch.js";
import { createKeyHandler } from "./input.js";
import { createIndicator, installOsdStyle } from "./ui.js";

// jellyfin-web's appSettings stores the shared player volume (0..1 fraction)
// in localStorage under this key; JMP's mpv wrappers and the HTML5 players
// both read it.
export const SAVED_VOLUME_KEY = "volume";

/** Lower the saved volume fraction to `maxFraction` if it is above it. */
export function clampSavedVolume(storage, maxFraction) {
  try {
    const raw = storage.getItem(SAVED_VOLUME_KEY);
    if (raw === null) return false;
    const n = Number(raw);
    if (Number.isFinite(n) && n > maxFraction) {
      storage.setItem(SAVED_VOLUME_KEY, String(maxFraction));
      return true;
    }
  } catch {
    // Storage can be unavailable; nothing to fix then.
  }
  return false;
}

function getStorage(win) {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}

/**
 * Wire everything up. Safe to call more than once; later calls return the
 * first instance.
 */
export function init(win, rawConfig, { logger = console } = {}) {
  if (win.__volumeBooster) return win.__volumeBooster;

  const config = normalizeConfig(rawConfig);
  const storage = getStorage(win);
  const native = isNativeShell(win);

  if (!config.enabled) {
    win.__volumeBooster = { active: false, reason: "disabled", config };
    return win.__volumeBooster;
  }

  if (!native) {
    // A normal browser uses the HTML5 player, which sets media.volume from the
    // saved fraction and fails above 1. Never boost here; repair a boosted
    // value left behind by a shared origin.
    if (storage) clampSavedVolume(storage, 1);
    win.__volumeBooster = { active: false, reason: "not-native-shell", config };
    return win.__volumeBooster;
  }

  if (storage) clampSavedVolume(storage, config.resetOnStart ? 1 : config.maxPercent / 100);

  const doc = win.document;
  installOsdStyle(doc);
  const indicator = createIndicator(doc, { warnAbovePercent: config.warnAbovePercent });

  // One stepper for every input (Up/Down, wheel, media keys, extra keys) so
  // the 100% detent behaves the same everywhere.
  const stepLevel = createStepper({
    getMax: () => config.maxPercent,
    getStep: () => config.stepPercent,
  });

  const patch = createPlayerPatch({
    win,
    getMax: () => config.maxPercent,
    stepLevel,
    onChange: (level, { user }) => {
      if (user) indicator.show(level);
    },
    logger,
  });
  patch.install();

  function step(direction) {
    const current = patch.getLevel();
    if (current === null) return;
    patch.apply(direction === 0 ? 100 : stepLevel(current, direction));
  }

  const onKeyDown = createKeyHandler({
    keys: config,
    actions: {
      up: () => step(1),
      down: () => step(-1),
      reset: () => step(0),
    },
  });
  doc.addEventListener("keydown", onKeyDown, true);

  win.__volumeBooster = {
    active: true,
    config,
    patch,
    indicator,
    setLevel: (level) => patch.apply(level),
    getLevel: () => patch.getLevel(),
    dispose() {
      doc.removeEventListener("keydown", onKeyDown, true);
    },
  };
  return win.__volumeBooster;
}
