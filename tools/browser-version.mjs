import { chromium, firefox, webkit } from "playwright";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const engine = process.env.DESIGNFORGE_BROWSER || "chromium";
if (!["chromium", "firefox", "webkit"].includes(engine))
  throw Error("Unknown browser engine");
const channel =
  engine === "chromium"
    ? process.env.DESIGNFORGE_BROWSER_CHANNEL || undefined
    : undefined;
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  channel,
});
try {
  const page = await browser.newPage();
  const userAgent = await page.evaluate(() => navigator.userAgent);
  process.stdout.write(
    JSON.stringify(
      {
        engine,
        channel: channel || null,
        version: browser.version(),
        playwright: require("playwright/package.json").version,
        platform: process.platform,
        arch: process.arch,
        userAgent,
        recordedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
