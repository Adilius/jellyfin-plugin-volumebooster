// Optional extra keyboard shortcuts. The built-in volume keys (Up/Down and
// the mouse wheel in the video OSD) already work past 100% once playerPatch
// raises the volumeUp/volumeDown cap.

function isEditable(target) {
  if (!target || typeof target !== "object") return false;
  const tag = (target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return typeof target.closest === "function" && !!target.closest("[contenteditable=''], [contenteditable='true']");
}

// AltGr (needed for [ ] \ on e.g. Swedish/German layouts) arrives on Windows
// as Ctrl+Alt; Chromium also reports it as the AltGraph modifier.
function isAltGr(event) {
  if (typeof event.getModifierState === "function" && event.getModifierState("AltGraph")) return true;
  return event.ctrlKey && event.altKey && !event.metaKey;
}

/** "+ ]" -> ["+", "]"]: each binding may list several keys separated by spaces. */
export function parseKeys(binding) {
  return typeof binding === "string" ? binding.split(/\s+/).filter(Boolean) : [];
}

/**
 * Returns a keydown handler. `actions` = { up, down, reset } callbacks.
 * Returns true from the handler when it consumed the event.
 */
export function createKeyHandler({ keys, actions }) {
  const map = new Map();
  for (const [binding, action] of [
    [keys.increaseKey, actions.up],
    [keys.decreaseKey, actions.down],
    [keys.resetKey, actions.reset],
  ]) {
    for (const key of parseKeys(binding)) map.set(key, action);
  }

  return function onKeyDown(event) {
    if (event.defaultPrevented) return false;
    if ((event.ctrlKey || event.altKey || event.metaKey) && !isAltGr(event)) return false;
    if (isEditable(event.target)) return false;

    const action = map.get(event.key);
    if (!action) return false;

    event.preventDefault();
    event.stopPropagation();
    action();
    return true;
  };
}
