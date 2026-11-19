import { test, expect } from "@playwright/test";
import { newProject } from "../../src/core.mjs";
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
function project() {
  const p = newProject("Breakpoint ranges");
  p.boards = [
    {
      id: "work",
      name: "Adaptive panel",
      x: 0,
      y: 60,
      w: 1280,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "card",
          name: "Adaptive card",
          type: "frame",
          x: 24,
          y: 24,
          w: 1000,
          h: 360,
          text: "",
          style: { fill: "$primary", radius: 16 },
          responsive: [
            { maxWidth: 1024, changes: { w: 800 } },
            { maxWidth: 600, changes: { w: 500, style: { fill: "#117755" } } },
            { maxWidth: 390, changes: { w: 340, style: { fill: "#2266BB" } } },
          ],
          children: [],
        },
      ],
    },
  ];
  return p;
}
async function open(page, p = project()) {
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "ranges.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('[data-board="work"]')).toBeVisible();
  await page.locator('[data-node="card"]').click();
}
test("visual intervals switch edit scope and actual container width without writing project/history", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page);
  for (const [scope, width, color] of [
    ["390", 390, "rgb(34, 102, 187)"],
    ["600", 600, "rgb(17, 119, 85)"],
    ["1024", 1024, "rgb(92, 74, 207)"],
    ["", 1280, "rgb(92, 74, 207)"],
  ]) {
    await page.locator(`[data-range-scope="${scope}"]`).click();
    await expect(page.locator("#breakpoint-scope")).toHaveValue(scope);
    await expect(page.locator(`[data-range-scope="${scope}"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("#preview-width")).toHaveValue(String(width));
    await expect(page.locator('[data-node-id="card"]')).toHaveCSS(
      "background-color",
      color,
    );
    expect(await stored(page)).toEqual(before);
  }
  await expect(page.locator("#undo")).toBeDisabled();
});
test("numeric preview preserves explicit edit scope and rejects out-of-range values without changing geometry", async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-range-scope=""]').click();
  const before = await stored(page);
  const input = page.locator("#breakpoint-preview-value");
  await input.fill("500");
  await input.press("Tab");
  await expect(page.locator("#preview-width")).toHaveValue("500");
  await expect(page.locator("#breakpoint-scope")).toHaveValue("");
  await expect(page.locator('[data-range-scope="600"]')).toHaveClass(
    /is-preview/,
  );
  await expect(page.locator('[data-range-scope=""]').first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const width of ["279", "2401"]) {
    await input.fill(width);
    await input.press("Tab");
    await expect(input).toHaveValue("500");
    await expect(page.locator("#preview-width")).toHaveValue("500");
  }
  expect(await stored(page)).toEqual(before);
  await input.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/m1-breakpoint-overview.png",
    fullPage: true,
  });
});
test("editing from a range stays scoped; rename/delete/undo refresh intervals and restore inheritance", async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-range-scope="600"]').click();
  await page.locator('[data-prop="w"]').fill("450");
  await page.locator('[data-prop="w"]').press("Tab");
  let p = await stored(page),
    n = p.boards[0].nodes[0];
  expect(n.w).toBe(1000);
  expect(n.responsive.find((r) => r.maxWidth === 600).changes.w).toBe(450);
  await page.locator('[data-rename-breakpoint="600"]').fill("640");
  await page.locator('[data-rename-breakpoint="600"]').press("Tab");
  await expect(page.locator('[data-range-scope="640"]')).toHaveCount(1);
  await expect(page.locator('[data-range-scope="600"]')).toHaveCount(0);
  await page.locator('[data-delete-breakpoint="640"]').click();
  await expect(page.locator('[data-range-scope="640"]')).toHaveCount(0);
  await page.locator("#undo").click();
  await expect(page.locator('[data-range-scope="640"]')).toHaveCount(1);
  await page.locator('[data-range-scope="640"]').click();
  await page.locator('[data-reset-override="w"]').click();
  expect(
    (await stored(page)).boards[0].nodes[0].responsive.find(
      (r) => r.maxWidth === 640,
    ).changes.w,
  ).toBeUndefined();
  await expect(page.locator('[data-prop="w"]')).toHaveValue("800");
});
test("maximum-width breakpoint has no unreachable base interval; locked nodes remain previewable", async ({
  page,
}) => {
  const p = project(),
    n = p.boards[0].nodes[0];
  n.locked = true;
  n.responsive = [
    { maxWidth: 280, changes: { w: 250 } },
    { maxWidth: 2400, changes: { w: 800 } },
  ];
  await open(page, p);
  const before = await stored(page);
  await expect(page.locator('[data-range-scope=""]')).toHaveCount(0);
  await page.locator('[data-range-scope="280"]').click();
  await expect(page.locator("#preview-width")).toHaveValue("280");
  await expect(page.locator('[data-prop="w"]')).toHaveValue("250");
  expect(await stored(page)).toEqual(before);
});
