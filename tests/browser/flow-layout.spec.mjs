import { test, expect } from "@playwright/test";
import { newProject, standaloneHtml } from "../../src/core.mjs";
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
function project(mode = "row") {
  const p = newProject("Auto Layout ordering");
  p.boards = [
    {
      id: "work",
      name: "Layout workshop",
      x: 0,
      y: 60,
      w: 800,
      h: 640,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "layout",
          name: "Auto Layout",
          type: "frame",
          x: 40,
          y: 40,
          w: mode === "wrap" ? 300 : 640,
          h: 480,
          text: "",
          style: {
            fill: "$surfaceAlt",
            stroke: "$border",
            strokeWidth: 2,
            radius: 16,
          },
          layout: {
            mode: mode === "grid" ? "grid" : "flex",
            direction: mode === "column" ? "column" : "row",
            wrap: mode === "wrap",
            columns: 2,
            gap: 12,
            padding: 24,
          },
          children: ["alpha", "beta", "gamma", "delta", "epsilon"].map(
            (id, i) => ({
              id,
              name: `Item ${i + 1}`,
              type: "button",
              text: ["Overview", "Activity", "Projects", "Library", "Settings"][
                i
              ],
              x: i * 13,
              y: i * 17,
              w: [88, 100, 112, 100, 88][i],
              h: 48,
              style: {
                fill: i === 0 ? "$primary" : "$surface",
                color: i === 0 ? "#FFFFFF" : "$ink",
                radius: 8,
                fontSize: 14,
              },
            }),
          ),
        },
      ],
    },
  ];
  return p;
}
const children = (p) => p.boards[0].nodes[0].children;
const ids = (p) => children(p).map((n) => n.id);
async function open(page, p = project()) {
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "flow.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('[data-board="work"]')).toBeVisible();
}
async function drag(
  page,
  source,
  anchor,
  { placement = "after", vertical = false, finish = true } = {},
) {
  const from = await page.locator(`[data-node-id="${source}"]`).boundingBox(),
    to = await page.locator(`[data-node-id="${anchor}"]`).boundingBox(),
    fraction = placement === "after" ? 0.8 : 0.2;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    to.x + to.width * (vertical ? 0.5 : fraction),
    to.y + to.height * (vertical ? fraction : 0.5),
    { steps: 8 },
  );
  if (finish) await page.mouse.up();
}
for (const mode of ["row", "column", "grid", "wrap"]) {
  test(`${mode} canvas reorder previews an insertion edge, commits once, and preserves node data through reload/export`, async ({
    page,
  }) => {
    await open(page, project(mode));
    await page.locator('[data-node="alpha"]').click();
    const before = await stored(page);
    await drag(page, "alpha", "epsilon", {
      vertical: mode === "column",
      finish: false,
    });
    await expect(page.locator("#flow-drop-marker")).toHaveAttribute(
      "data-anchor",
      "epsilon",
    );
    await expect(page.locator("#flow-drop-marker")).toHaveAttribute(
      "data-placement",
      "after",
    );
    expect(await stored(page)).toEqual(before);
    if (mode === "wrap")
      await page.screenshot({
        path: "test-results/m1-flow-reorder.png",
        fullPage: true,
      });
    await page.mouse.up();
    const after = await stored(page);
    expect(ids(after)).toEqual(["beta", "gamma", "delta", "epsilon", "alpha"]);
    expect(
      [...children(after)].sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([...children(before)].sort((a, b) => a.id.localeCompare(b.id)));
    await expect(page.locator("#flow-drop-marker")).toHaveCount(0);
    await expect(page.locator("#flow-reorder-status")).toHaveCount(0);
    await expect(page.locator('[data-node="alpha"]')).toHaveClass(/active/);
    await page.locator("#undo").click();
    expect(children(await stored(page))).toEqual(children(before));
    await page.locator("#redo").click();
    expect(children(await stored(page))).toEqual(children(after));
    await page.reload();
    expect(children(await stored(page))).toEqual(children(after));
    await page.setContent(standaloneHtml(after.boards[0], after));
    expect(
      await page
        .locator('[data-node-id="layout"] > [data-node-id]')
        .evaluateAll((els) => els.map((el) => el.dataset.nodeId)),
    ).toEqual(ids(after));
  });
}
test("Escape, pointercancel, blur, outside drop and unchanged drops leave storage and history untouched", async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-node="alpha"]').click();
  const before = await stored(page);
  for (const action of ["Escape", "pointercancel", "blur", "outside", "same"]) {
    await drag(page, "alpha", action === "same" ? "beta" : "epsilon", {
      placement: action === "same" ? "before" : "after",
      finish: false,
    });
    if (action === "Escape") await page.keyboard.press("Escape");
    else if (["pointercancel", "blur"].includes(action))
      await page.evaluate(
        (type) =>
          window.dispatchEvent(
            type === "pointercancel" ? new PointerEvent(type) : new Event(type),
          ),
        action,
      );
    else if (action === "outside") {
      const p = await page.locator('[data-node-id="layout"]').boundingBox();
      await page.mouse.move(p.x + p.width + 15, p.y + p.height / 2);
      await expect(page.locator("#flow-drop-marker")).toHaveCount(0);
    }
    await page.mouse.up();
    expect(await stored(page)).toEqual(before);
    await expect(page.locator("#flow-reorder-status")).toHaveCount(0);
    await expect(page.locator('[data-node-id="alpha"]')).not.toHaveAttribute(
      "style",
      /transform:/,
    );
  }
  await expect(page.locator("#undo")).toBeDisabled();
  await drag(page, "alpha", "epsilon");
  await page.locator("#undo").click();
  expect(children(await stored(page))).toEqual(children(before));
});
test("responsive Flow order is global while positions, breakpoints and hidden siblings stay intact", async ({
  page,
}) => {
  const p = project(),
    parent = p.boards[0].nodes[0];
  parent.layout = { mode: "absolute" };
  parent.responsive = [
    {
      maxWidth: 600,
      changes: {
        w: 480,
        layout: { mode: "flex", direction: "column", gap: 12, padding: 24 },
      },
    },
  ];
  parent.children[1].hidden = true;
  await open(page, p);
  await page.locator("#preview-width").selectOption("600");
  await page.locator('[data-node="alpha"]').click();
  await drag(page, "alpha", "epsilon", { vertical: true });
  const after = await stored(page);
  expect(ids(after)).toEqual(["beta", "gamma", "delta", "epsilon", "alpha"]);
  expect(after.boards[0].nodes[0].responsive).toEqual(parent.responsive);
  expect(children(after).find((n) => n.id === "beta").hidden).toBe(true);
  for (const n of children(after))
    expect(n).toEqual(parent.children.find((old) => old.id === n.id));
  await page.locator("#preview-width").selectOption("");
  await expect(page.locator('[data-node-id="layout"]')).toHaveCSS(
    "display",
    "block",
  );
  expect(ids(await stored(page))).toEqual(ids(after));
});
test("keyboard and Inspector ordering agree, skip boundary no-ops, and ignore typing", async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-node="alpha"]').click();
  await expect(page.locator('[data-action="flow-previous"]')).toBeDisabled();
  await page.locator("#viewport").focus();
  const before = await stored(page);
  await page.keyboard.press("Alt+ArrowLeft");
  expect(await stored(page)).toEqual(before);
  await page.keyboard.press("Alt+ArrowRight");
  expect(ids(await stored(page))).toEqual([
    "beta",
    "alpha",
    "gamma",
    "delta",
    "epsilon",
  ]);
  await page.locator('[data-action="flow-previous"]').click();
  expect(ids(await stored(page))).toEqual(ids(before));
  await page.locator('[data-action="flow-next"]').click();
  expect(ids(await stored(page))[1]).toBe("alpha");
  const after = await stored(page);
  await page.locator('[data-prop="name"]').focus();
  await page.keyboard.press("Alt+ArrowRight");
  expect(await stored(page)).toEqual(after);
  await page.locator("#undo").click();
  expect(ids(await stored(page))).toEqual(ids(before));
});
for (const state of ["locked", "ancestor-locked", "multi"]) {
  test(`${state} selection does not reorder or expose a drop target`, async ({
    page,
  }) => {
    const p = project();
    if (state === "locked") children(p)[0].locked = true;
    if (state === "ancestor-locked") p.boards[0].nodes[0].locked = true;
    await open(page, p);
    await page.locator('[data-node="alpha"]').click();
    if (state === "multi")
      await page.locator('[data-node="gamma"]').click({ modifiers: ["Shift"] });
    const before = await stored(page);
    await drag(page, "alpha", "epsilon", { finish: false });
    await expect(page.locator("#flow-drop-marker")).toHaveCount(0);
    await page.mouse.up();
    expect(await stored(page)).toEqual(before);
  });
}
test("linked component instances reorder as whole nodes without detaching or editing their projections", async ({
  page,
}) => {
  const p = project();
  p.components = [
    {
      id: "tile",
      name: "Tile",
      variants: [
        {
          id: "base",
          name: "Base",
          root: {
            id: "root",
            type: "component",
            x: 0,
            y: 0,
            w: 88,
            h: 48,
            text: "",
            style: { fill: "$primary" },
            children: [
              {
                id: "label",
                type: "text",
                x: 4,
                y: 4,
                w: 80,
                h: 40,
                text: "Instance",
                style: { color: "#FFFFFF" },
              },
            ],
          },
        },
      ],
    },
  ];
  children(p)[0] = {
    id: "alpha",
    name: "Linked tile",
    type: "instance",
    componentId: "tile",
    variantId: "base",
    x: 0,
    y: 0,
    w: 88,
    h: 48,
    text: "",
    style: {},
  };
  await open(page, p);
  await page.locator('[data-node="alpha"]').click();
  await drag(page, "alpha", "epsilon");
  const after = await stored(page);
  expect(children(after).at(-1)).toEqual(children(p)[0]);
  expect(after.components).toEqual(p.components);
  await expect(
    page.locator('[data-node-id="alpha"] [data-source-id="label"]'),
  ).toContainText("Instance");
});
