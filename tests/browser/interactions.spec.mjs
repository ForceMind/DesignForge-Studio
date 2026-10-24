import { standaloneHtml } from "../../src/core.mjs";
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
  await page.screenshot({ path: "test-results/m1-resize-inspector.png" });
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
  await page.locator("#breakpoint-scope").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/m1-breakpoint-editor.png" });
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
async function marquee(page, from, to, { shift = false, finish = true } = {}) {
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  if (finish) await page.mouse.up();
  if (shift) await page.keyboard.up("Shift");
}
test("marquee selects nested siblings, syncs tree/inspector and does not save a project edit", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page),
    a = await page.locator('[data-node-id="one"]').boundingBox(),
    b = await page.locator('[data-node-id="two"]').boundingBox();
  await marquee(
    page,
    { x: a.x - 8, y: a.y - 8 },
    { x: b.x + b.width + 8, y: b.y + b.height + 8 },
  );
  await expect(page.locator("#layer-list .layer-item.active")).toHaveCount(2);
  await expect(page.locator('[data-node="frame"]')).not.toHaveClass(/active/);
  await expect(page.locator(".selection-id")).toContainText("2 selected");
  expect(await stored(page)).toEqual(before);
  await page.screenshot({ path: "test-results/m1-marquee-selection.png" });
  await page.keyboard.press("Control+g");
  expect((await stored(page)).boards[0].nodes[0].children[0].type).toBe(
    "group",
  );
});
test("Shift marquee adds a layer, Escape restores selection and Space retains pan behavior", async ({
  page,
}) => {
  await open(page);
  await select(page, "one");
  const before = await stored(page),
    a = await page.locator('[data-node-id="one"]').boundingBox(),
    b = await page.locator('[data-node-id="two"]').boundingBox();
  await marquee(
    page,
    { x: b.x - 6, y: b.y - 6 },
    { x: b.x + b.width + 6, y: b.y + b.height + 6 },
    { shift: true },
  );
  await expect(page.locator("#layer-list .layer-item.active")).toHaveCount(2);
  await marquee(
    page,
    { x: a.x - 8, y: a.y - 8 },
    { x: a.x + a.width + 8, y: a.y + a.height + 8 },
    { finish: false },
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("#layer-list .layer-item.active")).toHaveCount(2);
  const position = await page.locator("#world").getAttribute("style");
  await page.keyboard.down("Space");
  await page.mouse.move(a.x - 10, a.y - 10);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 20, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  expect(await page.locator("#world").getAttribute("style")).not.toBe(position);
  expect(await stored(page)).toEqual(before);
});
test("marquee enclosing a container selects it once and excludes locked/hidden layers", async ({
  page,
}) => {
  const p = project();
  p.boards[0].nodes[0].children[1].locked = true;
  await open(page, p);
  const a = await page.locator('[data-node-id="one"]').boundingBox(),
    b = await page.locator('[data-node-id="two"]').boundingBox();
  await marquee(
    page,
    { x: a.x - 7, y: a.y - 7 },
    { x: b.x + b.width + 7, y: b.y + b.height + 7 },
  );
  await expect(page.locator("#layer-list .layer-item.active")).toHaveCount(1);
  await expect(page.locator('[data-node="one"]')).toHaveClass(/active/);
  const frame = await page.locator('[data-node-id="frame"]').boundingBox();
  await marquee(
    page,
    { x: frame.x - 8, y: frame.y - 8 },
    { x: frame.x + frame.width + 8, y: frame.y + frame.height + 8 },
  );
  await expect(page.locator("#layer-list .layer-item.active")).toHaveCount(1);
  await expect(page.locator('[data-node="frame"]')).toHaveClass(/active/);
});
test("resizing a stretched child in a narrow preview preserves its reference constraints and visual edge", async ({
  page,
}) => {
  const p = project(),
    frame = p.boards[0].nodes[0];
  frame.constraints = { horizontal: "stretch", referenceW: 800 };
  frame.children[0].w = 500;
  frame.children[0].constraints = { horizontal: "stretch", referenceW: 640 };
  await open(page, p);
  await page.locator("#preview-width").selectOption("390");
  await select(page, "one");
  const el = page.locator('[data-node-id="one"]'),
    before = await el.boundingBox();
  await dragHandle(page, "e", 25, 0);
  const after = await el.boundingBox();
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.width).toBeCloseTo(before.width + 25, 0);
  const updated = node(await stored(page));
  expect(updated.constraints).toEqual(
    p.boards[0].nodes[0].children[0].constraints,
  );
  expect(updated.x).toBe(40);
  expect(updated.w).toBeGreaterThan(500);
  expect((await stored(page)).boards[0].w).toBe(800);
});
test("project import clears preview and scope state even when imported IDs match", async ({
  page,
}) => {
  const p = project();
  p.boards[0].nodes[0].children[0].responsive = [
    { maxWidth: 500, changes: { w: 140 } },
  ];
  await open(page, p);
  await select(page, "one");
  await page.locator('[data-edit-breakpoint="500"]').click();
  await expect(page.locator("#preview-width")).toHaveValue("500");
  const next = structuredClone(p);
  next.title = "A different project with the same IDs";
  await page.locator("#upload-json").setInputFiles({
    name: "other.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(next)),
  });
  await expect(page.locator("#project-title")).toHaveText(next.title);
  await select(page, "one");
  await expect(page.locator("#preview-width")).toHaveValue("");
  await expect(page.locator("#breakpoint-scope")).toHaveValue("");
  await expect(page.locator('[data-prop="w"]')).toHaveValue("160");
});
test("locked ancestors block clearing breakpoints, adding a frame and double-click text editing", async ({
  page,
}) => {
  const p = project(),
    frame = p.boards[0].nodes[0];
  frame.locked = true;
  frame.responsive = [
    { maxWidth: 500, changes: { style: { fill: "$primarySoft" } } },
  ];
  Object.assign(frame.children[0], {
    type: "text",
    text: "Locked text",
    style: { fontSize: 16, color: "$ink" },
  });
  await open(page, p);
  await page.locator('[data-node="frame"]').click();
  const before = await stored(page);
  await page.locator('[data-action="clear-breakpoints"]').click();
  expect(await stored(page)).toEqual(before);
  await page.locator("#add-frame").click();
  expect(await stored(page)).toEqual(before);
  const dialogs = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss();
  });
  await page.locator('[data-node-id="one"]').dblclick();
  expect(dialogs).toEqual([]);
  expect(await stored(page)).toEqual(before);
});
test("native text-field undo does not undo an already committed design change", async ({
  page,
}) => {
  const p = project();
  Object.assign(p.boards[0].nodes[0].children[0], {
    type: "text",
    text: "Original label",
    style: { fontSize: 16, color: "$ink" },
  });
  await open(page, p);
  await select(page, "one");
  await dragHandle(page, "e", 20, 0);
  const before = await stored(page);
  const text = page.locator('[data-prop="text"]');
  await text.click();
  await text.press("Control+a");
  await page.keyboard.type("Pending text");
  await page.keyboard.press("Control+z");
  expect(await stored(page)).toEqual(before);
});

test("exported responsive component descendants are isolated by instance despite shared source IDs", async ({
  page,
}) => {
  const p = project(),
    [primary, secondary] = p.components[0].variants,
    sourceId = primary.root.children[0].id;
  primary.root.children[0].responsive = [
    { maxWidth: 600, changes: { style: { color: "#000000" } } },
  ];
  secondary.root.children[0].responsive = [
    { maxWidth: 600, changes: { style: { color: "#FFFFFF" } } },
  ];
  const instance = (id, variantId, x) => ({
    id,
    name: id,
    type: "instance",
    componentId: "action",
    variantId,
    x,
    y: 40,
    w: 150,
    h: 48,
    text: "",
    style: {},
  });
  p.boards[0].w = 390;
  p.boards[0].nodes = [
    instance("first", "primary", 20),
    instance("second", "secondary", 200),
  ];
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(standaloneHtml(p.boards[0], p));
  await expect(
    page.locator(`[data-node-id="first"] [data-source-id="${sourceId}"]`),
  ).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(
    page.locator(`[data-node-id="second"] [data-source-id="${sourceId}"]`),
  ).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("row-to-column breakpoint clears inherited flex growth on fixed-height children", async ({
  page,
}) => {
  const p = project(),
    frame = p.boards[0].nodes[0];
  frame.layout = { mode: "flex", direction: "row", padding: 20, gap: 12 };
  frame.children[0].sizing = { w: "fill", h: "fixed" };
  frame.responsive = [
    { maxWidth: 500, changes: { layout: { direction: "column" } } },
  ];
  await open(page, p);
  await page.locator("#preview-width").selectOption("390");
  const el = page.locator('[data-node-id="one"]');
  await expect(el).toHaveCSS("flex-grow", "0");
  await expect(el).toHaveCSS("height", "80px");
});
