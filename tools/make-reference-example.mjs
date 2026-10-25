/** Original, reproducible reference-mechanism demo; no copied brand, CSS or claims. */
import fs from "node:fs";
import { newProject, validateProject } from "../src/core.mjs";
import { STARTER_ITEMS, insertStarter } from "../src/starter-gallery.mjs";
import { exportDesignLibrary } from "../src/design-library.mjs";

let p = newProject("Launch · 设计简报与交互组件"),
  seq = 0;
p.id = "launch-workshop";
p.updatedAt = "2026-10-25T12:00:00.000Z";
p.tokens = {
  ...p.tokens,
  primary: "#2454CE",
  primarySoft: "#EBF0FF",
  ink: "#17233A",
  muted: "#536176",
  border: "#D7DFE9",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F6FA",
  radius: 12,
  spacing: 16,
};
p.themes = {
  night: {
    primary: "#9DB8FF",
    primarySoft: "#233452",
    ink: "#ECF1FA",
    muted: "#B3BED1",
    border: "#3B4960",
    surface: "#172235",
    surfaceAlt: "#101927",
  },
};
p.designBrief = {
  version: 1,
  product: "DesignForge Studio",
  audience: "需要结构化编辑与 AI 协作的界面设计师",
  outcome: "把可复用的设计结构与精确修改流程保留在本地工程",
  primaryAction: "打开本地项目并开始设计",
  evidence:
    "本仓库的可编辑示例、单元测试与 GitHub Actions 浏览器验收记录；不添加未经核实的业务指标。",
  constraints:
    "保留当前 Token 字族和用户人工编辑。当前没有内置模型请求、在线素材市场或真实表单提交。",
  profile: "product",
  sections: ["hero", "benefits", "product", "process", "action"],
};
const b = (id, name, x, h, nodes = []) => ({
  id,
  name,
  x,
  y: 60,
  w: 1440,
  h,
  bg: "#FFFFFF",
  autoHeight: true,
  nodes,
});
p.boards = [b("landing", "产品创作 · 1440 / 768 / 390", 0, 1400)];
const instances = {};
for (const item of STARTER_ITEMS) {
  const result = insertStarter(p, "landing", item.id);
  p = result.project;
  instances[item.id] = p.boards[0].nodes.at(-1);
}
const node = (name, type, w, h, text = "", style = {}) => ({
  id: "launch" + ++seq,
  name,
  type,
  x: 0,
  y: 0,
  w,
  h,
  text,
  style,
});
const text = (name, value, size = 16) => ({
  ...node(name, "text", 800, size * 1.5, value, {
    color: "$ink",
    fontSize: size,
    fontWeight: size >= 28 ? 650 : 400,
    lineHeight: 1.4,
  }),
  sizing: { w: "fill", h: "hug" },
});
const frame = (name, children, layout = {}, style = {}) => ({
  ...node(name, "frame", 1312, 400, "", style),
  layout: { mode: "flex", direction: "column", gap: 16, padding: 0, ...layout },
  sizing: { w: "fill", h: "hug" },
  children,
});
const button = structuredClone(instances.primary);
button.id = "launchPrimaryAction";
button.x = 0;
button.y = 0;
const hero = frame(
  "首屏与行动",
  [
    text("产品标签", "LOCAL FIRST · DESIGNFORGE STUDIO", 14),
    {
      ...text("主标题", "从想法到界面，\n每一步都可以继续编辑。", 60),
      responsive: [{ maxWidth: 600, changes: { style: { fontSize: 36 } } }],
    },
    text(
      "产品说明",
      "结构化图层、可复用组件与精确 Patch，让设计和 AI 协作回到同一份项目。",
      20,
    ),
    button,
  ],
  { gap: 24, padding: 40 },
  { fill: "$surfaceAlt", radius: "$radius" },
);
hero.responsive = [{ maxWidth: 600, changes: { layout: { padding: 24 } } }];
const benefit = (title, copy) =>
  frame(
    title,
    [text(title, title, 24), text("说明", copy)],
    { padding: 24 },
    { fill: "$surface", stroke: "$border", strokeWidth: 1, radius: "$radius" },
  );
const benefits = frame(
  "任务与收益",
  [
    benefit("结构可理解", "图层与布局是可编辑数据；组件实例保持关联。"),
    benefit("修改有边界", "读取当前哈希，再以最小 Patch 修改指定元素。"),
    benefit("交互可验证", "在画布中预览状态，在真实浏览器中检查导出。"),
  ],
  { mode: "grid", columns: 3, gap: 24 },
);
benefits.responsive = [{ maxWidth: 900, changes: { layout: { columns: 1 } } }];
const form = frame(
  "真实组件展示",
  [
    text("展示标题", "交互原语，直接成为设计结构。", 30),
    text(
      "展示说明",
      "选择第二张画板中的组件；打开源副本即可编辑 Hover、Focus、加载和错误状态。输入框是原型只读控件。",
    ),
    {
      ...structuredClone(instances.email),
      id: "launchEmail",
      x: 0,
      y: 0,
      sizing: { w: "fill" },
    },
  ],
  { gap: 20, padding: 32 },
  { fill: "$surfaceAlt", radius: "$radius" },
);
const process = frame(
  "操作流程",
  [
    text("流程标题", "先明确目标，再逐步完成。", 30),
    text(
      "流程正文",
      "01 写下服务对象与主要行动\n02 插入原生组件并编辑布局\n03 预览状态，导出上下文并审核 Patch\n04 运行浏览器检查，保留真实验收证据",
      18,
    ),
  ],
  { padding: 24 },
);
const action = frame(
  "下一步行动",
  [
    text("行动标题", "打开一个项目，开始精确设计。", 36),
    text(
      "行动说明",
      "此示例展示设计结构与状态；按钮尚未绑定页面跳转或业务请求。",
    ),
    { ...structuredClone(button), id: "launchFinalAction" },
  ],
  { padding: 32, gap: 24 },
  { fill: "$primarySoft", radius: "$radius" },
);
const root = frame(
  "Landing 主布局",
  [hero, benefits, form, process, action],
  { padding: 64, gap: 48 },
  { fill: "$surface" },
);
root.responsive = [
  { maxWidth: 600, changes: { layout: { padding: 24, gap: 32 } } },
];
p.boards[0].nodes = [root];
const cards = STARTER_ITEMS.map((item) => {
  const instance = structuredClone(instances[item.id]);
  instance.x = 0;
  instance.y = 0;
  instance.sizing = { w: "fill" };
  return frame(
    item.name,
    [text("素材名称", item.name, 16), instance],
    { padding: 20, gap: 16 },
    { fill: "$surfaceAlt", radius: "$radius" },
  );
});
const grid = frame("素材布局", cards, { mode: "grid", columns: 3, gap: 24 });
grid.responsive = [
  { maxWidth: 1000, changes: { layout: { columns: 2 } } },
  { maxWidth: 600, changes: { layout: { columns: 1 } } },
];
const workshop = frame(
  "交互素材工作台",
  [
    text("工作台标题", "12 个原生组件，继续设计。", 36),
    text(
      "工作台说明",
      "按钮与输入框具有可编辑状态；实际加载会禁用按钮，错误输入会保留 aria-invalid。所有配方使用项目 Tokens。",
    ),
    grid,
  ],
  { padding: 48, gap: 32 },
  { fill: "$surface" },
);
workshop.responsive = [{ maxWidth: 600, changes: { layout: { padding: 24 } } }];
p.boards.push(
  b("workshop", "交互组件 · 可编辑源与状态", 1540, 1100, [workshop]),
);
const issues = validateProject(p);
if (issues.length) throw Error(JSON.stringify(issues));
fs.writeFileSync(
  new URL("../examples/Launch.project.json", import.meta.url),
  JSON.stringify(p, null, 2) + "\n",
);
fs.writeFileSync(
  new URL("../examples/Starters.library.json", import.meta.url),
  JSON.stringify(
    exportDesignLibrary(p, { name: "DesignForge 原生素材精选" }),
    null,
    2,
  ) + "\n",
);
console.log("Wrote Launch (2 editable boards) and Starters design library");
