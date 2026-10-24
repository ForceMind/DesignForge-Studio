import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixture = JSON.parse(
    fs.readFileSync(
      new URL("../../examples/Studio.project.json", import.meta.url),
    ),
  ),
  key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const leaf = (id, x, y, w = 160, h = 80) => ({
  id,
  name: id,
  type: "rect",
  x,
  y,
  w,
  h,
  text: "",
  style: { fill: "$primary", radius: 8 },
});
function project() {
  const p = structuredClone(fixture);
  p.boards = [
    {
      id: "work",
      name: "Interaction test",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "frame",
          name: "Nested frame",
          type: "frame",
          x: 40,
          y: 40,
          w: 640,
          h: 480,
          text: "",
          style: { fill: "$surfaceAlt", stroke: "$border", strokeWidth: 2 },
          layout: { mode: "absolute" },
          children: [leaf("one", 40, 40), leaf("two", 320, 240)],
        },
      ],
    },
  ];
  p.comments = [];
  return p;
}
async function open(page, p = project()) {
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "test.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator("#project-title")).toHaveText(p.title);
  await expect(page.locator('#board-list [data-board="work"]')).toBeVisible();
  await page.locator("#snap-toggle").uncheck();
}
async function select(page, id) {
  await page.locator(`[data-node="${id}"]`).click();
  await expect(page.locator("#selection-overlay")).toBeVisible();
}
async function dragHandle(page, handle, dx, dy, { finish = true } = {}) {
  const h = page.locator(`[data-resize-handle="${handle}"]`);
  const r = await h.boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + dx, r.y + r.height / 2 + dy, {
    steps: 5,
  });
  if (finish) await page.mouse.up();
}
const node = (p) => p.boards[0].nodes[0].children[0];
test("nested resize previews without saving, commits once, and survives undo/redo/reload", async ({
  page,
}) => {
  await open(page);
  await select(page, "one");
  const before = await stored(page),
    el = page.locator('[data-node-id="one"]'),
    r = await el.boundingBox();
  await dragHandle(page, "se", 45, 25, { finish: false });
  expect(await stored(page)).toEqual(before);
  const preview = await el.boundingBox();
  expect(preview.width).toBeGreaterThan(r.width + 40);
  await page.mouse.up();
  let p = await stored(page);
  expect(node(p).w).toBeGreaterThan(160);
  expect(node(p).h).toBeGreaterThan(80);
  expect(p.boards[0].nodes[0].children[1]).toEqual(
    before.boards[0].nodes[0].children[1],
  );
  await page.locator("#undo").click();
  expect(node(await stored(page))).toEqual(node(before));
  await page.locator("#redo").click();
  expect(node(await stored(page))).toEqual(node(p));
  await page.reload();
  await select(page, "one");
  expect(node(await stored(page))).toEqual(node(p));
});
test("Escape and pointer cancellation discard resize preview and history stays unchanged", async ({
  page,
}) => {
  await open(page);
  await select(page, "one");
  const before = await stored(page);
  await dragHandle(page, "se", 35, 20, { finish: false });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await stored(page)).toEqual(before);
  await expect(page.locator('[data-prop="w"]')).toHaveValue("160");
  await dragHandle(page, "se", 35, 20, { finish: false });
  await page.locator("#viewport").dispatchEvent("pointercancel");
  await page.mouse.up();
  expect(await stored(page)).toEqual(before);
});
test("northwest resize anchors the opposite edge; Shift corner preserves aspect ratio", async ({
  page,
}) => {
  await open(page);
  await select(page, "one");
  const el = page.locator('[data-node-id="one"]'),
    before = await el.boundingBox();
  await dragHandle(page, "nw", 20, 10);
  const after = await el.boundingBox();
  expect(after.x + after.width).toBeCloseTo(before.x + before.width, 0);
  expect(after.y + after.height).toBeCloseTo(before.y + before.height, 0);
  await page.locator("#undo").click();
  await page.keyboard.down("Shift");
  await dragHandle(page, "se", 40, 4);
  await page.keyboard.up("Shift");
  const p = await stored(page);
  expect(node(p).w / node(p).h).toBeCloseTo(2, 2);
});
test("Auto Layout resize converts only requested sizing axis and respects locked ancestors", async ({
  page,
}) => {
  const p = project(),
    frame = p.boards[0].nodes[0];
  frame.layout = { mode: "flex", direction: "column", padding: 20, gap: 12 };
  frame.children[0].sizing = { w: "fill", h: "fixed" };
  await open(page, p);
  await select(page, "one");
  await expect(page.locator('[data-resize-handle="nw"]')).toHaveCount(0);
  await dragHandle(page, "s", 0, 35);
  const n = node(await stored(page));
  expect(n.sizing.w).toBe("fill");
  expect(n.sizing.h).toBe("fixed");
  expect(n.h).toBeGreaterThan(80);
  await page.locator('[data-node="frame"]').click();
  await page.locator('[data-prop="locked"]').selectOption("true");
  await page.locator('[data-node="one"]').click();
  await expect(page.locator("[data-resize-handle]")).toHaveCount(0);
});
test("breakpoint editor scopes changes and field resets restore larger-width inheritance", async ({
  page,
}) => {
  const p = project(),
    frame = p.boards[0].nodes[0];
  frame.layout = { mode: "grid", columns: 3, gap: 24, padding: 16 };
  frame.responsive = [
    { maxWidth: 700, changes: { layout: { columns: 2, gap: 20 } } },
    { maxWidth: 500, changes: { layout: { columns: 1 } } },
  ];
  await open(page, p);
  await select(page, "frame");
  const before = await stored(page);
  await page.locator('[data-edit-breakpoint="500"]').click();
  await expect(page.locator("#preview-width")).toHaveValue("500");
  expect(await stored(page)).toEqual(before);
  await expect(page.locator('[data-prop="layout.gap"]')).toHaveValue("20");
  await page.locator('[data-prop="layout.gap"]').fill("8");
  await page.locator('[data-prop="layout.gap"]').press("Tab");
  let updated = await stored(page);
  expect(updated.boards[0].nodes[0].layout.gap).toBe(24);
  expect(
    updated.boards[0].nodes[0].responsive.find((r) => r.maxWidth === 500)
      .changes.layout.gap,
  ).toBe(8);
  await page.locator('[data-reset-override="layout.gap"]').click();
  await expect(page.locator('[data-prop="layout.gap"]')).toHaveValue("20");
  expect(
    (await stored(page)).boards[0].nodes[0].responsive.find(
      (r) => r.maxWidth === 500,
    ).changes.layout.columns,
  ).toBe(1);
});
test("add/rename/delete breakpoint and drag size at that scope preserve base geometry", async ({
  page,
}) => {
  await open(page);
  await select(page, "one");
  await page.locator("#breakpoint-new-width").fill("500");
  await page.locator('[data-action="add-breakpoint"]').click();
  await expect(page.locator("#breakpoint-scope")).toHaveValue("500");
  await dragHandle(page, "e", 25, 0);
  let p = await stored(page);
  expect(node(p).w).toBe(160);
  expect(node(p).x).toBe(40);
  expect(node(p).responsive[0].changes.w).toBeGreaterThan(160);
  await page.locator('[data-rename-breakpoint="500"]').fill("550");
  await page.locator('[data-rename-breakpoint="500"]').press("Tab");
  await expect(page.locator("#breakpoint-scope")).toHaveValue("550");
  await expect(page.locator("#preview-width")).toHaveValue("550");
  await page.locator('[data-delete-breakpoint="550"]').click();
  expect(node(await stored(page)).responsive).toHaveLength(0);
  await page.locator("#reset-preview").click();
  await expect(page.locator("#preview-width")).toHaveValue("");
});
test("responsive parent layout changes reflow children and clearing hidden/fill/stroke works in the browser", async ({
  page,
}) => {
  const p = project(),
    frame = p.boards[0].nodes[0];
  frame.hidden = true;
  frame.style.fill = "#FF0000";
  frame.responsive = [
    {
      maxWidth: 500,
      changes: {
        hidden: false,
        layout: { mode: "flex", direction: "column", gap: 10, padding: 20 },
        style: { fill: "", stroke: "none" },
      },
    },
  ];
  await open(page, p);
  await page.locator("#preview-width").selectOption("390");
  const el = page.locator('[data-node-id="frame"]');
  await expect(el).toBeVisible();
  await expect(el).toHaveCSS("display", "flex");
  await expect(el).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(el).toHaveCSS("border-top-width", "0px");
  await expect(page.locator('[data-node-id="one"]')).toHaveCSS(
    "position",
    "relative",
  );
  const r1 = await page.locator('[data-node-id="one"]').boundingBox(),
    r2 = await page.locator('[data-node-id="two"]').boundingBox();
  expect(r2.y).toBeGreaterThan(r1.y + r1.height);
});
