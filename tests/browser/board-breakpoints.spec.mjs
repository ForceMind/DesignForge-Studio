import { test, expect } from "@playwright/test";
import { newProject } from "../../src/core.mjs";
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
function project() {
  const p = newProject("Responsive workspace");
  p.components = [
    {
      id: "card",
      name: "Card",
      variants: [
        {
          id: "base",
          name: "Base",
          root: {
            id: "sourceRoot",
            type: "component",
            name: "Source root",
            x: 0,
            y: 0,
            w: 160,
            h: 100,
            text: "",
            style: { fill: "$surface" },
            responsive: [
              { maxWidth: 900, changes: { style: { fill: "#E0ECFF" } } },
            ],
            children: [
              {
                id: "sourceLabel",
                name: "Source label",
                type: "text",
                x: 10,
                y: 20,
                w: 140,
                h: 50,
                text: "Reusable card",
                style: { fontSize: 16, color: "$ink" },
                responsive: [
                  { maxWidth: 600, changes: { style: { color: "#FF0000" } } },
                ],
              },
            ],
          },
        },
      ],
    },
  ];
  const instance = (id, x) => ({
    id,
    name: id,
    type: "instance",
    componentId: "card",
    variantId: "base",
    x,
    y: 200,
    w: 160,
    h: 100,
    text: "",
    style: {},
  });
  p.boards = [
    {
      id: "work",
      name: "Page breakpoint map",
      x: 0,
      y: 60,
      w: 1000,
      h: 650,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "parent",
          name: "Responsive parent",
          type: "frame",
          x: 20,
          y: 20,
          w: 920,
          h: 570,
          text: "",
          style: { fill: "$surfaceAlt", radius: 14 },
          responsive: [{ maxWidth: 600, changes: { w: 540 } }],
          children: [
            {
              id: "child",
              name: "Nested status",
              type: "text",
              x: 20,
              y: 20,
              w: 240,
              h: 50,
              text: "Responsive status",
              style: { fontSize: 24, color: "$ink" },
              responsive: [
                { maxWidth: 390, changes: { hidden: true } },
                { maxWidth: 600, changes: { style: { color: "#006644" } } },
              ],
            },
            instance("first", 20),
            instance("second", 220),
          ],
        },
      ],
    },
  ];
  return p;
}
async function open(page, p = project()) {
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "board-map.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('[data-board="work"]')).toBeVisible();
  await page.locator("#board-breakpoint-overview").click();
  await expect(page.locator("[data-board-breakpoint-panel]")).toHaveAttribute(
    "open",
    "",
  );
}
test("page map previews every applicable nested/instance rule without project or history writes and exports source evidence", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page);
  await expect(page.locator("[data-board-breakpoint]")).toHaveCount(3);
  await page.locator('[data-board-bp-preview="600"]').click();
  await expect(page.locator("#preview-width")).toHaveValue("600");
  await expect(page.locator('[data-node-id="child"]')).toHaveCSS(
    "color",
    "rgb(0, 102, 68)",
  );
  await expect(
    page.locator('[data-node-id="first"] [data-source-id="sourceLabel"]'),
  ).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(page.locator('[data-node-id="first"]')).toHaveCSS(
    "background-color",
    "rgb(224, 236, 255)",
  );
  expect(await stored(page)).toEqual(before);
  await expect(page.locator("#undo")).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.locator("[data-board-bp-export]").click();
  const file = await download;
  const fs = await import("node:fs/promises");
  const report = JSON.parse(await fs.readFile(await file.path(), "utf8"));
  expect(report.boardId).toBe("work");
  expect(
    report.scopes
      .find((s) => s.maxWidth === 600)
      .entries.some(
        (e) => e.ownerId === "first" && e.sourceId === "sourceLabel",
      ),
  ).toBe(true);
  await page.locator("[data-board-breakpoint-panel]").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/m1-board-breakpoints.png",
    fullPage: true,
  });
});
test("editable sources lead to the correct scoped node and preserve all other rules", async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-board-bp-open="600"]').click();
  await page.locator('[data-board-bp-node="child"]').click();
  await expect(page.locator("#breakpoint-scope")).toHaveValue("600");
  await page.locator('[data-prop="style.fontSize"]').fill("28");
  await page.locator('[data-prop="style.fontSize"]').press("Tab");
  const p = await stored(page),
    child = p.boards[0].nodes[0].children[0];
  expect(child.style.fontSize).toBe(24);
  expect(
    child.responsive.find((r) => r.maxWidth === 600).changes.style,
  ).toMatchObject({ color: "#006644", fontSize: 28 });
  expect(child.responsive.find((r) => r.maxWidth === 390)).toEqual({
    maxWidth: 390,
    changes: { hidden: true },
  });
  await page.locator("#undo").click();
  expect(
    (await stored(page)).boards[0].nodes[0].children[0].responsive.find(
      (r) => r.maxWidth === 600,
    ).changes.style.fontSize,
  ).toBeUndefined();
});
test("component source rows select the whole instance and never create a source-ID canvas node", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page);
  await page.locator('[data-board-bp-open="600"]').click();
  await page
    .locator('[data-board-bp-node="first"][data-board-bp-source="sourceLabel"]')
    .click();
  await expect(page.locator(".selection-id").first()).toContainText("#first");
  await expect(page.locator('[data-node-id="sourceLabel"]')).toHaveCount(0);
  await expect(
    page.locator('[data-component-source="sourceLabel"]').first(),
  ).toBeAttached();
  expect(await stored(page)).toEqual(before);
});
test("search and pagination find distant definitions while keeping the project untouched", async ({
  page,
}) => {
  const p = project();
  p.boards[0].nodes[0].children.push(
    ...Array.from({ length: 17 }, (_, i) => ({
      id: "extra" + i,
      name: "Extra " + i,
      type: "rect",
      x: 20 + i * 5,
      y: 400,
      w: 20,
      h: 20,
      text: "",
      style: {},
      responsive: [{ maxWidth: 1000 + i * 10, changes: { hidden: true } }],
    })),
  );
  await open(page, p);
  const before = await stored(page);
  await expect(page.locator("[data-board-breakpoint]")).toHaveCount(6);
  await page.locator('[data-board-bp-page="1"]').click();
  await expect(page.locator('[data-board-bp-page="0"]')).toBeEnabled();
  await page.locator("#board-breakpoint-filter").fill("extra16");
  await page.locator("#board-breakpoint-filter").press("Enter");
  await expect(page.locator("[data-board-breakpoint]")).toHaveCount(1);
  await expect(page.locator('[data-board-bp-node="extra16"]')).toBeVisible();
  expect(await stored(page)).toEqual(before);
});
test("instance overrides are represented in the map using the rendered source fields", async ({
  page,
}) => {
  const p = project();
  p.boards[0].nodes[0].children[1].overrides = {
    sourceLabel: { style: { color: "#00AA00" } },
  };
  await open(page, p);
  await page.locator('[data-board-bp-open="600"]').click();
  const row = page
    .locator(".board-breakpoint-entry")
    .filter({ has: page.locator('[data-board-bp-node="first"]') });
  await expect(row).toContainText("空覆盖");
  await expect(row).not.toContainText("style.color");
  await page.locator('[data-board-bp-preview="600"]').click();
  await expect(
    page.locator('[data-node-id="first"] [data-source-id="sourceLabel"]'),
  ).toHaveCSS("color", "rgb(0, 170, 0)");
});
test("a replacement project with reused node IDs clears previous map queries and scope state", async ({
  page,
}) => {
  await open(page);
  await page.locator("#board-breakpoint-filter").fill("sourceLabel");
  await page.locator("#board-breakpoint-filter").press("Enter");
  const p = project();
  p.id = "replacement";
  p.boards[0].nodes[0].responsive = [{ maxWidth: 1200, changes: { w: 850 } }];
  p.boards[0].nodes[0].children = [];
  await open(page, p);
  await expect(page.locator("#board-breakpoint-filter")).toHaveValue("");
  await expect(page.locator("[data-board-breakpoint]")).toHaveCount(1);
  await expect(page.locator('[data-board-breakpoint="1200"]')).toBeVisible();
});
