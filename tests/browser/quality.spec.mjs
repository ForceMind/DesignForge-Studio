import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import {
  DEFAULT_TOKENS,
  hashProject,
  validateProject,
} from "../../src/core.mjs";

const storageKey = "designforge.project.v1";
const node = (id, type, x, y, w, h, style = {}, text = "") => ({
  id,
  name: id,
  type,
  x,
  y,
  w,
  h,
  style,
  text,
});
const fixture = () => {
  const small = node(
    "small",
    "button",
    20,
    20,
    38,
    38,
    { fill: "#DDDDDD", color: "#BBBBBB", fontSize: 10 },
    "A",
  );
  const rounded = {
    ...node("outer", "frame", 140, 20, 210, 110, {
      radius: 25,
      fill: "#EEEEEE",
      stroke: "#000000",
      strokeWidth: 2,
    }),
    children: [
      node("inner", "frame", 6, 6, 194, 94, { radius: 25, fill: "#FFFFFF" }),
    ],
  };
  const source = {
    ...node("root", "frame", 0, 0, 140, 85),
    children: [
      node(
        "sourceButton",
        "button",
        5,
        5,
        34,
        34,
        { fill: "#222222", color: "#FFFFFF" },
        "OK",
      ),
    ],
  };
  const instance = {
    ...node("instance", "instance", 30, 170, 140, 85),
    componentId: "buttonCard",
    variantId: "default",
    overrides: {},
  };
  return {
    format: "designforge.project",
    version: 1,
    id: "quality",
    title: "Quality workbench",
    tokens: DEFAULT_TOKENS,
    updatedAt: "2026-11-19T00:00:00.000Z",
    comments: [],
    components: [
      {
        id: "buttonCard",
        name: "Button Card",
        variants: [{ id: "default", name: "Default", root: source }],
      },
    ],
    boards: [
      {
        id: "first",
        name: "Main",
        x: 0,
        y: 60,
        w: 800,
        h: 500,
        bg: "#FFFFFF",
        nodes: [
          small,
          rounded,
          {
            ...node(
              "off",
              "button",
              75,
              20,
              38,
              38,
              { fill: "#FFFFFF", color: "#FFFFFF" },
              "A",
            ),
            disabled: true,
          },
          node(
            "clip",
            "text",
            20,
            482,
            260,
            17,
            { fontSize: 28 },
            "中文 English 123456789",
          ),
          node(
            "expand",
            "input",
            310,
            220,
            124,
            44,
            { fontSize: 16 },
            "WWWWWW",
          ),
          {
            ...node(
              "responsive",
              "button",
              180,
              195,
              80,
              48,
              { fill: "#DDDDDD", color: "#111111" },
              "OK",
            ),
            responsive: [{ maxWidth: 600, changes: { w: 36 } }],
            states: { focus: { style: { fill: "#BBBBBB", color: "#BBBBBB" } } },
          },
        ],
      },
      {
        id: "second",
        name: "Second",
        x: 900,
        y: 60,
        w: 700,
        h: 500,
        bg: "#FFFFFF",
        nodes: [instance],
      },
    ],
  };
};
const stored = (page) =>
  page.evaluate((key) => localStorage.getItem(key), storageKey);
async function open(page) {
  const p = fixture();
  expect(validateProject(p)).toEqual([]);
  await page.goto("/");
  await page.locator("#upload-json").setInputFiles({
    name: "quality.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('[data-board="first"]')).toBeVisible();
  await page.locator('[data-board="first"]').click();
  await page.locator('[data-righttab="audit"]').click();
}
async function run(page) {
  await page.locator('[data-action="run-quality"]').click();
  await expect(page.locator("[data-quality-status]")).toContainText("本次测量");
}
async function download(page) {
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-action="download-quality"]').click(),
  ]);
  expect(file.suggestedFilename()).toBe("designforge-quality.json");
  return JSON.parse(await fs.readFile(await file.path(), "utf8"));
}
test("local report measures, deduplicates, filters, downloads and locates a projected source without writes", async ({
  page,
}, info) => {
  await open(page);
  const before = await stored(page);
  await page.locator("#quality-scope").selectOption("project");
  await run(page);
  const report = await download(page);
  expect(report.format).toBe("designforge.quality-report");
  expect(report.baseHash).toBe(hashProject(JSON.parse(before)));
  expect(report.coverage.map((c) => c.status)).toEqual([
    "measured",
    "measured",
  ]);
  expect(
    report.findings.filter((f) => f.ruleId === "QI01" && f.nodeId === "small"),
  ).toHaveLength(1);
  expect(
    report.findings.some(
      (f) => f.nodeId === "off" && ["QC02", "QI01"].includes(f.ruleId),
    ),
  ).toBe(false);
  expect(
    report.findings.find((f) => f.ruleId === "QG01" && f.nodeId === "inner")
      .evidence.suggestedRadiusPx,
  ).toBeCloseTo(17, 0);
  expect(
    report.findings.some((f) => f.ruleId === "QT02" && f.nodeId === "clip"),
  ).toBe(true);
  expect(
    report.findings.some((f) => f.ruleId === "QT01" && f.nodeId === "small"),
  ).toBe(true);
  expect(
    report.findings.some((f) => f.ruleId === "QC02" && f.nodeId === "small"),
  ).toBe(true);
  expect(await stored(page)).toBe(before);
  await page.screenshot({ path: info.outputPath("quality-panel.png") });
  await page.locator("#quality-group").selectOption("interaction");
  await expect(page.locator('[data-quality-rule="QG01"]')).toHaveCount(0);
  const projection = page.locator(
    '[data-quality-rule="QI01"][data-auditnode="instance"]',
  );
  await expect(projection).toContainText("sourceButton");
  await projection.click();
  await expect(page.locator('[data-prop="name"]')).toHaveValue("instance");
  await expect(
    page.locator('[data-artboard="second"] [data-node-id="instance"]'),
  ).toHaveClass(/is-selected/);
  expect(await stored(page)).toBe(before);
});
test("selection, actual breakpoint width, forced state, text stress and project changes invalidate the right snapshot", async ({
  page,
}) => {
  await open(page);
  const before = await stored(page);
  await page.locator('[data-node="responsive"]').click();
  await page.locator("#quality-scope").selectOption("selection");
  await run(page);
  let report = await download(page);
  expect(report.context.nodeIds).toEqual(["responsive"]);
  expect(report.findings.some((f) => f.ruleId === "QI01")).toBe(false);
  await page.locator("#preview-width").selectOption("600");
  await expect(page.locator("[data-quality-status]")).toHaveAttribute(
    "data-audit-stale",
    "true",
  );
  await expect(page.locator('[data-action="download-quality"]')).toBeDisabled();
  await run(page);
  report = await download(page);
  expect(report.coverage[0].measuredWidth).toBeCloseTo(600, 0);
  expect(
    report.findings.some(
      (f) => f.ruleId === "QI01" && f.evidence.rect.w === 36,
    ),
  ).toBe(true);
  await page.locator('[data-righttab="properties"]').click();
  await page.locator("#state-preview").selectOption("focus");
  await page.locator('[data-righttab="audit"]').click();
  await expect(page.locator("[data-quality-status]")).toHaveAttribute(
    "data-audit-stale",
    "true",
  );
  await run(page);
  report = await download(page);
  expect(report.context.boards[0].forcedState).toEqual({
    nodeId: "responsive",
    state: "focus",
  });
  await page.locator("#quality-scope").selectOption("board");
  await page.locator("#quality-expansion").check();
  await run(page);
  report = await download(page);
  expect(report.context.scenario).toBe("normal-and-text-expansion");
  expect(
    report.findings.some(
      (f) =>
        f.scenario === "text-expansion" &&
        f.nodeId === "expand" &&
        f.ruleId === "QT02",
    ),
  ).toBe(true);
  expect(await stored(page)).toBe(before);
  await page.locator('[data-righttab="properties"]').click();
  await page.locator('[data-prop="name"]').fill("Edited");
  await page.locator('[data-prop="name"]').press("Tab");
  await page.locator('[data-righttab="audit"]').click();
  await expect(page.locator("[data-quality-status]")).toHaveAttribute(
    "data-audit-stale",
    "true",
  );
});

test("isolated size comparison triggers the actual breakpoint and leaves the editable canvas untouched", async ({
  page,
}, info) => {
  await open(page);
  const before = await stored(page);
  await page.locator('[data-node="responsive"]').click();
  const live = page.locator(
    '[data-artboard="first"] [data-node-id="responsive"]',
  );
  await expect(live).toHaveCSS("width", "80px");
  await page.locator("#quality-scope").selectOption("selection");
  await page.locator("#quality-widthMode").selectOption("matrix");
  await run(page);
  const report = await download(page);
  expect(report.context.widthMode).toBe("matrix");
  expect(
    report.coverage.map((c) => [c.width, c.measuredWidth, c.status]),
  ).toEqual([
    [390, 390, "measured"],
    [768, 768, "measured"],
    [1440, 1440, "measured"],
  ]);
  expect(
    report.findings
      .filter((f) => f.ruleId === "QI01")
      .map((f) => [f.width, f.evidence.rect.w]),
  ).toEqual([[390, 36]]);
  await expect(live).toHaveCSS("width", "80px");
  await expect(page.locator("[data-quality-stage]")).toHaveCount(0);
  await expect(page.locator("#preview-width")).toHaveValue("");
  expect(await stored(page)).toBe(before);
  await page.screenshot({ path: info.outputPath("quality-size-matrix.png") });
  await page
    .locator('[data-quality-rule="QI01"][data-quality-width="390"]')
    .click();
  await expect(page.locator("#preview-width")).toHaveValue("390");
  await expect(live).toHaveCSS("width", "36px");
  await expect(page.locator('[data-prop="name"]')).toHaveValue("responsive");
  expect(await stored(page)).toBe(before);
});
