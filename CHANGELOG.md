# Changelog

## 1.0.0.0 / 1.0.0.1 — 2026-10-29

First public release. Package `1.0.0.0` is for Jellyfin 10.11 (net9.0), `1.0.0.1` for Jellyfin 12.x
(net10.0).

- Volume above 100% in Jellyfin, up to 200% (configurable), with no transcoding:
  the client's mpv player is driven directly.
- Jellyfin's own volume controls (Up/Down arrows, mouse wheel) go past 100%; extra shortcuts
  `+`/`]` up, `-`/`[` down, `*`/`\` reset (several keys per action, AltGr keys work).
- Going up or down always stops at 100% first; held keys or continuous scrolling stay there until
  input pauses for 0.4 s.
- On-screen indicator with the dB gain (mpv's volume curve is cubic: 150% ≈ +10.6 dB,
  200% ≈ +18 dB); turns red from 150%. Jellyfin's own volume popup bar stays full above 100%
  instead of running past its box.
- The boost persists between items through the client's own saved volume.
- Inactive in normal browsers, and repairs a boosted saved volume so the HTML5 player never fails.
- No other plugins needed: the plugin adds its script tag to the web client's `index.html` as it is
  served (nothing on disk is changed) and serves the script from `/VolumeBooster/ClientScript`.
- Settings page in the dashboard; changes reach clients on their next reload.
