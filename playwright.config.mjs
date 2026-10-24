import { defineConfig } from "@playwright/test";
const browserName = process.env.DESIGNFORGE_BROWSER || "chromium";
if (!["chromium", "firefox", "webkit"].includes(browserName))
  throw Error("DESIGNFORGE_BROWSER must be chromium, firefox or webkit");
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  updateSnapshots: "none",
  timeout: 30000,
  use: {
    channel:
      browserName === "chromium"
        ? process.env.DESIGNFORGE_BROWSER_CHANNEL || undefined
        : undefined,
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: browserName, use: { browserName } }],
});
