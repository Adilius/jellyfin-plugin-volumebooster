import { formatLevel } from "./core.js";

const ID = "volumeBoosterIndicator";
const STYLE_ID = "volumeBoosterStyle";

// jellyfin-web's volume OSD (components/playback/volumeosd.js) sets the bar
// width to `${volume}%`, so a boosted level runs past the end of its track.
// Clip it at full; the indicator shows the actual level.
const OSD_CSS = `
.volumeOsd .iconOsdProgressOuter { overflow: hidden; }
.volumeOsd .iconOsdProgressInner { max-width: 100%; }
`;

/** Add the OSD fix stylesheet once. */
export function installOsdStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = OSD_CSS;
  (doc.head || doc.documentElement).appendChild(style);
}

/**
 * On-screen indicator. jellyfin-web's OSD slider is max="100", so it cannot
 * show a boosted level; this toast does.
 */
export function createIndicator(doc, { warnAbovePercent, hideAfterMs = 1500 } = {}) {
  let el = null;
  let timer = null;

  function ensure() {
    if (el && el.isConnected) return el;
    el = doc.getElementById(ID);
    if (!el) {
      el = doc.createElement("div");
      el.id = ID;
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      Object.assign(el.style, {
        position: "fixed",
        top: "12%",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        padding: "0.5em 1em",
        borderRadius: "0.4em",
        font: "600 1.1em/1.4 sans-serif",
        color: "#fff",
        background: "rgba(0, 0, 0, 0.75)",
        pointerEvents: "none",
        transition: "opacity 0.2s",
        opacity: "0",
      });
      (doc.body || doc.documentElement).appendChild(el);
    }
    return el;
  }

  function show(level) {
    const node = ensure();
    node.textContent = formatLevel(level);
    const warn = level >= warnAbovePercent;
    node.dataset.warn = warn ? "true" : "false";
    node.style.background = warn ? "rgba(170, 30, 20, 0.85)" : "rgba(0, 0, 0, 0.75)";
    node.style.opacity = "1";
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      node.style.opacity = "0";
    }, hideAfterMs);
  }

  return {
    show,
    get element() {
      return el;
    },
  };
}
