# Troubleshooting

Start the client with `--remote-debugging-port=9222` (quit it first — it is single-instance), then
run `node scripts/jmp-smoke.mjs` or open `chrome://inspect` and check `window.__volumeBooster`.

| Symptom | Check |
|---|---|
| `scriptLoaded: false` | Is the plugin active (Dashboard → Plugins)? The server log should contain `Volume Booster: client script added to the web client`, and `/web/index.html` should contain `<!-- Volume Booster -->` followed by a `VolumeBooster/ClientScript` script tag. Reload the client (Ctrl+R). |
| `active: false, reason: not-native-shell` | The page has no JMP bridge — a normal browser, or a client version with a different bridge. |
| `active: false, reason: disabled` | Enable it in Dashboard → Plugins → Volume Booster. |
| `videoPlayerPatched: false` | The player class loads on first use; play something and re-run. If still false, the client's `mpvVideoPlayer.js` changed — open an issue with the client version. |
| Volume drops back to ≤ 100% | You touched the OSD slider (max 100) — known limit. |
| Distortion | Lower the max, or add `af=lavfi=[alimiter=limit=0.95]` to `mpv.conf`. |
