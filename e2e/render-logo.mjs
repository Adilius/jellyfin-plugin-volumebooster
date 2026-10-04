// Renders assets/logo.svg to logo.jpg (1280x720, the catalog image).
// Usage: node e2e/render-logo.mjs   (needs: cd e2e; npm ci; npx playwright install chromium; and Python Pillow)
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "assets/logo.svg"), "utf8");
const png = resolve(root, "assets/logo-1920.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
await browser.close();

// Downscale and save as JPEG: the gradients make PNG ~0.5 MB, JPEG q92 ~85 KB without banding.
execFileSync("python", ["-c", `
from PIL import Image
import os
im = Image.open(r"${png}").convert("RGB").resize((1280, 720), Image.Resampling.LANCZOS)
im.save(r"${resolve(root, "logo.jpg")}", quality=92, optimize=True, progressive=True, subsampling=0)
os.remove(r"${png}")
`], { stdio: "inherit" });
console.log("wrote logo.jpg");
