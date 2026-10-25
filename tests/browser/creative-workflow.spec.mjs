import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { interactionProject } from "../fixtures/interaction-project.mjs";
import {
  standaloneHtml,
  validateProject,
  hashProject,
} from "../../src/core.mjs";
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const layer = (page, id) => page.locator(`[data-node="${id}"]`);
const canvas = (page, id) =>
  page.locator(`[data-artboard="work"] [data-node-id="${id}"]`);
async function open(page, p = interactionProject()) {
  expect(validateProject(p)).toEqual([]);
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "creative.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('[data-board="work"]')).toBeVisible();
  await layer(page, "action").click();
}
async function downloaded(page, action) {
  const event = page.waitForEvent("download");
  await action();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    data: JSON.parse(await fs.readFile(await file.path(), "utf8")),
  };
}
test("native hover, active, keyboard focus, loading and error render with reduced-motion support", async ({
  page,
}) => {
  const p = interactionProject();
  await page.setContent(standaloneHtml(p.boards[0], p));
  const button = page.locator('[data-node-id="action"]'),
    input = page.locator('[data-node-id="field"]');
  await button.hover();
  await expect(button).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await page.mouse.down();
  await expect(button).toHaveCSS("background-color", "rgb(35, 69, 103)");
  await page.mouse.up();
  await page.mouse.move(0, 0);
  await page.keyboard.press("Tab");
  await button.focus();
  await expect(button).toHaveCSS("outline-style", "solid");
  p.boards[0].nodes[0].loading = true;
  p.boards[0].nodes[1].invalid = true;
  await page.setContent(standaloneHtml(p.boards[0], p));
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(button).toHaveCSS("background-color", "rgb(69, 103, 137)");
  expect(
    await button.evaluate((el) => getComputedStyle(el, "::before").content),
  ).toBe('""');
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(button).toHaveCSS("transition-property", "none");
  expect(
    await button.evaluate(
      (el) => getComputedStyle(el, "::before").animationName,
    ),
  ).toBe("none");
});
test("state CSS stays isolated per leaf instance and wins over responsive ordinary appearance", async ({
  page,
}) => {
  const p = interactionProject(),
    source = structuredClone(p.boards[0].nodes[0]);
  source.id = "source";
  source.responsive = [
    { maxWidth: 600, changes: { style: { fill: "#AABBCC" } } },
  ];
  p.components = [
    {
      id: "control",
      name: "Control",
      variants: [{ id: "base", name: "Base", root: source }],
    },
  ];
  p.boards[0].w = 500;
  p.boards[0].nodes = ["one", "two"].map((id, i) => ({
    id,
    name: id,
    type: "instance",
    componentId: "control",
    variantId: "base",
    x: 40,
    y: 40 + i * 100,
    w: 220,
    h: 48,
    text: "",
    style: {},
    ...(i === 0 ? { states: { hover: { style: { fill: "#FFCCAA" } } } } : {}),
  }));
  await page.setContent(standaloneHtml(p.boards[0], p));
  const one = page.locator('[data-node-id="one"]'),
    two = page.locator('[data-node-id="two"]');
  await one.hover();
  await expect(one).toHaveCSS("background-color", "rgb(255, 204, 170)");
  await expect(two).toHaveCSS("background-color", "rgb(170, 187, 204)");
  await two.hover();
  await expect(two).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await expect(one).toHaveCSS("background-color", "rgb(170, 187, 204)");
});
test("state preview never saves; edits, reset, flags, Undo and reload preserve user content", async ({
  page,
}, info) => {
  await open(page);
  const original = await stored(page);
  await page.locator("#state-preview").selectOption("hover");
  await expect(canvas(page, "action")).toHaveCSS(
    "background-color",
    "rgb(18, 52, 86)",
  );
  expect(await stored(page)).toEqual(original);
  await page.locator('[data-state-field="fill"]').fill("#AA7733");
  await page.locator('[data-state-field="fill"]').press("Tab");
  await expect(canvas(page, "action")).toHaveCSS(
    "background-color",
    "rgb(170, 119, 51)",
  );
  expect((await stored(page)).boards[0].nodes[1]).toEqual(
    original.boards[0].nodes[1],
  );
  await page.locator("#undo").click();
  await expect(canvas(page, "action")).toHaveCSS(
    "background-color",
    "rgb(18, 52, 86)",
  );
  await page.locator("#redo").click();
  await page.locator('[data-state-flag="loading"]').scrollIntoViewIfNeeded();
  await page.locator('[data-state-flag="loading"]').selectOption("true");
  await expect(canvas(page, "action")).toBeDisabled();
  const inspectorScroll = await page
    .locator("#right-content")
    .evaluate((el) => el.scrollTop);
  expect(inspectorScroll).toBeGreaterThan(0);
  const flagRect = await page
    .locator('[data-state-flag="loading"]')
    .boundingBox();
  expect(flagRect.y + flagRect.height).toBeLessThan(960);
  await page.locator(".state-inspector").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("state-inspector.png"),
    fullPage: true,
  });
  await page.reload();
  await layer(page, "action").click();
  expect((await stored(page)).boards[0].nodes[0].loading).toBe(true);
  await expect(page.locator("#state-preview")).toHaveValue("default");
  await page.locator('[data-reset-state="hover"]').click();
  expect((await stored(page)).boards[0].nodes[0].states.hover).toBeUndefined();
  await page.locator('[data-state-flag="loading"]').selectOption("");
  await expect(canvas(page, "action")).toBeEnabled();
});
test("locked state controls cannot change a node and unsafe CSS leaves the full project untouched", async ({
  page,
}) => {
  const p = interactionProject();
  p.boards[0].nodes[0].locked = true;
  await open(page, p);
  const original = await stored(page);
  await page.locator('[data-state-field="fill"]').fill("#123123");
  await page.locator('[data-state-field="fill"]').press("Tab");
  expect(await stored(page)).toEqual(original);
  await page.locator("#state-preview").selectOption("focus");
  expect(await stored(page)).toEqual(original);
  const unlocked = interactionProject();
  await page.locator("#upload-json").setInputFiles({
    name: "new.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(unlocked)),
  });
  await layer(page, "action").click();
  const before = await stored(page);
  await page
    .locator('[data-state-field="fill"]')
    .fill("url(https://example.com/unsafe)");
  await page.locator('[data-state-field="fill"]').press("Tab");
  expect(await stored(page)).toEqual(before);
});
test("gallery filters, isolated previews, insert, reuse, source edit and design-library download are real operations", async ({
  page,
}, info) => {
  await open(page);
  const original = await stored(page);
  await page.locator('[data-lefttab="components"]').click();
  await page.locator("#starter-gallery > summary").click();
  await page.locator("#starter-category").selectOption("inputs");
  await page.locator("#starter-query").fill("邮箱");
  await page.locator("#starter-filter button").click();
  await expect(page.locator("#starter-cards iframe")).toHaveCount(1);
  await expect(page.locator("#starter-cards iframe")).toHaveAttribute(
    "sandbox",
    "",
  );
  await expect(
    page.frameLocator("#starter-cards iframe").locator("input"),
  ).toHaveAttribute("placeholder", "输入邮箱地址");
  expect(await stored(page)).toEqual(original);
  await expect(page.locator("#starter-query")).toHaveCSS(
    "border-radius",
    "7px",
  );
  await page.locator("#theme-toggle").click();
  const inputColors = await page.locator("#starter-query").evaluate((el) => ({
    text: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
  }));
  expect(inputColors.text).not.toBe(inputColors.background);
  await page.screenshot({
    path: info.outputPath("starter-gallery-dark.png"),
    fullPage: true,
  });
  await page.locator("#theme-toggle").click();
  await page.screenshot({
    path: info.outputPath("starter-gallery.png"),
    fullPage: true,
  });
  await page.locator('[data-insert-starter="email"]').click();
  const first = await stored(page);
  expect(first.components).toHaveLength(1);
  expect(first.boards[0].nodes).toHaveLength(3);
  const instance = first.boards[0].nodes[2];
  await expect(canvas(page, instance.id)).toHaveAttribute(
    "placeholder",
    "输入邮箱地址",
  );
  await page.locator('[data-insert-starter="email"]').click();
  expect((await stored(page)).components).toHaveLength(1);
  await page.locator("#undo").click();
  expect((await stored(page)).boards[0].nodes).toHaveLength(3);
  const file = await downloaded(page, () =>
    page.locator("#export-library").click(),
  );
  expect(
    file.data.components[0].variants[0].root.states.error.style.stroke,
  ).toBe("$danger");
  await page
    .locator('[data-component-manager="starter-email"] > summary')
    .click();
  await page
    .locator(
      '[data-component-action="copy-source"][data-component-id="starter-email"][data-variant="base"]',
    )
    .click();
  await expect(page.locator("#state-edit")).toBeVisible();
  await page.locator("#state-edit").selectOption("focus");
  await page.locator('[data-state-field="stroke"]').fill("#CC2211");
  await page.locator('[data-state-field="stroke"]').press("Tab");
  expect(
    (await stored(page)).boards.at(-1).nodes[0].states.focus.style.stroke,
  ).toBe("#CC2211");
});
test("brief persists with Undo and exports precise untrusted Agent context without executing hostile text", async ({
  page,
}, info) => {
  await open(page);
  await page.locator('[data-righttab="agent"]').click();
  await page.locator("#design-brief-panel > summary").click();
  await page
    .locator("#brief-product")
    .fill('<img src=x onerror="window.briefInjected=1">');
  await page.locator("#brief-product").press("Tab");
  await page.locator("#brief-audience").fill("Interface designers");
  await page.locator("#brief-audience").press("Tab");
  await expect(page.locator("#brief-audience")).toHaveValue(
    "Interface designers",
  );
  await page.locator("#undo").click();
  await expect(page.locator("#brief-audience")).toHaveValue("");
  await page.locator("#redo").click();
  await page.locator("#brief-profile").selectOption("product");
  expect(await page.evaluate(() => window.briefInjected)).toBeUndefined();
  await expect(page.locator("[data-brief-warnings]")).toContainText(
    "不生成虚构指标",
  );
  await page.locator("#brief-product").fill("DesignForge Studio");
  await page.locator("#brief-product").press("Tab");
  const before = await stored(page),
    result = await downloaded(page, () =>
      page.locator('[data-action="download-context"]').click(),
    );
  expect(result.name).toBe("designforge.context.json");
  expect(result.data.baseHash).toBe(hashProject(before));
  expect(result.data.scope).toMatchObject({
    boardId: "work",
    nodeId: "action",
  });
  expect(result.data.nodes).toHaveLength(1);
  expect(result.data.brief.audience).toBe("Interface designers");
  expect(result.data.trust).toContain("untrusted");
  expect(await stored(page)).toEqual(before);
  await page.locator("#design-brief-panel > summary").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("design-brief.png"),
    fullPage: true,
  });
  await page.reload();
  await page.locator('[data-righttab="agent"]').click();
  await page.locator("#design-brief-panel > summary").click();
  await expect(page.locator("#brief-audience")).toHaveValue(
    "Interface designers",
  );
  await expect(page.locator("#brief-profile")).toHaveValue("product");
});
for (const width of [390, 768, 1440])
  test(`Launch real responsive prototype stays within ${width}px and retains all native components`, async ({
    page,
  }, info) => {
    const p = JSON.parse(
      await fs.readFile(
        new URL("../../examples/Launch.project.json", import.meta.url),
        "utf8",
      ),
    );
    await page.setViewportSize({ width, height: 1000 });
    for (const board of p.boards) {
      await page.setContent(standaloneHtml({ ...board, w: width }, p));
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.locator(".df-board").evaluate((el) => ({
        client: el.clientWidth,
        scroll: el.scrollWidth,
        height: el.scrollHeight,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
      expect(await page.locator("button.df-button").count()).toBeGreaterThan(1);
      expect(await page.locator("input.df-input").count()).toBeGreaterThan(0);
      if (board.id === "landing" || width === 1440)
        await page.screenshot({
          path: info.outputPath(`launch-${board.id}-${width}.png`),
          fullPage: true,
        });
    }
  });
