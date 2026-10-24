import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { DEFAULT_TOKENS, validateProject } from "../../src/core.mjs";
const storageKey = "designforge.project.v1";
const rect = (id, x, y, w, h, style = {}) => ({
  id,
  name: id,
  type: "rect",
  x,
  y,
  w,
  h,
  text: "",
  style: { fill: "$primary", ...style },
});
const text = (id, value, x, y, w, h, style = {}) => ({
  id,
  name: id,
  type: "text",
  x,
  y,
  w,
  h,
  text: value,
  style: { fontSize: 20, color: "$ink", ...style },
});
function project(id = "advanced") {
  const rich = text("rich", "Hello 👩‍💻 world", 40, 40, 340, 70);
  rich.textRuns = [
    { text: "Hello ", style: { color: "#123456" } },
    { text: "👩‍💻", style: { italic: true } },
    { text: " world", style: { fontWeight: 600 } },
  ];
  const sourcePanel = rect("sourcePanel", 10, 10, 160, 50);
  sourcePanel.responsive = [
    { maxWidth: 600, changes: { style: { fill: "#00AA55" } } },
  ];
  const component = {
    id: "card",
    name: "Reusable card",
    variants: [
      {
        id: "default",
        name: "Default",
        root: {
          id: "sourceRoot",
          name: "Card root",
          type: "frame",
          x: 0,
          y: 0,
          w: 200,
          h: 120,
          text: "",
          style: { fill: "$surfaceAlt" },
          layout: { mode: "absolute" },
          children: [
            sourcePanel,
            text("sourceLabel", "Reusable UI", 10, 70, 160, 30, {
              fontSize: 16,
            }),
          ],
        },
      },
    ],
  };
  const instance = (instanceId, x) => ({
    id: instanceId,
    name: instanceId,
    type: "instance",
    componentId: "card",
    variantId: "default",
    x,
    y: 160,
    w: 200,
    h: 120,
    text: "",
    style: {},
    overrides: {},
  });
  const p = {
    format: "designforge.project",
    version: 1,
    id,
    title: "Advanced content / " + id,
    updatedAt: "2026-10-24T00:00:00.000Z",
    tokens: {
      ...DEFAULT_TOKENS,
      primary: "$accent",
      accent: "#4266FF",
      spacing: 8,
    },
    themes: {
      day: { primary: "#2563EB", spacing: 12 },
      night: { primary: "#93C5FD", spacing: 20 },
    },
    activeTheme: "day",
    components: [component],
    assets: [],
    boards: [
      {
        id: "work",
        name: "Content workspace",
        x: 0,
        y: 60,
        w: 800,
        h: 600,
        bg: "#FFFFFF",
        nodes: [
          rich,
          instance("first", 40),
          instance("second", 300),
          {
            id: "spacingFrame",
            name: "Token gap",
            type: "frame",
            x: 40,
            y: 340,
            w: 400,
            h: 80,
            text: "",
            style: {},
            layout: { mode: "flex", direction: "row", gap: "$spacing" },
            children: [
              rect("gapOne", 0, 0, 40, 40),
              rect("gapTwo", 0, 0, 40, 40),
            ],
          },
        ],
      },
    ],
    comments: [],
  };
  if (validateProject(p).length)
    throw Error(JSON.stringify(validateProject(p)));
  return p;
}
const stored = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
const richNode = (p) => p.boards[0].nodes.find((n) => n.id === "rich");
async function importProject(page, p) {
  await page.locator("#upload-json").setInputFiles({
    name: p.id + ".project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator("#project-title")).toHaveText(p.title);
}
async function open(page, p = project()) {
  await page.goto("/");
  await importProject(page, p);
}
async function select(page, id) {
  await page.locator(`[data-node="${id}"]`).click();
}
async function range(page, start, end) {
  const input = page.locator("#prop-text");
  await input.focus();
  await input.evaluate(
    (el, { start, end }) => {
      el.setSelectionRange(start, end);
      el.dispatchEvent(new Event("select", { bubbles: true }));
    },
    { start, end },
  );
}
const runFor = (node, value) =>
  node.textRuns?.find((run) => run.text.includes(value));
async function downloadedJSON(download) {
  return JSON.parse(fs.readFileSync(await download.path(), "utf8"));
}

test("rich styles survive ordinary middle edits, one-step undo and reload without rewriting unrelated nodes", async ({
  page,
}) => {
  const p = project();
  await open(page, p);
  await select(page, "rich");
  await range(page, 0, 5);
  await page.locator('[data-rich-format="bold"]').click();
  const bold = richNode(await stored(page));
  expect(runFor(bold, "Hello").style).toMatchObject({
    fontWeight: 700,
    color: "#123456",
  });
  await expect(
    page
      .locator('[data-node-id="rich"] [data-text-run]')
      .filter({ hasText: "Hello" }),
  ).toHaveCSS("font-weight", "700");
  await page.locator("#prop-text").fill("Hello 👩‍💻 new world");
  await page.locator("#prop-text").press("Tab");
  const edited = await stored(page);
  expect(richNode(edited).text).toBe("Hello 👩‍💻 new world");
  expect(runFor(richNode(edited), "Hello").style.fontWeight).toBe(700);
  expect(runFor(richNode(edited), "👩‍💻").style.italic).toBe(true);
  expect(runFor(richNode(edited), "world").style.fontWeight).toBe(600);
  expect(edited.boards[0].nodes.slice(1)).toEqual(p.boards[0].nodes.slice(1));
  await page.locator("#undo").click();
  expect(richNode(await stored(page))).toEqual(bold);
  await page.locator("#redo").click();
  await page.reload();
  await select(page, "rich");
  await expect(page.locator("#prop-text")).toHaveValue("Hello 👩‍💻 new world");
  expect(richNode(await stored(page))).toEqual(richNode(edited));
});
test("partial emoji selection formats a full grapheme; token color, size, line height and clear operations render safely", async ({
  page,
}) => {
  await open(page);
  await select(page, "rich");
  await range(page, 7, 8);
  await page.locator('[data-rich-format="underline"]').click();
  let n = richNode(await stored(page));
  expect(runFor(n, "👩‍💻")).toMatchObject({
    text: "👩‍💻",
    style: { italic: true, underline: true },
  });
  await expect(
    page
      .locator('[data-node-id="rich"] [data-text-run]')
      .filter({ hasText: "👩‍💻" }),
  ).toHaveCSS("text-decoration-line", "underline");
  await range(page, 0, 5);
  await page.locator("#rich-color").fill("$accent");
  await page.locator('[data-rich-format="color"]').click();
  await expect(
    page
      .locator('[data-node-id="rich"] [data-text-run]')
      .filter({ hasText: "Hello" }),
  ).toHaveCSS("color", "rgb(66, 102, 255)");
  await range(page, 0, 5);
  await page.locator("#rich-size").fill("28");
  await page.locator('[data-rich-format="size"]').click();
  await expect(
    page
      .locator('[data-node-id="rich"] [data-text-run]')
      .filter({ hasText: "Hello" }),
  ).toHaveCSS("font-size", "28px");
  await page.locator('[data-prop="style.lineHeight"]').fill("1.8");
  await page.locator('[data-prop="style.lineHeight"]').press("Tab");
  expect(richNode(await stored(page)).style.lineHeight).toBe(1.8);
  await page.locator('[data-prop="style.fontFamily"]').selectOption("Georgia");
  await expect(page.locator('[data-node-id="rich"]')).toHaveCSS(
    "font-family",
    /Georgia/,
  );
  await page.screenshot({
    path: "test-results/m1-richtext.png",
    fullPage: true,
  });
  await range(page, 0, 5);
  await page.locator('[data-rich-format="reset"]').click();
  n = richNode(await stored(page));
  expect(runFor(n, "Hello").style || {}).toEqual({});
  expect(runFor(n, "👩‍💻").style.underline).toBe(true);
  await page.locator('[data-rich-format="plain"]').click();
  expect(richNode(await stored(page)).textRuns).toBeUndefined();
  await expect(page.locator('[data-node-id="rich"]')).toHaveText(
    "Hello 👩‍💻 world",
  );
});
test("component properties stay instance-local, override source breakpoints and reset to source inheritance", async ({
  page,
}) => {
  const p = project();
  await open(page, p);
  await page.locator("#preview-width").selectOption("600");
  await select(page, "first");
  const first = page.locator(
      '[data-node-id="first"] [data-source-id="sourcePanel"]',
    ),
    second = page.locator(
      '[data-node-id="second"] [data-source-id="sourcePanel"]',
    );
  await expect(first).toHaveCSS("background-color", "rgb(0, 170, 85)");
  const details = page.locator('[data-component-entry="sourcePanel"]');
  if ((await details.getAttribute("open")) === null)
    await details.locator("summary").click();
  const fill = page.locator(
    '[data-component-source="sourcePanel"][data-component-field="style.fill"]',
  );
  await fill.fill("#F97316");
  await fill.press("Tab");
  await expect(first).toHaveCSS("background-color", "rgb(249, 115, 22)");
  await expect(second).toHaveCSS("background-color", "rgb(0, 170, 85)");
  const changed = await stored(page);
  expect(changed.components).toEqual(p.components);
  expect(changed.boards[0].nodes.find((n) => n.id === "second")).toEqual(
    p.boards[0].nodes.find((n) => n.id === "second"),
  );
  await page
    .locator(
      '[data-component-source="sourcePanel"][data-component-reset="style.fill"]',
    )
    .click();
  await expect(first).toHaveCSS("background-color", "rgb(0, 170, 85)");
  expect(
    (await stored(page)).boards[0].nodes.find((n) => n.id === "first").overrides
      .sourcePanel,
  ).toBeUndefined();
});
test("a real library download imports under a prefix into another project and conflicts never write data", async ({
  page,
}) => {
  const source = project("source");
  source.tokens.fontFamily = "Georgia";
  await open(page, source);
  await page.locator('[data-lefttab="components"]').click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export-library").click(),
  ]);
  const bundle = await downloadedJSON(download);
  expect(bundle.format).toBe("designforge.library");
  expect(bundle.boards).toBeUndefined();
  expect(bundle.comments).toBeUndefined();
  const target = project("target");
  target.tokens.fontFamily = "Arial";
  target.tokens.accent = "#AA2233";
  target.components = [];
  target.boards[0].nodes = target.boards[0].nodes.filter(
    (n) => n.type !== "instance",
  );
  await importProject(page, target);
  await page.locator('[data-lefttab="components"]').click();
  const before = await stored(page);
  await page.locator("#library-prefix").fill("");
  await page.locator("#upload-library").setInputFiles({
    name: "source.library.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(page.locator("#toast")).toContainText(/conflict/i);
  expect(await stored(page)).toEqual(before);
  await page.locator("#library-prefix").fill("kit");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#upload-library").setInputFiles({
    name: "source.library.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(
    page.locator('[data-insert-component="kit-card"][data-variant="default"]'),
  ).toBeVisible();
  const imported = await stored(page);
  expect(imported.boards).toEqual(before.boards);
  expect(imported.activeTheme).toBe(before.activeTheme);
  expect(imported.tokens.primary).toBe(before.tokens.primary);
  expect(imported.tokens.kitPrimary).toBe("$kitAccent");
  await page
    .locator('[data-insert-component="kit-card"][data-variant="default"]')
    .click();
  const instance = (await stored(page)).boards[0].nodes.find(
    (n) => n.componentId === "kit-card",
  );
  expect(instance).toBeTruthy();
  await expect(
    page.locator(
      `[data-node-id="${instance.id}"] [data-source-id="sourcePanel"]`,
    ),
  ).toHaveCSS("background-color", "rgb(66, 102, 255)");
  await expect(
    page.locator(
      `[data-node-id="${instance.id}"] [data-source-id="sourceLabel"]`,
    ),
  ).toHaveCSS("font-family", /Georgia/);
  expect((await stored(page)).tokens.fontFamily).toBe("Arial");
  await page.screenshot({
    path: "test-results/m1-library.png",
    fullPage: true,
  });
});
test("theme token edits and inheritance reset preserve base values and other themes", async ({
  page,
}) => {
  const p = project();
  await open(page, p);
  await page.locator('[data-righttab="tokens"]').click();
  await page.locator('[data-theme="project"]').selectOption("day");
  const input = page.locator('[data-design-token="spacing"]');
  await input.fill("24");
  await input.press("Tab");
  let saved = await stored(page);
  expect(saved.tokens.spacing).toBe(8);
  expect(saved.themes.day.spacing).toBe(24);
  expect(saved.themes.night).toEqual(p.themes.night);
  await expect(page.locator('[data-node-id="spacingFrame"]')).toHaveCSS(
    "gap",
    "24px",
  );
  await page.locator('[data-token-reset="spacing"]').click();
  saved = await stored(page);
  expect(saved.themes.day.spacing).toBeUndefined();
  expect(saved.tokens.spacing).toBe(8);
  await expect(page.locator('[data-node-id="spacingFrame"]')).toHaveCSS(
    "gap",
    "8px",
  );
  await page.locator('[data-theme="project"]').selectOption("");
  await page.locator('[data-design-token="spacing"]').fill("10");
  await page.locator('[data-design-token="spacing"]').press("Tab");
  saved = await stored(page);
  expect(saved.tokens.spacing).toBe(10);
  expect(saved.themes.night).toEqual(p.themes.night);
});
test("Audit UI measures current DOM, exports browser findings and marks the result stale after edits", async ({
  page,
}) => {
  const p = project("audit");
  p.boards[0].nodes = [
    text("clip", "Content clipped at the bottom edge", 40, 590, 160, 10, {
      fontSize: 32,
    }),
    { ...rect("small", 300, 100, 30, 30), type: "button", text: "OK" },
    rect("overlapOne", 350, 200, 80, 80),
    rect("overlapTwo", 390, 240, 80, 80),
  ];
  await open(page, p);
  await page.locator('[data-righttab="audit"]').click();
  await page.locator('[data-action="run-browser-audit"]').click();
  await expect(page.locator("[data-rendered-findings]")).toContainText("实测");
  await expect(page.locator("[data-rendered-findings]")).toHaveAttribute(
    "data-audit-stale",
    "false",
  );
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-action="download-audit"]').click(),
  ]);
  const report = await downloadedJSON(download);
  expect(Array.isArray(report.renderedFindings)).toBe(true);
  expect(
    report.renderedFindings.some(
      (i) => i.code === "TEXT_CLIP" && i.nodeId === "clip",
    ),
  ).toBe(true);
  expect(
    report.renderedFindings.some(
      (i) => i.code === "TOUCH_TARGET" && i.nodeId === "small",
    ),
  ).toBe(true);
  expect(report.renderedFindings.some((i) => i.code === "COLLISION")).toBe(
    true,
  );
  await page.screenshot({
    path: "test-results/m1-browser-audit.png",
    fullPage: true,
  });
  await page.locator('[data-righttab="properties"]').click();
  await select(page, "small");
  await page.locator('[data-prop="w"]').fill("60");
  await page.locator('[data-prop="w"]').press("Tab");
  await page.locator('[data-righttab="audit"]').click();
  await expect(page.locator("[data-rendered-findings]")).toHaveAttribute(
    "data-audit-stale",
    "true",
  );
  await expect(page.locator("[data-rendered-findings]")).toContainText("过期");
  await page.locator('[data-action="run-browser-audit"]').click();
  await expect(page.locator("[data-rendered-findings]")).toHaveAttribute(
    "data-audit-stale",
    "false",
  );
});

test("rich text ranges never leak between boards reusing a node ID", async ({
  page,
}) => {
  const p = project(),
    other = structuredClone(p.boards[0]);
  other.id = "otherBoard";
  other.name = "Other board";
  other.x = 900;
  other.nodes = [text("rich", "Short", 40, 40, 300, 70)];
  p.boards.push(other);
  await open(page, p);
  await select(page, "rich");
  await range(page, 0, 5);
  await page.locator('[data-board="otherBoard"]').click();
  await select(page, "rich");
  const before = await stored(page);
  await page.locator('[data-rich-format="bold"]').click();
  expect(await stored(page)).toEqual(before);
  await range(page, 1, 3);
  await page.locator('[data-rich-format="bold"]').click();
  const saved = await stored(page);
  expect(saved.boards[0].nodes[0]).toEqual(p.boards[0].nodes[0]);
  expect(
    saved.boards[1].nodes[0].textRuns.some(
      (run) => run.text === "ho" && run.style.fontWeight === 700,
    ),
  ).toBe(true);
});
