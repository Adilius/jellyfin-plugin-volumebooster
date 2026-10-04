import { describe, it, expect, vi, afterEach } from "vitest";
import { createIndicator, installOsdStyle } from "../src/ui.js";

describe("installOsdStyle", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("clips jellyfin-web's volume OSD bar at full, once", () => {
    installOsdStyle(document);
    installOsdStyle(document);
    const styles = document.querySelectorAll("#volumeBoosterStyle");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain(".volumeOsd .iconOsdProgressOuter { overflow: hidden; }");
    expect(styles[0].textContent).toContain(".volumeOsd .iconOsdProgressInner { max-width: 100%; }");
  });
});

describe("createIndicator", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("shows the level with dB and turns red from the threshold", () => {
    const ind = createIndicator(document, { warnAbovePercent: 150 });
    ind.show(145);
    expect(ind.element.textContent).toBe("Volume 145% (+9.7 dB)");
    expect(ind.element.dataset.warn).toBe("false");
    ind.show(150);
    expect(ind.element.textContent).toBe("Volume 150% (+10.6 dB)");
    expect(ind.element.dataset.warn).toBe("true");
    expect(document.querySelectorAll("#volumeBoosterIndicator")).toHaveLength(1);
  });

  it("hides after the timeout", () => {
    vi.useFakeTimers();
    const ind = createIndicator(document, { warnAbovePercent: 130, hideAfterMs: 1000 });
    ind.show(110);
    expect(ind.element.style.opacity).toBe("1");
    vi.advanceTimersByTime(1001);
    expect(ind.element.style.opacity).toBe("0");
  });
});
