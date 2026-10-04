import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(here, "dist/volumebooster.js");
const embedded = resolve(here, "../Jellyfin.Plugin.VolumeBooster/Web/volumebooster.js");

await build({
  entryPoints: [resolve(here, "src/entry.js")],
  bundle: true,
  format: "iife",
  // JMP 1.12 ships Qt WebEngine 5.15 (Chromium 83 based).
  target: ["chrome83"],
  outfile,
  legalComments: "none",
  banner: { js: "/* Volume Booster - GPL-3.0 */" },
});

mkdirSync(dirname(embedded), { recursive: true });
copyFileSync(outfile, embedded);
console.log(`built ${outfile}\ncopied to ${embedded}`);
