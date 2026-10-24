import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { standaloneHtml } from "../../src/core.mjs";
const studio = JSON.parse(
  fs.readFileSync(
    new URL("../../examples/Studio.project.json", import.meta.url),
  ),
);
async function fixture(page, body, css = "") {
  await page.goto("/src/browser-audit.mjs");
  await page.setContent(
    `<style>*{box-sizing:border-box}body{margin:0;font:16px Arial}.df-board{position:relative;width:600px;height:400px;overflow:hidden}.df-node{position:absolute}.df-text{white-space:pre-wrap;line-height:1.2} ${css}</style><main class="df-board" data-board-id="qa">${body}</main>`,
  );
  await page.evaluate(() => document.fonts.ready);
}
const audit = (page, options = {}) =>
  page.evaluate(async (options) => {
    const { auditRenderedBoard } = await import("/src/browser-audit.mjs");
    return auditRenderedBoard(document.querySelector(".df-board"), options);
  }, options);
test("browser audit measures nested border overflow and ignores hidden ancestors", async ({
  page,
}) => {
  await fixture(
    page,
    `<div class="df-node df-frame" data-node-id="frame" style="left:20px;top:20px;width:120px;height:120px;border:4px solid;overflow:hidden"><div class="df-node df-rect" data-node-id="outside" style="left:110px;top:20px;width:40px;height:40px"></div></div><div class="df-node df-frame" data-node-id="invisible" style="opacity:0"><button class="df-node df-button" data-node-id="hiddenButton" style="left:-99px;top:-99px;width:10px;height:10px">Hidden</button></div><div class="df-node df-rect" data-node-id="displayNone" style="display:none;left:-20px;width:20px;height:20px"></div>`,
  );
  const issues = await audit(page);
  expect(
    issues.filter((i) => i.code === "RENDER_OVERFLOW").map((i) => i.nodeId),
  ).toEqual(["outside"]);
  expect(issues.find((i) => i.nodeId === "outside").evidence.bounds).toEqual({
    x: 24,
    y: 24,
    w: 112,
    h: 112,
  });
  expect(
    issues.some((i) =>
      ["hiddenButton", "invisible", "displayNone"].includes(i.nodeId),
    ),
  ).toBe(false);
});
test("browser audit distinguishes visible rich-text overflow from real ancestor clipping and native input clipping", async ({
  page,
}) => {
  await fixture(
    page,
    `<div class="df-node df-text" data-node-id="rich" style="left:20px;top:20px;width:90px;height:20px;overflow:hidden;font-size:18px">Short <span style="font-size:28px;font-weight:700">a long rich text segment</span></div><div class="df-node df-text" data-node-id="visible" style="left:20px;top:100px;width:160px;height:10px;font-size:24px;white-space:nowrap">Visible glyphs</div><input class="df-node df-input" data-node-id="input" placeholder="A long readonly placeholder" readonly style="left:350px;top:160px;width:80px;height:30px;padding:4px;font:16px Arial"><button class="df-node df-button" data-node-id="small" style="left:450px;top:300px;width:30px;height:30px">OK</button>`,
  );
  const issues = await audit(page);
  expect(
    issues.some((i) => i.code === "TEXT_CLIP" && i.nodeId === "rich"),
  ).toBe(true);
  expect(
    issues.some((i) => i.code === "TEXT_OVERFLOW" && i.nodeId === "visible"),
  ).toBe(true);
  expect(
    issues.some((i) => i.code === "TEXT_CLIP" && i.nodeId === "input"),
  ).toBe(true);
  expect(
    issues
      .filter((i) => i.code === "TOUCH_TARGET")
      .map((i) => i.nodeId)
      .sort(),
  ).toEqual(["input", "small"]);
});
test("browser collision evidence is advisory and excludes backgrounds, containers and icons", async ({
  page,
}) => {
  await fixture(
    page,
    `<div class="df-node df-rect" data-node-id="surface" style="inset:0;width:600px;height:400px"></div><div class="df-node df-rect" data-node-id="one" style="left:230px;top:20px;width:80px;height:80px"></div><div class="df-node df-rect" data-node-id="two" style="left:270px;top:60px;width:80px;height:80px"></div><div class="df-node df-icon" data-node-id="icon" style="left:245px;top:40px;width:80px;height:80px"></div><div class="df-node df-frame" data-node-id="frame" style="left:250px;top:35px;width:100px;height:100px"></div>`,
  );
  const issues = (await audit(page)).filter((i) => i.code === "COLLISION");
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    severity: "warning",
    nodeId: "one",
    relatedNodeId: "two",
    evidence: { overlap: { x: 270, y: 60, w: 40, h: 40 } },
  });
  expect(issues[0].message).toContain("intentional");
});
test("instance source findings target the editable owner, and editor zoom does not shrink touch CSS units", async ({
  page,
}) => {
  await fixture(
    page,
    `<div class="df-node df-frame" data-node-id="instance" style="left:20px;top:20px;width:180px;height:100px;overflow:hidden"><div class="df-node df-text" data-source-id="sourceTitle" style="left:0;top:0;width:80px;height:10px;font-size:24px;overflow:hidden">A projected title</div></div><button class="df-node df-button" data-node-id="large" style="left:300px;top:200px;width:50px;height:50px">OK</button><button class="df-node df-button" data-node-id="small" style="left:400px;top:200px;width:30px;height:30px">OK</button>`,
    `.df-board{transform:scale(.5);transform-origin:0 0}`,
  );
  const issues = await audit(page, { scale: 0.5 });
  expect(
    issues.some(
      (i) =>
        i.code === "TEXT_CLIP" &&
        i.nodeId === "instance" &&
        i.sourceId === "sourceTitle",
    ),
  ).toBe(true);
  expect(issues.some((i) => i.nodeId === "sourceTitle")).toBe(false);
  expect(
    issues.filter((i) => i.code === "TOUCH_TARGET").map((i) => i.nodeId),
  ).toEqual(["small"]);
  expect(issues.find((i) => i.code === "TOUCH_TARGET").rect.w).toBe(30);
});
test("browser audit reads responsive Flex reflow and changed content without mutating rendered DOM", async ({
  page,
}) => {
  const body = `<div class="df-node df-frame layout" data-node-id="layout"><button class="df-node df-button action" data-node-id="actionOne">One</button><button class="df-node df-button action" data-node-id="actionTwo">Two</button></div>`;
  const css = `.df-board{width:100%;height:auto}.layout{position:relative;display:flex;gap:16px;padding:12px;width:100%;height:auto}.action{position:relative;min-width:160px;min-height:48px;height:auto;flex:1;overflow-wrap:anywhere;white-space:normal;padding:10px;font:16px/20px Arial}@media(max-width:300px){.layout{flex-direction:column}.action{width:100%}}`;
  await fixture(page, body, css);
  for (const width of [600, 240]) {
    await page.setViewportSize({ width, height: 600 });
    await page.locator('[data-node-id="actionTwo"]').evaluate((el) => {
      el.textContent =
        "Updated multi-language content — 内容更长，layout should grow.";
    });
    const before = await page
      .locator(".df-board")
      .evaluate((el) => el.outerHTML);
    const issues = await audit(page);
    expect(
      issues.filter((i) =>
        ["RENDER_OVERFLOW", "TEXT_CLIP", "COLLISION"].includes(i.code),
      ),
    ).toEqual([]);
    expect(await page.locator(".df-board").evaluate((el) => el.outerHTML)).toBe(
      before,
    );
  }
});
test("Studio exports produce bounded, serializable evidence at mobile and desktop sizes", async ({
  page,
}) => {
  await page.goto("/src/browser-audit.mjs");
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(
      standaloneHtml({ ...studio.boards[0], w: width }, studio),
    );
    await page.evaluate(() => document.fonts.ready);
    const issues = await audit(page, { maxFindings: 40 });
    expect(issues.length).toBeLessThanOrEqual(40);
    expect(
      issues.every(
        (i) =>
          i.boardId === studio.boards[0].id &&
          typeof i.message === "string" &&
          i.severity === "warning",
      ),
    ).toBe(true);
    expect(JSON.stringify(issues)).not.toContain('null,"w":null');
  }
});
