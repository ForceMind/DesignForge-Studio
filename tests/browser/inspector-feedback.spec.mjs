import { test, expect } from "@playwright/test";
import { newProject, contrastRatio, validateProject } from "../../src/core.mjs";
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
function project() {
  const p = newProject("Inspector measurements");
  p.boards = [
    {
      id: "work",
      name: "Responsive typography",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "panel",
          name: "Responsive panel",
          type: "frame",
          x: 40,
          y: 40,
          w: 720,
          h: 440,
          text: "",
          style: { fill: "$surfaceAlt", radius: 16 },
          constraints: { horizontal: "stretch" },
          layout: { mode: "flex", direction: "column", gap: 16, padding: 24 },
          responsive: [{ maxWidth: 600, changes: { layout: { padding: 16 } } }],
          children: [
            {
              id: "label",
              name: "Fill and Hug heading",
              type: "text",
              x: 0,
              y: 0,
              w: 200,
              h: 50,
              text: "Design tools should explain the difference between saved reference sizes and the browser's actual responsive layout. ".repeat(
                2,
              ),
              style: { fontSize: 20, lineHeight: 1.5, color: "$ink" },
              sizing: { w: "fill", h: "hug" },
              responsive: [
                { maxWidth: 600, changes: { style: { fontSize: 16 } } },
              ],
            },
          ],
        },
      ],
    },
  ];
  return p;
}
async function open(page) {
  expect(validateProject(project())).toEqual([]);
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "measure.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project())),
  });
  await expect(page.locator('[data-board="work"]')).toBeVisible();
  await page.locator('[data-node="label"]').click();
}
async function measurement(page) {
  return page.locator('[data-node-id="label"]').evaluate((el) => {
    const r = el.getBoundingClientRect(),
      scale = new DOMMatrix(
        getComputedStyle(document.getElementById("world")).transform,
      ).a;
    return { width: r.width / scale, height: r.height / scale };
  });
}
async function assertMeasured(page) {
  const box = await measurement(page),
    readout = page.locator("[data-measured-size]");
  await expect
    .poll(async () => Number(await readout.getAttribute("data-width")))
    .toBeCloseTo(box.width, 1);
  await expect
    .poll(async () => Number(await readout.getAttribute("data-height")))
    .toBeCloseTo(box.height, 1);
  return box;
}
test("inspector distinguishes reference dimensions from actual Fill/Hug across preview, zoom and numeric resize", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page),
    initial = await assertMeasured(page);
  expect(initial.width).toBeCloseTo(672, 1);
  expect(initial.height).toBeGreaterThan(50);
  await expect(page.locator('[data-prop="w"]')).toHaveValue("200");
  await expect(page.locator(".layout-measurement")).toContainText(
    "宽 Fill · 高 Hug",
  );
  await page.locator("#preview-width").selectOption("600");
  const narrow = await assertMeasured(page);
  expect(narrow.width).toBeLessThan(initial.width);
  await page.locator("#zoom-in").click();
  expect((await assertMeasured(page)).width).toBeCloseTo(narrow.width, 1);
  expect(await stored(page)).toEqual(before);
  await expect(page.locator("#undo")).toBeDisabled();
  await expect(page.locator("#toast")).toBeHidden();
  await page.screenshot({ path: "test-results/m1-inspector-measurements.png" });
  await page.locator('[data-prop="w"]').fill("300");
  await page.locator('[data-prop="w"]').press("Tab");
  expect((await assertMeasured(page)).width).toBeCloseTo(300, 1);
  const after = await stored(page);
  expect(after.boards[0].nodes[0].children[0].sizing).toEqual({
    w: "fixed",
    h: "hug",
  });
  await page.locator("#undo").click();
  expect((await assertMeasured(page)).width).toBeCloseTo(narrow.width, 1);
  expect((await stored(page)).boards).toEqual(before.boards);
});
test("browser-driven layout changes refresh measured sizes without creating project writes", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page),
    initial = await assertMeasured(page);
  // Simulate an asynchronous reflow, such as a font becoming available after render.
  await page.locator('[data-node-id="panel"]').evaluate((el) => {
    el.style.width = "480px";
  });
  const smaller = await assertMeasured(page);
  expect(smaller.width).toBeLessThan(initial.width);
  expect(smaller.height).toBeGreaterThan(initial.height);
  expect(await stored(page)).toEqual(before);
  await expect(page.locator("#undo")).toBeDisabled();
  await page.locator('[data-prop="hidden"]').selectOption("true");
  await expect(page.locator("[data-measured-size]")).toHaveText(
    "当前图层未显示",
  );
  await page.locator("#undo").click();
  await assertMeasured(page);
});
for (const theme of ["light", "dark"]) {
  test(`${theme} inspector labels and canvas help retain readable computed contrast`, async ({
    page,
  }) => {
    await open(page);
    if ((await page.locator("html").getAttribute("data-theme")) !== theme)
      await page.locator("#theme-toggle").click();
    const results = await page.evaluate(() => {
      const selectors = [
        ".inspector-title",
        ".selection-id",
        ".fieldcol label",
        ".singlefield label",
        ".layout-measurement p",
        ".layout-measurement output",
        ".property-help",
        ".canvas-help",
        ".kbd",
      ];
      const hex = (value) => {
        const rgb = value
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
        return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
      };
      return selectors.map((selector) => {
        const el = document.querySelector(selector);
        if (!el) throw Error(`Missing visible chrome target: ${selector}`);
        let parent = el,
          background;
        while (parent) {
          const color = getComputedStyle(parent).backgroundColor;
          if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
            background = color;
            break;
          }
          parent = parent.parentElement;
        }
        return {
          selector,
          foreground: hex(getComputedStyle(el).color),
          background: hex(background),
        };
      });
    });
    for (const result of results)
      expect(
        contrastRatio(result.foreground, result.background),
        JSON.stringify(result),
      ).toBeGreaterThanOrEqual(4.5);
    expect((await stored(page)).boards).toEqual(project().boards);
  });
}
