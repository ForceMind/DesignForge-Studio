import { test, expect } from "@playwright/test";
import { newProject, validateProject } from "../../src/core.mjs";
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
function project() {
  const p = newProject("Component workshop"),
    node = (id, type, text = "") => ({
      id,
      name: id,
      type,
      x: 0,
      y: 0,
      w: 280,
      h: 50,
      text,
      style: { color: "$ink", fontSize: 20 },
    });
  p.components = [
    {
      id: "control",
      name: "Control",
      variants: [
        {
          id: "base",
          name: "Base",
          root: {
            ...node("sourceRoot", "frame"),
            w: 320,
            h: 140,
            style: { fill: "$surfaceAlt", radius: 12 },
            children: [
              {
                ...node("sourceTitle", "text", "Inherited title"),
                x: 16,
                y: 16,
              },
              {
                ...node("sourceSubtitle", "text", "Inherited subtitle"),
                x: 16,
                y: 76,
              },
            ],
          },
        },
      ],
    },
  ];
  p.boards = [
    {
      id: "work",
      name: "Instances",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          ...node("instance", "instance"),
          x: 40,
          y: 40,
          w: 320,
          h: 140,
          style: {},
          componentId: "control",
          variantId: "base",
          overrides: { sourceTitle: { text: "Manual content" } },
        },
      ],
    },
  ];
  expect(validateProject(p)).toEqual([]);
  return p;
}
async function open(page, p = project()) {
  expect(validateProject(p)).toEqual([]);
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "components.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('[data-board="work"]')).toBeVisible();
  await page.locator('[data-lefttab="components"]').click();
  await page.locator('[data-component-manager="control"] > summary').click();
}
const action = (page, kind, variantId, componentId = "control") =>
  page.locator(
    `[data-component-action="${kind}"][data-component-id="${componentId}"]${variantId ? `[data-variant="${variantId}"]` : ""}`,
  );
const accept = (page, value) =>
  page.once("dialog", (dialog) => dialog.accept(value));
async function copySource(page) {
  await action(page, "copy-source", "base").click();
  await expect(page.locator('[data-node="sourceRoot"]')).toBeVisible();
  return (await stored(page)).boards[1];
}
test("variant and component lifecycle preserves references, escapes names, and remains undoable after reload", async ({
  page,
}) => {
  await open(page);
  const initial = await stored(page);
  await expect(action(page, "remove-variant", "base")).toBeDisabled();
  await expect(action(page, "remove-component")).toBeDisabled();
  accept(page, "Secondary");
  await action(page, "duplicate-variant", "base").click();
  const duplicate = (await stored(page)).components[0].variants[1];
  await expect(
    page.locator('[data-component-manager="control"]'),
  ).toHaveAttribute("open", "");
  await expect(action(page, "remove-variant", "base")).toBeDisabled();
  await expect(action(page, "remove-variant", duplicate.id)).toBeEnabled();
  const hostile = "<img src=x onerror=window.libraryInjected=1> Named variant";
  accept(page, hostile);
  await action(page, "rename-variant", duplicate.id).click();
  await expect(
    page.locator(`[data-component-variant="${duplicate.id}"] strong`),
  ).toHaveText(hostile);
  await expect(page.locator("#component-list img")).toHaveCount(0);
  expect(await page.evaluate(() => window.libraryInjected)).toBeUndefined();
  accept(page, "Renamed control");
  await action(page, "rename-component").click();
  expect((await stored(page)).boards).toEqual(initial.boards);
  accept(page);
  await action(page, "remove-variant", duplicate.id).click();
  expect((await stored(page)).components[0].variants).toHaveLength(1);
  await page.locator("#undo").click();
  expect((await stored(page)).components[0].variants[1].name).toBe(hostile);
  accept(page, "Another control");
  await action(page, "duplicate-component").click();
  const copied = (await stored(page)).components[1];
  await page
    .locator(`[data-component-manager="${copied.id}"] > summary`)
    .click();
  accept(page);
  await action(page, "remove-component", undefined, copied.id).click();
  expect((await stored(page)).components).toHaveLength(1);
  await page.locator("#undo").click();
  await page.reload();
  const result = await stored(page);
  expect(result.components).toHaveLength(2);
  expect(result.components[0].name).toBe("Renamed control");
  expect(result.boards).toEqual(initial.boards);
});
test("source copies use the full editor and updating the exact variant preserves custom instance content through undo, redo and reload", async ({
  page,
}) => {
  await open(page);
  const initial = await stored(page),
    copy = await copySource(page);
  expect(copy.nodes[0].children.map((n) => n.id)).toEqual([
    "sourceTitle",
    "sourceSubtitle",
  ]);
  await page.locator('[data-node="sourceSubtitle"]').click();
  await page.locator('[data-prop="text"]').fill("Updated from source copy");
  await page.locator('[data-prop="text"]').press("Tab");
  await page.locator('[data-lefttab="components"]').click();
  const update = page.locator(
    '[data-update-variant="control"][data-variant="base"]',
  );
  await expect(update).toBeDisabled();
  await page.locator('[data-lefttab="layers"]').click();
  await page.locator('[data-node="sourceRoot"]').click();
  await page.locator('[data-lefttab="components"]').click();
  await expect(update).toBeEnabled();
  await update.click();
  expect((await stored(page)).boards[0]).toEqual(initial.boards[0]);
  await expect(
    page.locator('[data-artboard="work"] [data-source-id="sourceTitle"]'),
  ).toHaveText("Manual content");
  await expect(
    page.locator('[data-artboard="work"] [data-source-id="sourceSubtitle"]'),
  ).toHaveText("Updated from source copy");
  await expect(page.locator("#toast")).toBeHidden();
  await page.screenshot({ path: "test-results/m1-component-management.png" });
  await page.locator("#undo").click();
  await expect(
    page.locator('[data-artboard="work"] [data-source-id="sourceSubtitle"]'),
  ).toHaveText("Inherited subtitle");
  expect((await stored(page)).boards[1].nodes[0].children[1].text).toBe(
    "Updated from source copy",
  );
  await page.locator("#redo").click();
  await page.reload();
  await expect(
    page.locator('[data-artboard="work"] [data-source-id="sourceSubtitle"]'),
  ).toHaveText("Updated from source copy");
  expect((await stored(page)).boards).toHaveLength(2);
});
test("a source update cannot silently discard overrides when a copied source layer has been removed", async ({
  page,
}) => {
  await open(page);
  await copySource(page);
  await page.locator('[data-node="sourceTitle"]').click();
  await page.locator('[data-action="delete"]').click();
  await page.locator('[data-node="sourceRoot"]').click();
  await page.locator('[data-lefttab="components"]').click();
  const before = await stored(page);
  await page
    .locator('[data-update-variant="control"][data-variant="base"]')
    .click();
  await expect(page.locator("#toast")).toContainText(/override/i);
  expect(await stored(page)).toEqual(before);
  await expect(
    page.locator('[data-artboard="work"] [data-source-id="sourceTitle"]'),
  ).toHaveText("Manual content");
  // The failed update adds no history entry; one Undo restores the removed copied layer.
  await page.locator("#undo").click();
  expect((await stored(page)).boards[1].nodes[0].children).toHaveLength(2);
});
test("leaf component roots retain their semantic content and can be edited as source copies from another inspector tab", async ({
  page,
}) => {
  const p = project(),
    root = p.components[0].variants[0].root;
  root.type = "button";
  root.text = "Leaf control";
  root.style = { fill: "$primary", color: "#FFFFFF", fontSize: 20 };
  delete root.children;
  p.boards[0].nodes[0].overrides = {};
  await open(page, p);
  const instance = page.locator(
    '[data-artboard="work"] [data-node-id="instance"]',
  );
  await expect(instance).toHaveText("Leaf control");
  expect(await instance.evaluate((el) => el.tagName)).toBe("BUTTON");
  await page.locator('[data-righttab="tokens"]').click();
  await copySource(page);
  await expect(page.locator('[data-righttab="properties"]')).toHaveClass(
    /active/,
  );
  await expect(page.locator('[data-prop="text"]')).toHaveValue("Leaf control");
  await page.locator('[data-prop="text"]').fill("Updated leaf control");
  await page.locator('[data-prop="text"]').press("Tab");
  await page.locator('[data-lefttab="components"]').click();
  await page
    .locator('[data-update-variant="control"][data-variant="base"]')
    .click();
  await expect(instance).toHaveText("Updated leaf control");
  expect(await instance.evaluate((el) => el.tagName)).toBe("BUTTON");
  await page.locator('[data-lefttab="layers"]').click();
  await page.locator('[data-board="work"]').click();
  await page.locator('[data-node="instance"]').click();
  await page.locator('[data-action="detach"]').click();
  const detached = (await stored(page)).boards[0].nodes[0];
  expect(detached).toMatchObject({
    type: "button",
    text: "Updated leaf control",
  });
  expect(detached).not.toHaveProperty("componentId");
  expect(detached).not.toHaveProperty("children");
  await page.locator("#undo").click();
  expect((await stored(page)).boards[0].nodes[0].type).toBe("instance");
  await page.locator("#redo").click();
  await page.reload();
  await expect(instance).toHaveText("Updated leaf control");
  expect((await stored(page)).boards[0].nodes[0].type).toBe("button");
});
