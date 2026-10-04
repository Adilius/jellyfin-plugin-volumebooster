import { defineConfig } from "@playwright/test";

// Runs against a Jellyfin server with this plugin installed (see dev/dev.ps1,
// or the CI workflow). Override with JF_URL, e.g. http://localhost:8097 for Jellyfin 12.
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 0,
  globalSetup: "./global-setup.js",
  use: {
    baseURL: process.env.JF_URL || "http://localhost:8096",
    browserName: "chromium",
    headless: true,
  },
});
