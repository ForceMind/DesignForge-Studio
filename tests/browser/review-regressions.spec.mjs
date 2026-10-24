import { test, expect } from "@playwright/test";
import { newProject, standaloneHtml } from "../../src/core.mjs";
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
function project() {
  const p = newProject("Review regressions");
  p.boards = [
    {
      id: "work",
      name: "Measured constraints",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "frame",
          type: "frame",
          name: "Parent",
          x: 40,
          y: 40,
          w: 640,
          h: 480,
          text: "",
          style: { fill: "$surfaceAlt", stroke: "$border", strokeWidth: 2 },
          layout: { mode: "absolute" },
          responsive: [{ maxWidth: 600, changes: { w: 500 } }],
          children: [
            {
              id: "copy",
              type: "text",
              name: "Hug label",
              x: 360,
              y: 250,
              w: 160,
              h: 80,
              text: "Short label",
              style: { fontSize: 18, color: "$ink" },
              sizing: { w: "hug", h: "hug" },
              constraints: { horizontal: "end", vertical: "end" },
              responsive: [{ maxWidth: 600, changes: { w: 220, h: 100 } }],
            },
          ],
        },
      ],
    },
  ];
  return p;
}
const child = (p) => p.boards[0].nodes[0].children[0];
async function open(page, p = project()) {
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "review.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('[data-board="work"]')).toBeVisible();
  await page.locator("#snap-toggle").uncheck();
}
async function scale(page) {
  return page
    .locator("#world")
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
}
for (const width of [800, 600]) {
  test(`End + Hug nudges and drag use measured extents at ${width}px without a commit jump`, async ({
    page,
  }) => {
    await open(page);
    if (width !== 800)
      await page.locator("#preview-width").selectOption(String(width));
    await page.locator('[data-node="copy"]').click();
    await page.locator("#viewport").focus();
    const node = page.locator('[data-node-id="copy"]'),
      before = await node.boundingBox(),
      z = await scale(page);
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    const nudged = await node.boundingBox();
    expect((nudged.x - before.x) / z).toBeCloseTo(3, 1);
    expect((nudged.y - before.y) / z).toBeCloseTo(10, 1);
    expect(child(await stored(page))).toMatchObject({
      x: 363,
      y: 260,
      w: 160,
      h: 80,
      sizing: { w: "hug", h: "hug" },
    });
    const saved = await stored(page);
    await page.mouse.move(
      nudged.x + nudged.width / 2,
      nudged.y + nudged.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      nudged.x + nudged.width / 2 + 31 * z,
      nudged.y + nudged.height / 2 + 22 * z,
      { steps: 6 },
    );
    const preview = await node.boundingBox();
    expect((preview.x - nudged.x) / z).toBeCloseTo(31, 1);
    expect((preview.y - nudged.y) / z).toBeCloseTo(22, 1);
    expect(await stored(page)).toEqual(saved);
    await page.mouse.up();
    const committed = await node.boundingBox();
    expect(Math.abs(committed.x - preview.x) / z).toBeLessThan(0.1);
    expect(Math.abs(committed.y - preview.y) / z).toBeLessThan(0.1);
    await page.locator("#undo").click();
    expect(child(await stored(page))).toEqual(child(saved));
    await page.locator("#redo").click();
    const result = await stored(page);
    await page.reload();
    expect(child(await stored(page))).toEqual(child(result));
  });
}
test("End + Fill positioning preserves the mode and alignment uses the intrinsic box", async ({
  page,
}) => {
  const p = project(),
    n = child(p);
  n.x = 500;
  n.y = 80;
  n.sizing = { w: "fill", h: "hug" };
  n.constraints = { horizontal: "end" };
  delete n.responsive;
  await open(page, p);
  await page.locator('[data-node="copy"]').click();
  await page.locator("#viewport").focus();
  const node = page.locator('[data-node-id="copy"]'),
    before = await node.boundingBox(),
    z = await scale(page);
  await page.keyboard.press("ArrowRight");
  expect(((await node.boundingBox()).x - before.x) / z).toBeCloseTo(1, 1);
  expect(child(await stored(page)).sizing).toEqual(n.sizing);
  await page.locator('[data-align="left"]').click();
  const parent = await page.locator('[data-node-id="frame"]').boundingBox(),
    aligned = await node.boundingBox();
  expect((aligned.x - parent.x) / z).toBeCloseTo(2, 1);
  expect(child(await stored(page)).w).toBe(160);
  expect(child(await stored(page)).sizing).toEqual(n.sizing);
});
test("responsive icon strokes update in canvas and exported HTML including isolated instance overrides", async ({
  page,
}) => {
  const p = project(),
    f = p.boards[0].nodes[0];
  f.children = [
    {
      id: "icon",
      type: "icon",
      name: "Responsive icon",
      x: 40,
      y: 40,
      w: 40,
      h: 40,
      text: "",
      icon: "grid",
      style: { color: "#000000" },
      responsive: [
        { maxWidth: 600, changes: { style: { color: "$primary" } } },
      ],
    },
  ];
  p.themes = { alternate: { primary: "#FF0000" } };
  p.activeTheme = "alternate";
  p.components = [
    {
      id: "symbol",
      name: "Symbol",
      variants: [
        {
          id: "base",
          name: "Base",
          root: {
            id: "root",
            type: "component",
            x: 0,
            y: 0,
            w: 80,
            h: 80,
            text: "",
            style: {},
            children: [structuredClone(f.children[0])],
          },
        },
      ],
    },
  ];
  for (const [id, x, color] of [
    ["first", 140, null],
    ["second", 260, "#00AA00"],
  ]) {
    f.children.push({
      id,
      type: "instance",
      componentId: "symbol",
      variantId: "base",
      x,
      y: 40,
      w: 80,
      h: 80,
      text: "",
      style: {},
      ...(color ? { overrides: { icon: { style: { color } } } } : {}),
    });
  }
  await open(page, p);
  const icon = page.locator('[data-node-id="icon"] svg'),
    first = page.locator('[data-node-id="first"] svg'),
    second = page.locator('[data-node-id="second"] svg');
  await expect(icon).toHaveCSS("stroke", "rgb(0, 0, 0)");
  await page.locator("#preview-width").selectOption("600");
  await expect(icon).toHaveCSS("stroke", "rgb(255, 0, 0)");
  await expect(first).toHaveCSS("stroke", "rgb(255, 0, 0)");
  await expect(second).toHaveCSS("stroke", "rgb(0, 170, 0)");
  await page.locator("#preview-width").selectOption("800");
  await expect(icon).toHaveCSS("stroke", "rgb(0, 0, 0)");
  const html = standaloneHtml(p.boards[0], p);
  await page.setViewportSize({ width: 600, height: 800 });
  await page.setContent(html);
  await expect(icon).toHaveCSS("stroke", "rgb(255, 0, 0)");
  await expect(first).toHaveCSS("stroke", "rgb(255, 0, 0)");
  await expect(second).toHaveCSS("stroke", "rgb(0, 170, 0)");
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(icon).toHaveCSS("stroke", "rgb(0, 0, 0)");
});
