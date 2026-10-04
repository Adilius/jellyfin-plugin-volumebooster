// Minimal mirror of the volume behaviour in Jellyfin Media Player 1.12.0
// native/mpvVideoPlayer.js, used as a test fixture.

export function fakeApi() {
  const calls = [];
  return {
    calls,
    player: {
      setVolume: (v) => {
        calls.push(v);
      },
    },
  };
}

export function makePlayerClass(api, storage) {
  return class mpvVideoPlayer {
    constructor() {
      this._volume = 100;
      this._started = false;
      this.appSettings = {
        get: (k) => storage.getItem(k),
        set: (k, v) => storage.setItem(k, v),
      };
    }

    getSavedVolume() {
      return this.appSettings.get("volume") || 1;
    }

    saveVolume(value) {
      if (value) {
        this.appSettings.set("volume", value);
      }
    }

    setVolume(val, save = true) {
      val = Number(val);
      if (!isNaN(val)) {
        this._volume = val;
        if (save) {
          this.saveVolume(val / 100);
        }
        api.player.setVolume(val);
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
        const volume = this.getSavedVolume() * 100;
        this.setVolume(volume, false);
      }
    }
  };
}

export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    dump: () => Object.fromEntries(data),
  };
}
