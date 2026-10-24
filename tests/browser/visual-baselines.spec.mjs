import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { standaloneHtml } from "../../src/core.mjs";
const studio = JSON.parse(
  fs.readFileSync(
    new URL("../../examples/Studio.project.json", import.meta.url),
    "utf8",
  ),
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Pixel baselines are approved specifically for Chrome on Linux; functional tests run in all engines.",
);
test.use({
  viewport: { width: 1440, height: 1000 },
  locale: "en-US",
  timezoneId: "UTC",
  deviceScaleFactor: 1,
});
for (const width of [390, 768, 1440]) {
  test(`Studio export pixel baseline at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(standaloneHtml(studio.boards[0], studio));
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".df-board")).toBeVisible();
    await expect(page).toHaveScreenshot(`studio-${width}.png`, {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.001,
    });
  });
}
for (const theme of ["light", "dark"]) {
  test(`workbench pixel baseline in ${theme} theme`, async ({ page }) => {
    await page.goto("/");
    await page.locator("#upload-json").setInputFiles({
      name: "Studio.project.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(studio)),
    });
    await expect(page.locator('[data-board="m45"]')).toBeVisible();
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page.locator("#theme-toggle").click();
    await page.locator('[data-node="m42"]').click();
    await page.locator("#fit-all").click();
    await page.mouse.move(1, 1);
    await expect(page.locator("#toast")).toBeHidden();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`workbench-${theme}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.001,
    });
  });
}
