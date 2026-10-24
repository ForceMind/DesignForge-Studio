import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixture = JSON.parse(
  fs.readFileSync(
    new URL("../../examples/Studio.project.json", import.meta.url),
  ),
);
const key = "designforge.project.v1";
function project(guides = []) {
  const p = structuredClone(fixture);
  p.boards = [
    {
      id: "work",
      name: "Guide workspace",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      guides,
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
          children: [
            {
              id: "one",
              name: "Card",
              type: "rect",
              x: 40,
              y: 40,
              w: 160,
              h: 80,
              text: "",
              style: { fill: "$primary", radius: 8 },
            },
            {
              id: "two",
              name: "Sibling",
              type: "rect",
              x: 320,
              y: 240,
              w: 160,
              h: 80,
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
    name: "guides.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('#board-list [data-board="work"]')).toBeVisible();
  await expect(page.locator('[data-ruler-axis="x"]')).toBeVisible();
}
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
async function geometry(page) {
  const r = await page
    .locator('[data-artboard="work"] .df-board')
    .boundingBox();
  return { ...r, z: r.width / 800 };
}
async function create(page, axis, position, { finish = true } = {}) {
  const r = await geometry(page),
    v = await page.locator("#viewport").boundingBox();
  const from =
    axis === "x"
      ? { x: r.x + position * r.z, y: v.y + 10 }
      : { x: v.x + 10, y: r.y + position * r.z };
  const to =
    axis === "x"
      ? { x: from.x, y: r.y + 160 * r.z }
      : { x: r.x + 260 * r.z, y: from.y };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  if (finish) await page.mouse.up();
}
async function dragGuide(page, id, to, { finish = true } = {}) {
  const p = await stored(page),
    g = p.boards[0].guides.find((g) => g.id === id),
    r = await geometry(page);
  const from =
    g.axis === "x"
      ? { x: r.x + g.position * r.z, y: r.y + 170 * r.z }
      : { x: r.x + 280 * r.z, y: r.y + g.position * r.z };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  if (finish) await page.mouse.up();
}
test("rulers create both axes transactionally, undo/redo and persist without touching nodes", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page);
  const contentWidth = await page
    .locator('[data-artboard="work"] .df-board')
    .evaluate(
      (el) =>
        el.getBoundingClientRect().width /
        new DOMMatrix(
          getComputedStyle(document.getElementById("world")).transform,
        ).a,
    );
  expect(contentWidth).toBeCloseTo(800, 2);
  await create(page, "x", 303, { finish: false });
  expect(await stored(page)).toEqual(before);
  await expect(page.locator(".design-guide.x")).toBeVisible();
  await page.mouse.up();
  let p = await stored(page);
  expect(p.boards[0].guides[0]).toMatchObject({ axis: "x", position: 303 });
  await page.locator("#undo").click();
  expect((await stored(page)).boards[0].guides).toEqual([]);
  await page.locator("#redo").click();
  await create(page, "y", 210);
  p = await stored(page);
  expect(p.boards[0].guides.map((g) => [g.axis, g.position])).toEqual([
    ["x", 303],
    ["y", 210],
  ]);
  expect(p.boards[0].nodes).toEqual(before.boards[0].nodes);
  await page.screenshot({
    path: "test-results/m1-guides-light.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("[data-design-guide]")).toHaveCount(2);
  expect((await stored(page)).boards[0].guides).toEqual(p.boards[0].guides);
});
test("guide drag previews, Escape/pointercancel/blur roll back, outside drop deletes with one undo", async ({
  page,
}) => {
  await open(page, project([{ id: "vertical", axis: "x", position: 303 }]));
  const before = await stored(page),
    r = await geometry(page);
  for (const cancel of ["Escape", "pointercancel", "blur"]) {
    await dragGuide(
      page,
      "vertical",
      { x: r.x + 360 * r.z, y: r.y + 180 * r.z },
      { finish: false },
    );
    expect(await stored(page)).toEqual(before);
    if (cancel === "Escape") await page.keyboard.press("Escape");
    else
      await page.evaluate(
        (type) =>
          window.dispatchEvent(
            type === "pointercancel" ? new PointerEvent(type) : new Event(type),
          ),
        cancel,
      );
    await page.mouse.up();
    expect(await stored(page)).toEqual(before);
  }
  await dragGuide(page, "vertical", { x: r.x + 370 * r.z, y: r.y + 180 * r.z });
  expect((await stored(page)).boards[0].guides[0].position).toBe(370);
  await page.locator("#undo").click();
  expect((await stored(page)).boards[0].guides).toEqual(
    before.boards[0].guides,
  );
  const v = await page.locator("#viewport").boundingBox();
  await dragGuide(page, "vertical", { x: v.x + 60, y: v.y + 12 });
  expect((await stored(page)).boards[0].guides).toEqual([]);
  await page.locator("#undo").click();
  expect((await stored(page)).boards[0].guides).toEqual(
    before.boards[0].guides,
  );
});
test("numeric controls add/edit/hide/lock and keyboard honor guide state", async ({
  page,
}) => {
  await open(page);
  await page.locator("[data-guide-inspector]").click();
  await page.locator("#guide-position").fill("180");
  await page.locator('[data-guide-action="add"]').click();
  let g = (await stored(page)).boards[0].guides[0];
  await page.locator(`[data-guide-position="${g.id}"]`).fill("240");
  await page.locator(`[data-guide-position="${g.id}"]`).press("Tab");
  expect((await stored(page)).boards[0].guides[0].position).toBe(240);
  await page
    .locator(`[data-guide-action="hidden"][data-guide="${g.id}"]`)
    .click();
  await expect(page.locator("[data-design-guide]")).toHaveCount(0);
  await page
    .locator(`[data-guide-action="hidden"][data-guide="${g.id}"]`)
    .click();
  await page
    .locator(`[data-guide-action="locked"][data-guide="${g.id}"]`)
    .click();
  await expect(page.locator(`[data-guide-position="${g.id}"]`)).toBeDisabled();
  await expect(
    page.locator(`[data-guide-action="remove"][data-guide="${g.id}"]`),
  ).toBeDisabled();
  const before = await stored(page),
    r = await geometry(page);
  await dragGuide(page, g.id, { x: r.x + 350 * r.z, y: r.y + 180 * r.z });
  await page.keyboard.press("Delete");
  expect(await stored(page)).toEqual(before);
  await page
    .locator(`[data-guide-action="locked"][data-guide="${g.id}"]`)
    .click();
  await page
    .locator(`[data-design-guide="${g.id}"]`)
    .click({ position: { x: 4, y: 170 * r.z } });
  await page.keyboard.press("Shift+ArrowRight");
  expect((await stored(page)).boards[0].guides[0].position).toBe(250);
  await page.locator("#theme-toggle").click();
  await page.screenshot({
    path: "test-results/m1-guides-dark.png",
    fullPage: true,
  });
  await page.locator("#viewport").focus();
  await page.keyboard.press("Delete");
  expect((await stored(page)).boards[0].guides).toEqual([]);
});
for (const mode of ["visible", "hidden", "rulers-off", "alt"])
  test(`nested border coordinates snap to guide; ${mode}`, async ({ page }) => {
    await open(
      page,
      project([
        {
          id: "target",
          axis: "x",
          position: 303,
          hidden: mode === "hidden",
          locked: true,
        },
      ]),
    );
    if (mode === "rulers-off") await page.locator("#rulers-toggle").click();
    const r = await geometry(page),
      el = page.locator('[data-node-id="one"]');
    await page.locator('[data-node="one"]').click();
    const start = await el.boundingBox();
    const pointer = {
      x: start.x + start.width / 2,
      y: start.y + start.height / 2,
    };
    if (mode === "alt") await page.keyboard.down("Alt");
    await page.mouse.move(pointer.x, pointer.y);
    await page.mouse.down();
    const dx = r.x + 305 * r.z - start.x;
    await page.mouse.move(pointer.x + dx, pointer.y + 25 * r.z, { steps: 8 });
    const preview = await el.boundingBox();
    if (mode === "visible")
      expect(Math.abs(preview.x - (r.x + 303 * r.z))).toBeLessThan(0.8);
    await page.mouse.up();
    if (mode === "alt") await page.keyboard.up("Alt");
    const after = await el.boundingBox(),
      p = await stored(page);
    if (mode === "visible") {
      expect(Math.abs(after.x - (r.x + 303 * r.z))).toBeLessThan(0.8);
      expect(p.boards[0].nodes[0].children[0].x).toBe(261);
    } else expect(Math.abs(after.x - (r.x + 303 * r.z))).toBeGreaterThan(1);
    expect(p.boards[0].nodes[0].children[1]).toEqual(
      project().boards[0].nodes[0].children[1],
    );
  });
test("ruler origin follows zoom/pan and constrained drag keeps actual right margins at narrow width", async ({
  page,
}) => {
  const p = project([{ id: "target", axis: "x", position: 120 }]);
  p.boards[0].nodes[0].w = 400;
  p.boards[0].nodes[0].responsive = [{ maxWidth: 600, changes: { w: 300 } }];
  p.boards[0].nodes[0].children[0].constraints = { horizontal: "end" };
  await open(page, p);
  await page.locator("#preview-width").selectOption("600");
  await page.locator('[data-node="one"]').click();
  await page.locator("#snap-toggle").uncheck();
  const el = page.locator('[data-node-id="one"]'),
    start = await el.boundingBox();
  const b = await page
      .locator('[data-artboard="work"] .df-board')
      .boundingBox(),
    z = b.width / 600;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    start.x + start.width / 2 + 25 * z,
    start.y + start.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  const end = await el.boundingBox();
  expect(Math.abs(end.x - start.x - 25 * z)).toBeLessThan(1);
  expect((await stored(page)).boards[0].nodes[0].children[0]).toMatchObject({
    x: 65,
    w: 160,
    constraints: { horizontal: "end" },
  });
  await page.locator("#zoom-in").click();
  const v = await page.locator("#viewport").boundingBox();
  await page.mouse.move(v.x + 400, v.y + 300);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(v.x + 440, v.y + 320, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  const rect = await page
      .locator('[data-artboard="work"] .df-board')
      .boundingBox(),
    scale = rect.width / 600;
  const g = await page.locator('[data-design-guide="target"]').boundingBox();
  expect(Math.abs(g.x + 4 - (rect.x + 120 * scale))).toBeLessThan(1);
  await page.locator("#viewport").focus();
  await page.keyboard.press("Shift+R");
  await expect(page.locator("#guide-overlay")).toHaveCount(0);
  await page.keyboard.press("Shift+R");
  await expect(page.locator("[data-ruler-axis]")).toHaveCount(2);
});

test("equal-gap distribution uses actual siblings, preserves anchors and rejects flow or locked selections", async ({
  page,
}) => {
  const p = project(),
    frame = p.boards[0].nodes[0];
  frame.children[0].w = 80;
  frame.children[1].x = 200;
  frame.children[1].y = 120;
  frame.children.push({
    ...structuredClone(frame.children[0]),
    id: "three",
    name: "Third card",
    x: 420,
    y: 320,
    w: 120,
  });
  await open(page, p);
  const selectAll = async () => {
    await page.locator('[data-node="one"]').click();
    await page.locator('[data-node="two"]').click({ modifiers: ["Shift"] });
    await page.locator('[data-node="three"]').click({ modifiers: ["Shift"] });
  };
  await selectAll();
  await page.locator('[data-distribute="x"]').click();
  let children = (await stored(page)).boards[0].nodes[0].children;
  expect(children.map((n) => n.x)).toEqual([40, 190, 420]);
  expect(children.map((n) => n.w)).toEqual([80, 160, 120]);
  const rects = await page
    .locator('[data-node-id="frame"] > [data-node-id]')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, right: r.right };
      }),
    );
  expect(
    Math.abs(rects[1].x - rects[0].right - (rects[2].x - rects[1].right)),
  ).toBeLessThan(0.1);
  await page.locator('[data-distribute="y"]').click();
  expect(
    (await stored(page)).boards[0].nodes[0].children.map((n) => n.y),
  ).toEqual([40, 180, 320]);
  await page.locator("#undo").click();
  expect(
    (await stored(page)).boards[0].nodes[0].children.map((n) => n.y),
  ).toEqual([40, 120, 320]);
  await page.screenshot({
    path: "test-results/m1-distribution.png",
    fullPage: true,
  });
  for (const mode of ["locked", "flow"]) {
    const q = structuredClone(p);
    if (mode === "locked") q.boards[0].nodes[0].children[1].locked = true;
    else q.boards[0].nodes[0].layout = { mode: "flex", direction: "row" };
    await page.locator("#upload-json").setInputFiles({
      name: "guard.project.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(q)),
    });
    await selectAll();
    const before = await stored(page);
    await page.locator('[data-distribute="x"]').click();
    expect(await stored(page)).toEqual(before);
  }
});
