import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: { command: "node serve.mjs", url: "http://127.0.0.1:4173/css/app.css", reuseExistingServer: true },
  projects: [
    {
      name: "phone",
      testMatch: /(smoke|start|erg|stadium|a11y|screens)\.spec\.mjs/,
      use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
    {
      name: "laptop",
      testMatch: /(organiser|results|a11y|screens)\.spec\.mjs/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
  ],
});
