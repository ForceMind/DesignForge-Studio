import { test, expect } from "@playwright/test";
import fs from "node:fs";
const base = JSON.parse(
  fs.readFileSync(
    new URL("../../examples/Studio.project.json", import.meta.url),
  ),
);
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
function project() {
  const p = structuredClone(base);
  p.boards = [
    {
      id: "work",
      name: "Canvas acceptance",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "frame",
          name: "Free parent",
          type: "frame",
          x: 40,
          y: 40,
          w: 640,
          h: 480,
          text: "",
          style: { fill: "$surfaceAlt", stroke: "$border", strokeWidth: 2 },
          layout: { mode: "absolute" },
          children: [
            {
              id: "one",
              name: "First",
              type: "rect",
              x: 40,
              y: 40,
              w: 100,
              h: 80,
              text: "",
              style: { fill: "$primary", radius: 8 },
            },
            {
              id: "two",
              name: "Second",
              type: "rect",
              x: 300,
              y: 240,
              w: 160,
              h: 100,
              text: "",
              style: { fill: "$primary", radius: 8 },
            },
          ],
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
    name: "canvas.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('[data-board="work"]')).toBeVisible();
  await page.locator("#snap-toggle").uncheck();
}
async function both(page) {
  await page.locator('[data-node="one"]').click();
  await page.locator('[data-node="two"]').click({ modifiers: ["Shift"] });
}
async function resize(page, handle, dx, dy, finish = true) {
  const target = page.locator(`[data-resize-handle="${handle}"]`);
  await target.hover();
  const r = await target.boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + dx, r.y + r.height / 2 + dy, {
    steps: 6,
  });
  if (finish) await page.mouse.up();
}
const child = (p) => p.boards[0].nodes[0].children;
test("multi-layer resizing transforms boxes and gaps, previews atomically and survives undo/redo/reload", async ({
  page,
}) => {
  await open(page);
  await both(page);
  await expect(page.locator("#selection-overlay")).toContainText("2 层");
  const before = await stored(page),
    r = await page.locator("#selection-overlay").boundingBox();
  await resize(page, "se", r.width / 2, r.height / 2, false);
  expect(await stored(page)).toEqual(before);
  await page.mouse.up();
  let p = await stored(page);
  expect(child(p)[0].w).toBeCloseTo(150, 0);
  expect(child(p)[1].w).toBeCloseTo(240, 0);
  expect(child(p)[0].x).toBeCloseTo(40, 0);
  expect(child(p)[1].x).toBeCloseTo(430, 0);
  await page.screenshot({
    path: "test-results/m1-multiresize.png",
    fullPage: true,
  });
  await page.locator("#undo").click();
  expect(child(await stored(page))).toEqual(child(before));
  await page.locator("#redo").click();
  expect(child(await stored(page))).toEqual(child(p));
  await page.reload();
  expect(child(await stored(page))).toEqual(child(p));
});
test("multi resize cancels without history, and corner Shift/Alt keep ratio and center", async ({
  page,
}) => {
  await open(page);
  await both(page);
  const before = await stored(page),
    start = await page.locator("#selection-overlay").boundingBox();
  for (const method of ["Escape", "pointercancel"]) {
    await resize(page, "nw", -40, -30, false);
    if (method === "Escape") await page.keyboard.press("Escape");
    else
      await page.evaluate(() =>
        window.dispatchEvent(new PointerEvent("pointercancel")),
      );
    await page.mouse.up();
    expect(await stored(page)).toEqual(before);
  }
  await page.keyboard.down("Shift");
  await resize(page, "se", 80, 0);
  await page.keyboard.up("Shift");
  const ratio = await page.locator("#selection-overlay").boundingBox();
  expect(
    Math.abs(ratio.width / ratio.height - start.width / start.height),
  ).toBeLessThan(0.01);
  await page.locator("#undo").click();
  await page.keyboard.down("Alt");
  await resize(page, "se", 30, 20);
  await page.keyboard.up("Alt");
  const centered = await page.locator("#selection-overlay").boundingBox();
  expect(
    Math.abs(centered.x + centered.width / 2 - start.x - start.width / 2),
  ).toBeLessThan(1);
  expect(
    Math.abs(centered.y + centered.height / 2 - start.y - start.height / 2),
  ).toBeLessThan(1);
});
test("multi resize at narrow parent preserves constraints and untouched responsive metadata", async ({
  page,
}) => {
  const p = project(),
    f = p.boards[0].nodes[0];
  f.responsive = [{ maxWidth: 600, changes: { w: 500 } }];
  f.children[0].x = 200;
  f.children[0].type = "text";
  f.children[0].text = "Intrinsic text height";
  f.children[0].sizing = { w: "fixed", h: "hug" };
  f.children[0].constraints = { horizontal: "end" };
  f.children[1].x = 400;
  f.children[1].constraints = { horizontal: "end" };
  await open(page, p);
  await page.locator("#preview-width").selectOption("600");
  await both(page);
  const first = page.locator('[data-node-id="one"]'),
    before = await first.boundingBox();
  await resize(page, "e", 64, 0);
  const after = await first.boundingBox(),
    q = await stored(page);
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  expect(after.width).toBeGreaterThan(before.width);
  expect(child(q)[0].constraints).toEqual({ horizontal: "end" });
  expect(child(q)[0].h).toBe(80);
  expect(child(q)[0].sizing).toEqual({ w: "fixed", h: "hug" });
  expect(q.boards[0].nodes[0].responsive).toEqual(f.responsive);
});
test("actual alignment and constrained group/ungroup preserve browser positions", async ({
  page,
}) => {
  const p = project();
  child(p)[0].constraints = { horizontal: "end" };
  await open(page, p);
  await both(page);
  await page.locator('[data-align="left"]').click();
  const one = page.locator('[data-node-id="one"]'),
    two = page.locator('[data-node-id="two"]'),
    r1 = await one.boundingBox(),
    r2 = await two.boundingBox();
  expect(Math.abs(r1.x - r2.x)).toBeLessThan(1);
  await page.locator('[data-action="group"]').click();
  await expect(page.locator('[data-node="one"]')).toBeVisible();
  let a = await one.boundingBox(),
    b = await two.boundingBox();
  expect(Math.abs(a.x - r1.x)).toBeLessThan(1);
  expect(Math.abs(b.y - r2.y)).toBeLessThan(1);
  await page.locator('[data-action="ungroup"]').click();
  a = await one.boundingBox();
  b = await two.boundingBox();
  expect(Math.abs(a.x - r1.x)).toBeLessThan(1);
  expect(Math.abs(b.y - r2.y)).toBeLessThan(1);
});
test("locked, responsive-scope and Flow selections reject resize/nudge; locked instances cannot detach", async ({
  page,
}) => {
  for (const mode of ["locked", "flow", "scoped"]) {
    const p = project();
    if (mode === "locked") child(p)[0].locked = true;
    else if (mode === "flow")
      p.boards[0].nodes[0].layout = { mode: "flex", direction: "row" };
    else child(p)[0].responsive = [{ maxWidth: 900, changes: { w: 110 } }];
    await open(page, p);
    await both(page);
    await expect(page.locator("[data-resize-handle]")).toHaveCount(0);
    const before = await stored(page);
    if (mode !== "scoped") {
      await page.locator("#viewport").focus();
      await page.keyboard.press("ArrowRight");
      expect(await stored(page)).toEqual(before);
    }
  }
  const p = project(),
    c = p.components[0],
    v = c.variants[0];
  p.boards[0].nodes.push({
    id: "lockedInstance",
    name: "Locked instance",
    type: "instance",
    x: 50,
    y: 60,
    w: v.root.w,
    h: v.root.h,
    text: "",
    style: {},
    componentId: c.id,
    variantId: v.id,
    locked: true,
  });
  await open(page, p);
  await page.locator('[data-node="lockedInstance"]').click();
  const before = await stored(page);
  await page.locator('[data-action="detach"]').click();
  expect(await stored(page)).toEqual(before);
});

test("importing a project with reused IDs clears the previous tree and canvas selection", async ({
  page,
}) => {
  await open(page);
  await both(page);
  await expect(page.locator("#layer-list .active")).toHaveCount(2);
  const p = project();
  p.title = "Different design using same IDs";
  await page.locator("#upload-json").setInputFiles({
    name: "reused.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator("#layer-list .active")).toHaveCount(0);
  await expect(page.locator("#world .is-selected")).toHaveCount(0);
  await expect(page.locator("#selection-overlay")).toHaveCount(0);
});

test("small files with excessive instance projections and oversized imports preserve the current project", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page),
    p = project();
  const root = {
    id: "sourceRoot",
    name: "Source",
    type: "frame",
    x: 0,
    y: 0,
    w: 500,
    h: 500,
    text: "",
    style: {},
    layout: { mode: "absolute" },
    children: Array.from({ length: 100 }, (_, i) => ({
      id: "leaf" + i,
      name: "Leaf",
      type: "rect",
      x: i * 5,
      y: 0,
      w: 5,
      h: 5,
      text: "",
      style: { fill: "$primary" },
    })),
  };
  p.components = [
    {
      id: "resourceCard",
      name: "Resource card",
      variants: [{ id: "default", root }],
    },
  ];
  p.boards[0].nodes = Array.from({ length: 100 }, (_, i) => ({
    id: "instance" + i,
    name: "Instance",
    type: "instance",
    componentId: "resourceCard",
    variantId: "default",
    x: 0,
    y: 0,
    w: 500,
    h: 500,
    text: "",
    style: {},
  }));
  await page.locator("#upload-json").setInputFiles({
    name: "small-bomb.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator("#toast")).toContainText(/budget/i);
  expect(await stored(page)).toEqual(before);
  await page.locator("#upload-json").setInputFiles({
    name: "oversize.project.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1, 32),
  });
  await expect(page.locator("#toast")).toContainText("8 MB");
  expect(await stored(page)).toEqual(before);
});

test("numeric dimensions change rendered Fill/Hug axes to fixed while Auto Layout owns coordinates", async ({
  page,
}) => {
  const p = project(),
    f = p.boards[0].nodes[0],
    first = f.children[0];
  f.layout = { mode: "flex", direction: "row" };
  first.type = "text";
  first.text = "Intrinsic content";
  first.sizing = { w: "fill", h: "hug" };
  await open(page, p);
  await page.locator('[data-node="one"]').click();
  await expect(page.locator('[data-prop="x"]')).toBeDisabled();
  await expect(page.locator('[data-prop="y"]')).toBeDisabled();
  await page.locator('[data-prop="w"]').fill("120");
  await page.locator('[data-prop="w"]').press("Tab");
  expect(child(await stored(page))[0].sizing).toEqual({ w: "fixed", h: "hug" });
  await expect(page.locator('[data-node-id="one"]')).toHaveCSS(
    "width",
    "120px",
  );
  await page.locator('[data-prop="h"]').fill("64");
  await page.locator('[data-prop="h"]').press("Tab");
  expect(child(await stored(page))[0].sizing).toEqual({
    w: "fixed",
    h: "fixed",
  });
  await expect(page.locator('[data-node-id="one"]')).toHaveCSS(
    "height",
    "64px",
  );
  await page.locator("#undo").click();
  expect(child(await stored(page))[0].sizing.h).toBe("hug");
});
