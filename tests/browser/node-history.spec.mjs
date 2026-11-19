import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { newProject, hashProject } from "../../src/core.mjs";
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
function project() {
  const p = newProject("Node history workshop");
  p.boards = [
    {
      id: "work",
      name: "Revision workspace",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "parent",
          name: "Editable panel",
          type: "frame",
          x: 40,
          y: 40,
          w: 640,
          h: 460,
          text: "",
          style: { fill: "$surfaceAlt", radius: 14 },
          children: [
            {
              id: "alpha",
              name: "Primary heading",
              type: "text",
              x: 24,
              y: 24,
              w: 360,
              h: 60,
              text: "Original heading",
              style: { fontSize: 24, color: "$ink", fontWeight: 600 },
            },
            {
              id: "beta",
              name: "Supporting text",
              type: "text",
              x: 24,
              y: 140,
              w: 360,
              h: 50,
              text: "Keep this content",
              style: { fontSize: 18, color: "$muted" },
            },
          ],
          layout: { mode: "absolute" },
        },
      ],
    },
  ];
  return p;
}
const children = (p) => p.boards[0].nodes[0].children;
const alpha = (p) => children(p).find((n) => n.id === "alpha");
const beta = (p) => children(p).find((n) => n.id === "beta");
async function open(page, p = project()) {
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "history.project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('[data-board="work"]')).toBeVisible();
}
async function edit(page, id, field, value) {
  await page.locator('[data-righttab="properties"]').click();
  await page.locator(`[data-node="${id}"]`).click();
  const input = page.locator(`[data-prop="${field}"]`);
  await input.fill(value);
  await input.press("Tab");
}
async function patch(page, ops) {
  const p = await stored(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#upload-patch").setInputFiles({
    name: "changes.patch.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "designforge.patch",
        version: 1,
        baseHash: hashProject(p),
        ops,
      }),
    ),
  });
}
const set = (changes, nodeId = "alpha") => ({
  kind: "set-node",
  boardId: "work",
  nodeId,
  changes,
});
async function history(page, id = "alpha", index = 1) {
  await page.locator('[data-righttab="history"]').click();
  await page.locator("#history-node").selectOption(id);
  await page.locator(`[data-history-preview="${index}"]`).click();
  await expect(page.locator(".history-preview")).toBeVisible();
}
test("scoped history reverts only one node's step, preserving later fields and other nodes through undo/redo/reload", async ({
  page,
}) => {
  await open(page);
  await patch(page, [
    set({ text: "Agent heading", style: { color: "#FF0000" } }),
  ]);
  await edit(page, "beta", "text", "Later supporting content");
  await edit(page, "alpha", "style.fontSize", "32");
  const before = await stored(page);
  await history(page);
  expect(await stored(page)).toEqual(before);
  await expect(page.locator(".history-field.ready")).toHaveCount(2);
  await page.locator("[data-history-apply]").click();
  const after = await stored(page);
  expect(alpha(after)).toMatchObject({
    text: "Original heading",
    style: { color: "$ink", fontSize: 32 },
  });
  expect(beta(after)).toEqual(beta(before));
  await expect(page.locator('[data-node-id="alpha"]')).toHaveCSS(
    "font-size",
    "32px",
  );
  await page.locator("#undo").click();
  expect(alpha(await stored(page))).toEqual(alpha(before));
  expect(beta(await stored(page))).toEqual(beta(before));
  await page.locator("#redo").click();
  expect(alpha(await stored(page))).toEqual(alpha(after));
  await page.reload();
  expect(alpha(await stored(page))).toEqual(alpha(after));
  await page.locator('[data-righttab="history"]').click();
  await page.locator("#history-node").selectOption("alpha");
  await expect(page.locator("[data-node-revision]")).toHaveCount(0);
});
test("same-field conflict remains read only while other changed fields can be selectively reverted", async ({
  page,
}) => {
  await open(page);
  await patch(page, [
    set({ text: "Agent heading", style: { color: "#FF0000" } }),
  ]);
  await edit(page, "alpha", "text", "Human revised heading");
  await history(page);
  const before = await stored(page);
  await expect(page.locator(".history-field.conflict")).toHaveCount(1);
  await expect(page.locator(".history-field.conflict input")).toBeDisabled();
  await expect(page.locator("[data-history-apply]")).toContainText("1");
  await page.screenshot({
    path: "test-results/m1-node-history.png",
    fullPage: true,
  });
  expect(await stored(page)).toEqual(before);
  await page.locator("[data-history-apply]").click();
  expect(alpha(await stored(page))).toMatchObject({
    text: "Human revised heading",
    style: { color: "$ink" },
  });
});
test("field checkboxes preview without writes and apply exactly the chosen subset", async ({
  page,
}) => {
  await open(page);
  await patch(page, [
    set({ text: "Agent heading", style: { color: "#FF0000" } }),
  ]);
  await history(page);
  const before = await stored(page);
  await page
    .locator(".history-field")
    .filter({ has: page.locator("strong", { hasText: "text + textRuns" }) })
    .locator("input")
    .uncheck();
  expect(await stored(page)).toEqual(before);
  await expect(page.locator("[data-history-apply]")).toContainText("1");
  await page.locator("[data-history-apply]").click();
  expect(alpha(await stored(page))).toMatchObject({
    text: "Agent heading",
    style: { color: "$ink" },
  });
});
test("rich text and content restore atomically without undoing a later font size edit", async ({
  page,
}) => {
  const p = project();
  alpha(p).textRuns = [
    { text: "Original ", style: { fontWeight: 700 } },
    { text: "heading", style: { color: "#2266BB" } },
  ];
  await open(page, p);
  await patch(page, [set({ text: "Plain replacement" })]);
  await edit(page, "alpha", "style.fontSize", "30");
  await history(page);
  await page.locator("[data-history-apply]").click();
  const result = alpha(await stored(page));
  expect(result.textRuns).toEqual(alpha(p).textRuns);
  expect(result.style.fontSize).toBe(30);
  await expect(
    page.locator('[data-node-id="alpha"] [style*="2266BB"]'),
  ).toContainText("heading");
});
test("a removed node and its comments recover while later sibling text remains intact", async ({
  page,
}) => {
  const p = project();
  p.comments = [
    {
      id: "annotation",
      boardId: "work",
      nodeId: "alpha",
      text: "Keep attached feedback",
    },
  ];
  await open(page, p);
  await page.locator('[data-node="alpha"]').click();
  await page.locator("#delete-node").click();
  await edit(page, "beta", "text", "Later manual edit");
  await history(page, "alpha");
  await page.locator("[data-history-apply]").click();
  const result = await stored(page);
  expect(alpha(result)).toEqual(alpha(p));
  expect(beta(result).text).toBe("Later manual edit");
  expect(result.comments).toEqual(p.comments);
  await expect(page.locator('[data-node-id="alpha"]')).toContainText(
    "Original heading",
  );
});
test("creation can be locally reversed, and the reverse itself has one-step undo", async ({
  page,
}) => {
  await open(page);
  await page.locator("#add-text").click();
  const created = await stored(page),
    added = created.boards[0].nodes.find((n) => n.id !== "parent");
  await history(page, added.id);
  await page.locator("[data-history-apply]").click();
  expect(
    (await stored(page)).boards[0].nodes.some((n) => n.id === added.id),
  ).toBe(false);
  await page.locator("#undo").click();
  expect(
    (await stored(page)).boards[0].nodes.find((n) => n.id === added.id),
  ).toEqual(added);
});
test("parent order history restores child order while preserving later child text", async ({
  page,
}) => {
  const p = project();
  p.boards[0].nodes[0].layout = {
    mode: "flex",
    direction: "column",
    gap: 24,
    padding: 24,
  };
  await open(page, p);
  await page.locator('[data-node="beta"]').click();
  await page.locator("#viewport").focus();
  await page.keyboard.press("Alt+ArrowUp");
  await edit(page, "alpha", "text", "Later child text");
  await history(page, "parent");
  await page.locator("[data-history-apply]").click();
  const result = await stored(page);
  expect(children(result).map((n) => n.id)).toEqual(["alpha", "beta"]);
  expect(alpha(result).text).toBe("Later child text");
});
test("locked nodes and ancestors cannot be unlocked or changed through history", async ({
  page,
}) => {
  await open(page);
  await edit(page, "alpha", "name", "New name");
  await page.locator('[data-prop="locked"]').selectOption("true");
  const before = await stored(page);
  await history(page);
  await expect(page.locator(".history-field.blocked")).toHaveCount(1);
  await expect(page.locator("[data-history-apply]")).toBeDisabled();
  expect(await stored(page)).toEqual(before);
});
test("changing selection or the project invalidates the old preview and prevents cross-ID restoration", async ({
  page,
}) => {
  await open(page);
  await edit(page, "alpha", "name", "New name");
  await history(page);
  await page.locator('[data-node="beta"]').click();
  await expect(page.locator("[data-history-apply]")).toHaveCount(0);
  const replacement = project();
  replacement.id = "different-project";
  await open(page, replacement);
  await page.locator('[data-righttab="history"]').click();
  await page.locator("#history-node").selectOption("alpha");
  await expect(page.locator("[data-node-revision]")).toHaveCount(0);
  expect(alpha(await stored(page)).name).toBe("Primary heading");
});
test("history labels and before/after values escape hostile text", async ({
  page,
}) => {
  await open(page);
  await edit(
    page,
    "alpha",
    "text",
    '<img src=x onerror="window.historyInjected=true">',
  );
  await history(page);
  await expect(page.locator(".history-preview img")).toHaveCount(0);
  await expect(page.locator(".history-preview code").first()).toContainText(
    "<img",
  );
  expect(await page.evaluate(() => window.historyInjected)).toBeUndefined();
});
test("source locks added after an instance edit also guard the history restore path", async ({
  page,
}) => {
  const p = project(),
    source = {
      id: "sourceRoot",
      name: "Source container",
      type: "frame",
      x: 40,
      y: 350,
      w: 200,
      h: 100,
      text: "",
      style: {},
      children: [
        {
          id: "sourceLabel",
          name: "Source label",
          type: "text",
          x: 10,
          y: 10,
          w: 180,
          h: 40,
          text: "Source",
          style: {},
        },
      ],
    };
  p.components = [
    {
      id: "symbol",
      name: "Symbol",
      variants: [{ id: "base", name: "Base", root: structuredClone(source) }],
    },
  ];
  p.boards[0].nodes.push(source, {
    id: "instance",
    name: "Original instance",
    type: "instance",
    componentId: "symbol",
    variantId: "base",
    x: 420,
    y: 180,
    w: 200,
    h: 100,
    text: "",
    style: {},
  });
  await open(page, p);
  await patch(page, [
    set(
      {
        name: "Revised instance",
        overrides: { sourceLabel: { text: "Revised override" } },
      },
      "instance",
    ),
  ]);
  await page.locator('[data-node="sourceLabel"]').click();
  await page.locator('[data-prop="locked"]').selectOption("true");
  await page.locator('[data-node="sourceRoot"]').click();
  await page.locator('[data-lefttab="components"]').click();
  page.once("dialog", (dialog) => dialog.accept("base"));
  await page.locator('[data-update-component="symbol"]').click();
  await history(page, "instance");
  await expect(page.locator(".history-field.blocked")).toHaveCount(1);
  await expect(page.locator("[data-history-apply]")).toContainText("1");
  await page.locator("[data-history-apply]").click();
  const result = await stored(page),
    instance = result.boards[0].nodes.find((n) => n.id === "instance");
  expect(instance.name).toBe("Original instance");
  expect(instance.overrides.sourceLabel.text).toBe("Revised override");
  expect(result.components[0].variants[0].root.children[0].locked).toBe(true);
});
test("full history values and downloaded review preserve long hostile text without changing selection or the project", async ({
  page,
}) => {
  const original = "Original long value ".repeat(40) + "FINAL ORIGINAL TAIL",
    revised =
      "<img src=x onerror=window.historyInjected=1>" +
      "Revised content ".repeat(40) +
      "FINAL REVISED TAIL",
    p = project();
  alpha(p).text = original;
  await open(page, p);
  await patch(page, [set({ text: revised })]);
  const before = await stored(page);
  await history(page);
  const field = page.locator(".history-field.ready"),
    checkbox = field.locator("input");
  await field.locator(".history-values code").first().click();
  await expect(checkbox).toBeChecked();
  await expect(field.locator("pre")).toBeEmpty();
  await field.locator("summary").click();
  await expect(field.locator("pre")).toContainText("FINAL REVISED TAIL");
  const full = JSON.parse(await field.locator("pre").textContent());
  expect(full.current.text).toBe(revised);
  expect(full.restore.text).toBe(original);
  await expect(checkbox).toBeChecked();
  await expect(field.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.historyInjected)).toBeUndefined();
  const pending = page.waitForEvent("download");
  await page.locator("[data-history-export]").click();
  const download = await pending,
    report = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  expect(download.suggestedFilename()).toBe("node-history-alpha.review.json");
  expect(report).toMatchObject({
    format: "designforge.node-history-review",
    version: 1,
    projectId: p.id,
    boardId: "work",
    nodeId: "alpha",
    baseHash: hashProject(before),
    selected: ["text + textRuns"],
  });
  expect(report.changes[0].current.text).toBe(revised);
  expect(report.changes[0].before.text).toBe(original);
  expect(await stored(page)).toEqual(before);
  await page.screenshot({ path: "test-results/m1-history-full-review.png" });
  // Export is a read-only report, not an extra history entry.
  await page.locator("#undo").click();
  expect(alpha(await stored(page)).text).toBe(original);
});
