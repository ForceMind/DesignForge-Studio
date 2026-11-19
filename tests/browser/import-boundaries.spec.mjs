import { test, expect } from "@playwright/test";
import { newProject, hashProject } from "../../src/core.mjs";
const key = "designforge.project.v1";
const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
function project() {
  const p = newProject("Import boundary workspace");
  p.boards = [
    {
      id: "work",
      name: "Work",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "label",
          name: "Keep editable",
          type: "text",
          x: 40,
          y: 40,
          w: 240,
          h: 80,
          text: "Preserve my content",
          style: { fontSize: 24, color: "$ink" },
        },
      ],
    },
  ];
  return p;
}
async function upload(page, p) {
  await page.locator("#upload-json").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
}
test("forged runtime metadata and malformed display values cannot replace the working project", async ({
  page,
}) => {
  await page.goto("/");
  await upload(page, project());
  await expect(page.locator('[data-board="work"]')).toBeVisible();
  const before = await stored(page);
  for (const mutate of [
    (p) => (p.boards[0].nodes[0].$sourceId = "forged"),
    (p) => (p.boards[0].$referenceSize = { w: 1, h: 1 }),
    (p) => (p.boards[0].nodes[0].name = { toString: "invalid" }),
  ]) {
    const p = structuredClone(before);
    mutate(p);
    await upload(page, p);
    await expect(page.locator("#toast")).toContainText("导入失败");
    expect(await stored(page)).toEqual(before);
  }
  await expect(page.locator('[data-node-id="label"]')).toContainText(
    "Preserve my content",
  );
  await expect(page.locator('[data-source-id="label"]')).toHaveCount(0);
});
test("untrusted Agent additions cannot hide editable IDs or partially apply earlier operations", async ({
  page,
}) => {
  await page.goto("/");
  await upload(page, project());
  await expect(page.locator('[data-board="work"]')).toBeVisible();
  const before = await stored(page);
  const patch = {
    format: "designforge.patch",
    version: 1,
    baseHash: hashProject(before),
    ops: [
      {
        kind: "set-node",
        boardId: "work",
        nodeId: "label",
        changes: { text: "Must never apply" },
      },
      {
        kind: "add-node",
        boardId: "work",
        node: {
          id: "forged",
          type: "rect",
          x: 20,
          y: 200,
          w: 80,
          h: 80,
          text: "",
          style: {},
          $sourceId: "hidden",
        },
      },
    ],
  };
  await page.locator("#upload-patch").setInputFiles({
    name: "malformed.patch.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(patch)),
  });
  await expect(page.locator("#toast")).toContainText("补丁被拒绝");
  expect(await stored(page)).toEqual(before);
  await expect(page.locator('[data-node-id="label"]')).toContainText(
    "Preserve my content",
  );
});
