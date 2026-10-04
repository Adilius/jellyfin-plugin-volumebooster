# Manual release checklist

Run on JMP 1.12 and the current Jellyfin Desktop, against each supported server line.

- [ ] Clean install via catalog on a fresh server (no other plugins), restart
- [ ] `node scripts/jmp-smoke.mjs` reports `OK` with the client started with `--remote-debugging-port=9222`
- [ ] Tone at 100 → 150 → 200%: loopback meter rises ≈ +10.6 / +18.1 dB
- [ ] Built-in volume up (OSD, keyboard, media key) goes past 100% and stops at the max
- [ ] Extra keys `+` `-` `*` and AltGr `]` `[` `\` work; ignored while typing in a text field
- [ ] Going up from below 100% (held key / continuous scroll) stops at 100%; a new press after a pause continues
- [ ] Indicator shows level + dB, turns red from 150%
- [ ] Jellyfin's volume popup (top right) bar stays inside its box above 100%
- [ ] Boost persists to the next episode / track and after restarting the client
- [ ] Reset-on-start setting brings it back to 100% on client start
- [ ] Lowering the max in settings caps an already-saved higher level
- [ ] Mute still works; OSD slider caveat behaves as documented
- [ ] Server dashboard shows Direct Play (no transcoding) during boosted playback
- [ ] Same user in a normal browser: script inactive, playback volume ≤ 100%, no errors
- [ ] Upgrade from the previous version keeps settings
- [ ] Uninstall removes the script (no `<!-- Volume Booster -->` tag in `/web/index.html` after restart)

Add a regression test for every bug found here.
