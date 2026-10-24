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

const expansion = (page, options = {}) =>
  page.evaluate(async (options) => {
    const { auditTextExpansion } = await import("/src/browser-audit.mjs");
    return auditTextExpansion(document.querySelector(".df-board"), options);
  }, options);

test("text expansion exposes fixed-box clipping without changing original DOM or local storage", async ({
  page,
}) => {
  await fixture(
    page,
    '<div class="df-node df-text" data-node-id="tight" style="left:20px;top:20px;width:104px;height:24px;overflow:hidden;white-space:nowrap;font:20px/24px monospace">ABCDEFGH</div>',
  );
  await page.evaluate(() =>
    localStorage.setItem(
      "expansion-proof",
      JSON.stringify({ project: "unchanged", text: "ABCDEFGH" }),
    ),
  );
  const before = await page.locator(".df-board").evaluate((el) => el.outerHTML),
    storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect((await audit(page)).filter((i) => i.code === "TEXT_CLIP")).toEqual([]);
  const issues = await expansion(page);
  expect(
    issues.some((i) => i.code === "TEXT_CLIP" && i.nodeId === "tight"),
  ).toBe(true);
  expect(
    issues.every((i) => i.scenario === "text-expansion" && i.factor === 1.3),
  ).toBe(true);
  expect(await page.locator(".df-board").evaluate((el) => el.outerHTML)).toBe(
    before,
  );
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(
    storage,
  );
  await expect(page.locator("[data-text-expansion-stage]")).toHaveCount(0);
});

test("text expansion allows Flow/Hug content to grow and keeps the same CSS board width", async ({
  page,
}) => {
  await fixture(
    page,
    '<div class="df-node df-frame flow" data-node-id="flow"><div class="df-node df-text bodycopy" data-node-id="copy">Adaptive content wraps cleanly across several rows.</div></div>',
    ".df-board{width:280px;height:auto}.flow{position:relative;display:flex;flex-direction:column;width:100%;height:auto;padding:12px}.bodycopy{position:relative;width:100%;height:auto;font:20px/24px monospace;overflow-wrap:anywhere}",
  );
  const result = await page.evaluate(async () => {
    const { auditTextExpansion } = await import("/src/browser-audit.mjs"),
      main = document.querySelector(".df-board"),
      before = main.getBoundingClientRect(),
      original = Element.prototype.getBoundingClientRect;
    let rendered;
    Element.prototype.getBoundingClientRect = function () {
      const r = original.call(this);
      if (
        this.matches(".df-board") &&
        this.closest("[data-text-expansion-stage]")
      )
        rendered = { width: r.width, height: r.height };
      return r;
    };
    try {
      return {
        issues: auditTextExpansion(main),
        before: { width: before.width, height: before.height },
        rendered,
      };
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });
  expect(result.rendered.width).toBeCloseTo(result.before.width, 2);
  expect(result.rendered.height).toBeGreaterThan(result.before.height);
  expect(
    result.issues.filter((i) =>
      ["RENDER_OVERFLOW", "TEXT_CLIP", "TEXT_OVERFLOW"].includes(i.code),
    ),
  ).toEqual([]);
  await expect(page.locator("[data-text-expansion-stage]")).toHaveCount(0);
});

test("text expansion preserves rich run styles and whole emoji graphemes in text and placeholders", async ({
  page,
}) => {
  await fixture(
    page,
    '<div class="df-node df-text" data-node-id="emoji" style="left:20px;top:20px;width:500px;height:100px;font-size:20px"><span data-text-run style="font-weight:700">A👩‍💻</span><span data-text-run style="font-style:italic">🇨🇳éZ</span></div><input class="df-node df-input" data-node-id="emojiInput" placeholder="👩‍💻" style="left:20px;top:150px;width:300px;height:48px;font-size:20px">',
  );
  const before = await page.locator(".df-board").evaluate((el) => el.outerHTML);
  const result = await page.evaluate(async () => {
    const { auditTextExpansion } = await import("/src/browser-audit.mjs"),
      original = Element.prototype.getBoundingClientRect;
    let snapshot;
    Element.prototype.getBoundingClientRect = function () {
      const r = original.call(this);
      if (
        this.matches(".df-board") &&
        this.closest("[data-text-expansion-stage]")
      )
        snapshot = {
          runs: [...this.querySelectorAll("[data-text-run]")].map((el) => ({
            text: el.textContent,
            fontWeight: getComputedStyle(el).fontWeight,
            fontStyle: getComputedStyle(el).fontStyle,
          })),
          placeholder: this.querySelector("input").placeholder,
        };
      return r;
    };
    try {
      auditTextExpansion(document.querySelector(".df-board"));
      return snapshot;
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });
  expect(result.runs).toEqual([
    { text: "A👩‍💻A", fontWeight: "700", fontStyle: "normal" },
    { text: "🇨🇳éZ🇨🇳", fontWeight: "400", fontStyle: "italic" },
  ]);
  expect(result.placeholder).toBe("👩‍💻👩‍💻");
  expect(await page.locator(".df-board").evaluate((el) => el.outerHTML)).toBe(
    before,
  );
});

test("text expansion enforces clone budgets and cleans its offscreen stage even when measurement throws", async ({
  page,
}) => {
  await fixture(
    page,
    '<div class="df-node df-text" data-node-id="a" style="width:100px;height:30px">One</div><div class="df-node df-text" data-node-id="b" style="top:40px;width:100px;height:30px">Two</div><div class="df-node df-text" data-node-id="c" style="top:80px;width:100px;height:30px">Three</div>',
  );
  const limited = await expansion(page, { maxNodes: 2 });
  expect(limited).toHaveLength(1);
  expect(limited[0]).toMatchObject({
    code: "AUDIT_LIMIT",
    scenario: "text-expansion",
    factor: 1.3,
  });
  await expect(page.locator("[data-text-expansion-stage]")).toHaveCount(0);
  const before = await page.locator(".df-board").evaluate((el) => el.outerHTML);
  const message = await page.evaluate(async () => {
    const { auditTextExpansion } = await import("/src/browser-audit.mjs"),
      original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this.closest("[data-text-expansion-stage]"))
        throw Error("forced clone measurement failure");
      return original.call(this);
    };
    try {
      auditTextExpansion(document.querySelector(".df-board"));
      return "not thrown";
    } catch (e) {
      return e.message;
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });
  expect(message).toBe("forced clone measurement failure");
  await expect(page.locator("[data-text-expansion-stage]")).toHaveCount(0);
  expect(await page.locator(".df-board").evaluate((el) => el.outerHTML)).toBe(
    before,
  );
});

test("localized long-content Studio exports retain real boundaries at 390, 768 and 1440px under expansion", async ({
  page,
}) => {
  const p = structuredClone(studio),
    translations = {
      Brand: "FORGE / 团队设计空间",
      "Page title": "为下一次团队协作与跨端设计留出更多空间。",
      Footer:
        "本地优先设计 · 可复用组件 · 多语言长内容演示 · 修改后仍保留人工布局",
      Detail: "正在由团队成员审阅，预计下一个工作日完成设计确认",
      Context: "演示数据 · 本月及跨地区团队协作进度",
      "Section heading": "设计规范与发布前质量检查",
      Label: "移动端新用户引导与账号验证流程",
      Projects: "团队协作设计项目",
      "Tasks completed": "本月已完成设计任务",
      "Review queue": "待处理设计审查任务",
      "Action label": "创建协作项目",
    };
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type === "text" && translations[node.name]) {
        node.text = translations[node.name];
        delete node.textRuns;
      }
      if (node.children) walk(node.children);
    }
  };
  for (const board of p.boards) walk(board.nodes);
  for (const component of p.components)
    for (const variant of component.variants) walk([variant.root]);
  await page.goto("/src/browser-audit.mjs");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.setContent(standaloneHtml({ ...p.boards[0], w: width }, p));
    await page.evaluate(() => document.fonts.ready);
    const measured = await audit(page),
      stressed = await expansion(page);
    expect(
      measured.filter((i) => ["RENDER_OVERFLOW", "TEXT_CLIP"].includes(i.code)),
      `localized baseline at ${width}px`,
    ).toEqual([]);
    expect(
      stressed.filter((i) => ["RENDER_OVERFLOW", "TEXT_CLIP"].includes(i.code)),
      `localized +30% at ${width}px`,
    ).toEqual([]);
    const limits = await page.locator(".df-board").evaluate((el) => {
      const b = el.getBoundingClientRect();
      return [...el.querySelectorAll(".df-node")]
        .filter((n) => getComputedStyle(n).display !== "none")
        .map((n) => {
          const r = n.getBoundingClientRect();
          return {
            left: r.left - b.left,
            top: r.top - b.top,
            right: r.right - b.left,
            bottom: r.bottom - b.top,
            w: b.width,
            h: b.height,
          };
        });
    });
    expect(
      limits.every(
        (r) =>
          r.left >= -1 &&
          r.top >= -1 &&
          r.right <= r.w + 1 &&
          r.bottom <= r.h + 1,
      ),
    ).toBe(true);
    await expect(page.locator("[data-text-expansion-stage]")).toHaveCount(0);
  }
});

test("hanging pre-wrap spaces stay clean while real unbroken text overflow remains visible to the audit", async ({
  page,
}) => {
  await fixture(
    page,
    '<div class="df-node df-text whitespace" data-node-id="wrap">AAAA AAAA AAAA    </div><div class="df-node df-text longword" data-node-id="long">ABCDEFGHIJKLMNOPQRSTUV</div>',
    ".whitespace{left:20px;top:20px;width:114px;height:auto;white-space:pre-wrap;font:20px/24px monospace;overflow-wrap:anywhere}.longword{left:20px;top:180px;width:114px;height:24px;white-space:nowrap;font:20px/24px monospace;overflow:visible}",
  );
  const issues = await audit(page);
  expect(
    issues.filter(
      (i) =>
        i.nodeId === "wrap" && ["TEXT_OVERFLOW", "TEXT_CLIP"].includes(i.code),
    ),
  ).toEqual([]);
  expect(
    issues.some((i) => i.nodeId === "long" && i.code === "TEXT_OVERFLOW"),
  ).toBe(true);
  const stressed = await expansion(page);
  expect(
    stressed.filter(
      (i) =>
        i.nodeId === "wrap" && ["TEXT_OVERFLOW", "TEXT_CLIP"].includes(i.code),
    ),
  ).toEqual([]);
  expect(
    stressed.some((i) => i.nodeId === "long" && i.code === "TEXT_OVERFLOW"),
  ).toBe(true);
});
