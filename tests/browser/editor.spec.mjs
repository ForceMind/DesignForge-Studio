import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { flattenNodes } from "../../src/tree.mjs";
import { standaloneHtml } from "../../src/core.mjs";
const fixture = JSON.parse(
  fs.readFileSync(
    new URL("../../examples/Studio.project.json", import.meta.url),
  ),
);
const key = "designforge.project.v1";
const root = fixture.boards[0].nodes[0],
  header = root.children[0],
  title = root.children[1],
  stats = root.children[2];
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const descendants = (nodes) =>
  nodes.flatMap((n) => [n, ...descendants(n.children || [])]);
async function load(page) {
  await page.goto("/");
  await page.locator("#example-picker").selectOption("Studio");
  await expect(page.locator("#project-title")).toHaveText(fixture.title);
}
async function select(page, id) {
  await page.locator(`[data-node="${id}"]`).click();
}
test("tree, canvas and inspector agree; edit, undo, redo and reload preserve child data", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  await select(page, title.id);
  await expect(
    page.locator(
      `[data-artboard="${fixture.boards[0].id}"] [data-node-id="${title.id}"]`,
    ),
  ).toHaveClass(/is-selected/);
  await page.locator('[data-prop="text"]').fill("Edited nested title");
  await page.locator('[data-prop="text"]').press("Tab");
  expect(
    descendants((await stored(page)).boards[0].nodes).find(
      (n) => n.id === title.id,
    ).text,
  ).toBe("Edited nested title");
  await page.locator("#undo").click();
  expect(
    descendants((await stored(page)).boards[0].nodes).find(
      (n) => n.id === title.id,
    ).text,
  ).toBe(title.text);
  await page.locator("#redo").click();
  await page.reload();
  await select(page, title.id);
  await expect(page.locator('[data-prop="text"]')).toHaveValue(
    "Edited nested title",
  );
  expect(errors).toEqual([]);
});
test("Flex/Grid controls update real browser layout and content remains nested", async ({
  page,
}) => {
  await load(page);
  await select(page, stats.id);
  await page.locator('[data-prop="layout.columns"]').fill("2");
  await page.locator('[data-prop="layout.columns"]').press("Tab");
  const node = page.locator(
    `[data-artboard="${fixture.boards[0].id}"] [data-node-id="${stats.id}"]`,
  );
  expect(
    await node.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(2);
  await page.locator('[data-prop="layout.mode"]').selectOption("flex");
  await page.locator('[data-prop="layout.direction"]').selectOption("column");
  await expect(node).toHaveCSS("display", "flex");
  await expect(node).toHaveCSS("flex-direction", "column");
  expect(
    (await stored(page)).boards[0].nodes[0].children[2].children.length,
  ).toBe(3);
});
test("Shift selection, group/ungroup and subtree copy preserve unique IDs", async ({
  page,
}) => {
  await load(page);
  await select(page, title.id);
  await page
    .locator(`[data-node="${stats.id}"]`)
    .click({ modifiers: ["Shift"] });
  // Both selected nodes are children of a Flex container: grouping must be rejected without data loss.
  const before = await stored(page);
  await page.locator('[data-action="group"]').click();
  await expect(page.locator("#toast")).toContainText("absolute-layout");
  expect(await stored(page)).toEqual(before);
  await select(page, root.id);
  await page.locator('[data-prop="layout.mode"]').selectOption("absolute");
  await select(page, title.id);
  await page
    .locator(`[data-node="${stats.id}"]`)
    .click({ modifiers: ["Shift"] });
  await page.locator('[data-action="group"]').click();
  let p = await stored(page),
    g = descendants(p.boards[0].nodes).find((n) => n.type === "group");
  expect(g.children.map((n) => n.id)).toEqual([title.id, stats.id]);
  await page.locator('[data-action="ungroup"]').click();
  p = await stored(page);
  expect(descendants(p.boards[0].nodes).some((n) => n.id === g.id)).toBe(false);
  await select(page, stats.id);
  await page.locator("#duplicate-node").click();
  p = await stored(page);
  const ids = descendants(p.boards[0].nodes).map((n) => n.id);
  expect(new Set(ids).size).toBe(ids.length);
});
test("reparent through inspector, collapse and expand retain selectable child", async ({
  page,
}) => {
  await load(page);
  await select(page, title.id);
  await page.locator('[data-prop="parentId"]').selectOption("");
  expect(
    (await stored(page)).boards[0].nodes.some((n) => n.id === title.id),
  ).toBe(true);
  await page.locator('[data-prop="parentId"]').selectOption(root.id);
  await page.locator(`[data-fold="${root.id}"]`).click();
  await expect(page.locator(`[data-node="${title.id}"]`)).toHaveCount(0);
  await page.locator(`[data-fold="${root.id}"]`).click();
  await select(page, title.id);
  await expect(page.locator('[data-prop="text"]')).toHaveValue(title.text);
});
test("component variants update browser content; detach produces editable children", async ({
  page,
}) => {
  await load(page);
  const instance = flattenNodes(fixture.boards[0].nodes).find(
    (e) => e.node.type === "instance",
  ).node;
  await select(page, instance.id);
  await page.locator('[data-prop="variantId"]').selectOption("secondary");
  const el = page.locator(
    `[data-artboard="${fixture.boards[0].id}"] [data-node-id="${instance.id}"]`,
  );
  await expect(el).toContainText("View project");
  await page.locator('[data-action="detach"]').click();
  const p = await stored(page),
    n = descendants(p.boards[0].nodes).find((n) => n.id === instance.id);
  expect(n.type).toBe("frame");
  expect(n.children[0].text).toBe("View project");
  await select(page, n.children[0].id);
  await expect(page.locator('[data-prop="text"]')).toHaveValue("View project");
});
test("project theme and editor theme are independent and persist after reload", async ({
  page,
}) => {
  await load(page);
  await page.locator('[data-righttab="tokens"]').click();
  await page.locator('[data-theme="project"]').selectOption("dark");
  expect((await stored(page)).activeTheme).toBe("dark");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect((await stored(page)).activeTheme).toBe("dark");
  await page.screenshot({ path: "test-results/editor-dark.png" });
});
test("M0 remains editable, and exporting ZIP is a real download", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#example-picker").selectOption("Orbit");
  await expect(page.locator(".df-node")).toHaveCount(170);
  await select(page, "el64");
  await expect(page.locator('[data-prop="text"]')).toHaveValue(
    "Revenue over time",
  );
  const download = page.waitForEvent("download");
  await page.locator("#export-project").click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
});
test("corrupt local project automatically recovers valid backup", async ({
  page,
}) => {
  await load(page);
  await select(page, title.id);
  await page.locator('[data-prop="text"]').fill("Next revision");
  await page.locator('[data-prop="text"]').press("Tab");
  await page.evaluate((k) => localStorage.setItem(k, "{broken"), key);
  await page.reload();
  await expect(page.locator("#project-title")).toHaveText(fixture.title);
  await expect(page.locator("#toast")).toContainText("备份恢复");
});
test("editor chrome fits a 1024px desktop and both side panels stay usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await load(page);
  await select(page, root.id);
  await expect(page.locator(".rightbar")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/editor-1024.png" });
});
for (const width of [390, 768, 1440])
  test(`responsive exported Studio reflows at ${width}px and stays within page width`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1800 });
    await page.setContent(standaloneHtml(fixture.boards[0], fixture));
    const grid = page.locator(`[data-node-id="${stats.id}"]`);
    expect(
      await grid.evaluate(
        (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
      ),
    ).toBe(width <= 600 ? 1 : 3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const maxBottom = await page
      .locator(".df-node")
      .evaluateAll((els) =>
        Math.max(...els.map((e) => e.getBoundingClientRect().bottom)),
      );
    const boardBottom = await page
      .locator(".df-board")
      .evaluate((e) => e.getBoundingClientRect().bottom);
    expect(maxBottom).toBeLessThanOrEqual(boardBottom + 2);
    const overflow = await page.locator(".df-node").evaluateAll((els) =>
      els
        .filter((el) => {
          const p = el.parentElement,
            r = el.getBoundingClientRect(),
            b = p.getBoundingClientRect();
          return r.right > b.right + 2 || r.left < b.left - 2;
        })
        .map((e) => e.dataset.nodeId || e.dataset.sourceId),
    );
    expect(overflow).toEqual([]);
    await page.screenshot({
      path: `test-results/studio-${width}.png`,
      fullPage: true,
    });
  });
for (const name of [
  "Settings",
  "Kanban",
  "GameHUD",
  "LandscapeHUD",
  "Pricing",
  "Messages",
  "SignIn",
  "Storefront",
  "Files",
])
  test(`example ${name} renders in real Chromium without horizontal overflow`, async ({
    page,
  }) => {
    const p = JSON.parse(
        fs.readFileSync(
          new URL(`../../examples/${name}.project.json`, import.meta.url),
        ),
      ),
      b = p.boards[0];
    await page.setViewportSize({ width: b.w, height: b.h });
    await page.setContent(standaloneHtml(b, p));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
  });
test("safe vector import, insertion, local persistence and referenced-asset protection", async ({
  page,
}) => {
  await load(page);
  await page.locator('[data-lefttab="assets"]').click();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#2563EB"/></svg>';
  await page.locator("#upload-asset").setInputFiles({
    name: "mark.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(svg),
  });
  await expect(page.locator("#asset-list")).toContainText("mark.svg");
  await page.locator("[data-insert-asset]").click();
  const p = await stored(page),
    img = p.boards[0].nodes.find((n) => n.type === "image");
  expect(img).toBeTruthy();
  const image = page.locator(
    `[data-artboard="${p.boards[0].id}"] [data-node-id="${img.id}"]`,
  );
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((el) => el.complete && el.naturalWidth > 0))
    .toBe(true);
  await page.locator("[data-remove-asset]").click();
  expect((await stored(page)).assets).toHaveLength(1);
  await expect(page.locator("#toast")).toContainText("Unknown image asset");
  await page.locator("#upload-asset").setInputFiles({
    name: "evil.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
  });
  await expect(page.locator("#toast")).toContainText("资源被拒绝");
  await page.reload();
  expect((await stored(page)).assets).toHaveLength(1);
});
test("free-layer mouse drag snaps and is one undoable transaction", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#example-picker").selectOption("Orbit");
  await page.locator('#board-list [data-board="mobile"]').click();
  // Use a fully visible free layer from the starter mobile board.
  const state = await stored(page),
    board = state.boards.find((b) => b.id === "mobile"),
    target = board.nodes.find((n) => n.type === "text");
  await select(page, target.id);
  const el = page.locator(
    `[data-artboard="mobile"] [data-node-id="${target.id}"]`,
  );
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + 35, box.y + 21, { steps: 5 });
  await page.mouse.up();
  let p = await stored(page),
    n = p.boards
      .find((b) => b.id === "mobile")
      .nodes.find((n) => n.id === target.id);
  expect(n.x !== target.x || n.y !== target.y).toBe(true);
  await page.locator("#undo").click();
  p = await stored(page);
  n = p.boards
    .find((b) => b.id === "mobile")
    .nodes.find((n) => n.id === target.id);
  expect(n.x).toBe(target.x);
  expect(n.y).toBe(target.y);
});
test("instance text overrides stay local and undo restores inherited content", async ({
  page,
}) => {
  await load(page);
  const instance = flattenNodes(fixture.boards[0].nodes).find(
      (e) => e.node.type === "instance",
    ).node,
    sourceId = fixture.components[0].variants[0].root.children[0].id;
  await select(page, instance.id);
  await page.locator(`[data-instance-text="${sourceId}"]`).fill("Local action");
  await page.locator(`[data-instance-text="${sourceId}"]`).press("Tab");
  const first = page.locator(
    `[data-artboard="${fixture.boards[0].id}"] [data-node-id="${instance.id}"]`,
  );
  await expect(first).toContainText("Local action");
  await expect(
    page.locator(`[data-artboard="${fixture.boards[1].id}"]`),
  ).toContainText("Create project");
  await page.locator("#undo").click();
  await expect(first).toContainText("Create project");
});
test("color picker remains available alongside editable token bindings", async ({
  page,
}) => {
  await load(page);
  await select(page, root.id);
  const binding = page.locator('[data-prop="style.fill"]'),
    picker = page.locator('[data-style-color="style.fill"]');
  await expect(binding).toHaveValue("$surface");
  await expect(picker).toHaveValue("#ffffff");
  await picker.fill("#123456");
  await picker.dispatchEvent("change");
  expect((await stored(page)).boards[0].nodes[0].style.fill).toBe("#123456");
  await binding.fill("$surfaceAlt");
  await binding.press("Tab");
  expect((await stored(page)).boards[0].nodes[0].style.fill).toBe(
    "$surfaceAlt",
  );
});
