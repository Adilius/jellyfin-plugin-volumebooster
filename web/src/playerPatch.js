// Patches Jellyfin Media Player's own player wrappers (native/mpvVideoPlayer.js
// and native/mpvAudioPlayer.js). Those classes:
//   - save the volume as a 0..1 fraction in appSettings on setVolume(val),
//   - restore getSavedVolume() * 100 in onPlaying for every new item,
//   - clamp only in volumeUp()/volumeDown() (to 0..100).
// Raising that clamp and going through setVolume() makes a boost persist
// across items with no timers.

export const PLAYER_GLOBALS = ["_mpvVideoPlayer", "_mpvAudioPlayer"];
const MARK = "__volumeBoosterPatched";

/** True when running inside JMP / Jellyfin Desktop (QWebChannel bridge present). */
export function isNativeShell(win) {
  return !!(win && (win.api || win.apiPromise || win.jmpInfo));
}

// stepLevel(current, direction) -> next level (core.createStepper: step size,
// max and the 100% detent).
export function createPlayerPatch({ win, getMax, stepLevel, onChange = () => {}, logger = console }) {
  let current = null;
  const warned = new Set();

  function warnOnce(key, ...args) {
    if (warned.has(key)) return;
    warned.add(key);
    logger.warn("[VolumeBooster]", ...args);
  }

  function patchClass(cls) {
    if (typeof cls !== "function" || !cls.prototype) return false;
    const proto = cls.prototype;
    if (proto[MARK]) return true;

    const originalSetVolume = proto.setVolume;
    if (typeof originalSetVolume !== "function" || typeof proto.getVolume !== "function") {
      warnOnce("shape", "player class has no setVolume/getVolume; not patched");
      return false;
    }

    proto.setVolume = function (val, ...rest) {
      current = this;
      const n = Number(val);
      // Enforce the configured cap everywhere, including volumes restored
      // from appSettings after the cap was lowered.
      const capped = Number.isFinite(n) && n > getMax() ? getMax() : val;
      const result = originalSetVolume.call(this, capped, ...rest);
      try {
        onChange(Number(this.getVolume()), { user: rest[0] !== false, player: this });
      } catch (e) {
        warnOnce("onChange", "change handler failed", e);
      }
      return result;
    };

    proto.volumeUp = function () {
      this.setVolume(stepLevel(this.getVolume(), 1));
    };

    proto.volumeDown = function () {
      this.setVolume(stepLevel(this.getVolume(), -1));
    };

    Object.defineProperty(proto, MARK, { value: true });
    return true;
  }

  // Patch the class now if it is already loaded, otherwise when JMP assigns it
  // (nativeshell.js lazily loads e.g. mpvVideoPlayer.js, which ends with
  // `window._mpvVideoPlayer = mpvVideoPlayer;`).
  function hookGlobal(name) {
    const existing = win[name];
    if (existing) {
      patchClass(existing);
      return;
    }
    let value;
    try {
      Object.defineProperty(win, name, {
        configurable: true,
        enumerable: true,
        get() {
          return value;
        },
        set(next) {
          value = next;
          patchClass(next);
        },
      });
    } catch (e) {
      warnOnce(`define-${name}`, `cannot watch window.${name}`, e);
    }
  }

  function install() {
    PLAYER_GLOBALS.forEach(hookGlobal);
  }

  /** Set the volume through the active player wrapper (persists), else natively. */
  function apply(level) {
    const target = Math.min(Math.max(Number(level), 0), getMax());
    if (!Number.isFinite(target)) return false;
    try {
      if (current) {
        current.setVolume(target);
        return true;
      }
      const player = win.api && win.api.player;
      if (player && typeof player.setVolume === "function") {
        player.setVolume(target);
        return true;
      }
      warnOnce("no-player", "no player available to set volume on");
    } catch (e) {
      warnOnce("apply", "setVolume failed", e);
    }
    return false;
  }

  function getLevel() {
    try {
      return current ? Number(current.getVolume()) : null;
    } catch {
      return null;
    }
  }

  return {
    install,
    patchClass,
    apply,
    getLevel,
    get currentPlayer() {
      return current;
    },
  };
}
