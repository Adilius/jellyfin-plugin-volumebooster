import { init } from "./main.js";

// The C# plugin prepends `window.VolumeBoosterConfig = {...};` when it registers
// this script; a hand-pasted copy runs with the defaults.
// Wait for the DOM so JMP's nativeshell.js has defined its globals; classes
// that are already loaded by then get patched in place.
function run() {
  init(window, window.VolumeBoosterConfig);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run, { once: true });
} else {
  run();
}
