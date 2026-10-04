// Pure volume maths: no DOM, no window.

export const DEFAULTS = Object.freeze({
  enabled: true,
  maxPercent: 200,
  hardMaxPercent: 200,
  stepPercent: 5,
  warnAbovePercent: 150,
  increaseKey: "+ ]",
  decreaseKey: "- [",
  resetKey: "* \\",
  resetOnStart: false,
});

function toNumber(value) {
  if (typeof value === "string" && value.trim() === "") return NaN;
  return Number(value);
}

/**
 * Merge a user config over the defaults and sanitise it.
 * Invalid values fall back to the default; maxPercent is limited to
 * [100, hardMaxPercent].
 */
export function normalizeConfig(input = {}) {
  const cfg = { ...DEFAULTS };
  if (!input || typeof input !== "object") return cfg;

  if (typeof input.enabled === "boolean") cfg.enabled = input.enabled;
  if (typeof input.resetOnStart === "boolean") cfg.resetOnStart = input.resetOnStart;

  const max = toNumber(input.maxPercent);
  if (Number.isFinite(max)) cfg.maxPercent = Math.round(Math.min(Math.max(max, 100), cfg.hardMaxPercent));

  const step = toNumber(input.stepPercent);
  if (Number.isFinite(step) && step >= 1 && step <= 25) cfg.stepPercent = Math.round(step);

  const warn = toNumber(input.warnAbovePercent);
  if (Number.isFinite(warn) && warn >= 100) cfg.warnAbovePercent = Math.round(warn);

  for (const key of ["increaseKey", "decreaseKey", "resetKey"]) {
    if (typeof input[key] === "string" && input[key].length > 0) cfg[key] = input[key];
  }
  return cfg;
}

/**
 * mpv's software volume is cubic: gain = (volume / 100) ^ 3.
 * Returns the gain change in dB relative to 100%.
 */
export function percentToDb(percent) {
  if (!(percent > 0)) return -Infinity;
  return 60 * Math.log10(percent / 100);
}

export function formatLevel(percent) {
  const level = Math.round(percent);
  if (level === 0) return "Volume 0%";
  const db = percentToDb(level);
  const sign = db > 0 ? "+" : "";
  return `Volume ${level}% (${sign}${db.toFixed(1)} dB)`;
}

/** How long input must pause before a step may leave the 100% detent. */
export const STICK_MS = 400;

/**
 * Volume stepping with a detent at 100%. A step that would cross 100% (up
 * from below or down from above) lands on 100% instead, and further steps in
 * the same direction are swallowed while they keep coming faster than
 * `stickMs` apart (key auto-repeat, continuous wheel scrolling). The next step
 * after a pause leaves 100%.
 *
 * Returns step(current, direction) -> next level, direction = +1 or -1.
 */
export function createStepper({ getMax, getStep, now = () => Date.now(), stickMs = STICK_MS }) {
  let stickDirection = 0;
  let stickUntil = 0;

  return function step(current, direction) {
    const level = Number(current);
    if (!Number.isFinite(level)) return level;
    const t = now();

    if (level === 100 && direction === stickDirection && t < stickUntil) {
      stickUntil = t + stickMs;
      return 100;
    }
    stickDirection = 0;

    let next = Math.min(Math.max(level + direction * getStep(), 0), getMax());
    if ((level < 100 && next > 100) || (level > 100 && next < 100)) next = 100;
    if (next === 100 && level !== 100) {
      stickDirection = direction;
      stickUntil = t + stickMs;
    }
    return next;
  };
}
