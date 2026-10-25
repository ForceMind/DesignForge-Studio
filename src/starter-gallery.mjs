import {
  clone,
  escapeHtml as esc,
  validateProject,
  renderBoard,
  exportStyles,
  effectiveTokens,
} from "./core.mjs";
import { findNode } from "./tree.mjs";

/** Original DesignForge AST recipes. No third-party HTML/CSS is loaded or executed. */
export const STARTER_ITEMS = Object.freeze(
  [
    {
      id: "primary",
      name: "主操作按钮",
      category: "buttons",
      tags: "button primary CTA 主按钮 加载",
    },
    {
      id: "outline",
      name: "描边按钮",
      category: "buttons",
      tags: "button secondary outline 次要",
    },
    {
      id: "quiet",
      name: "轻量按钮",
      category: "buttons",
      tags: "button quiet ghost 轻量",
    },
    {
      id: "confirm",
      name: "确认按钮",
      category: "buttons",
      tags: "button success confirm 确认 成功",
    },
    {
      id: "search",
      name: "搜索输入框",
      category: "inputs",
      tags: "input search 搜索",
    },
    {
      id: "email",
      name: "邮箱输入框",
      category: "inputs",
      tags: "input email 邮箱 焦点",
    },
    {
      id: "validation",
      name: "校验输入框",
      category: "inputs",
      tags: "input error validation 表单 错误",
    },
    {
      id: "notice",
      name: "提示卡片",
      category: "cards",
      tags: "card notice notification 提示 通知",
    },
    {
      id: "feature",
      name: "功能卡片",
      category: "cards",
      tags: "card feature benefit 功能 优势",
    },
    {
      id: "empty",
      name: "空状态卡片",
      category: "cards",
      tags: "card empty state 空状态",
    },
    {
      id: "step",
      name: "步骤卡片",
      category: "cards",
      tags: "card process step 流程 步骤",
    },
    {
      id: "action",
      name: "行动卡片",
      category: "cards",
      tags: "card action CTA 行动",
    },
  ].map(Object.freeze),
);
export const STARTER_CATEGORIES = Object.freeze({
  all: "全部",
  buttons: "按钮",
  inputs: "输入框",
  cards: "卡片",
});
export function findStarters(query = "", category = "all") {
  const words = String(query)
    .trim()
    .toLowerCase()
    .slice(0, 100)
    .split(/\s+/)
    .filter(Boolean);
  return STARTER_ITEMS.filter(
    (item) =>
      (category === "all" || item.category === category) &&
      words.every((w) => `${item.name} ${item.tags}`.toLowerCase().includes(w)),
  );
}
export function starterComponent(id) {
  const item = STARTER_ITEMS.find((i) => i.id === id);
  if (!item) throw Error("Unknown starter component");
  const n = (key, type, w, h, text = "", style = {}) => ({
    id: `starter-${id}-${key}`,
    name: key,
    type,
    x: 0,
    y: 0,
    w,
    h,
    text,
    style,
  });
  const button = (key, text, fill = "$primary", color = "$surface") => ({
    ...n(key, "button", 208, 48, text, {
      fill,
      color,
      radius: "$radius",
      fontSize: 16,
      fontWeight: 600,
      stroke: fill,
      strokeWidth: 1,
    }),
    states: {
      hover: { style: { opacity: 0.88 } },
      active: { style: { opacity: 0.72 } },
      focus: { style: { stroke: "$ink" } },
      disabled: { style: { opacity: 0.45 } },
      loading: { style: { opacity: 0.8 } },
    },
  });
  let root;
  if (item.category === "buttons") {
    const [text, fill, color] = {
      primary: ["开始设计", "$primary", "$surface"],
      outline: ["查看详情", "$surface", "$primary"],
      quiet: ["了解更多", "$surfaceAlt", "$ink"],
      confirm: ["确认保存", "$success", "$surface"],
    }[id];
    root = button("root", text, fill, color);
    if (id === "outline") root.style.stroke = "$primary";
  } else if (item.category === "inputs") {
    root = {
      ...n(
        "root",
        "input",
        304,
        48,
        {
          search: "搜索组件…",
          email: "输入邮箱地址",
          validation: "检查输入内容",
        }[id],
        {
          fill: "$surface",
          color: "$ink",
          stroke: "$border",
          strokeWidth: 1,
          radius: "$radius",
          fontSize: 16,
        },
      ),
      states: {
        hover: { style: { stroke: "$muted" } },
        focus: { style: { stroke: "$primary" } },
        error: { style: { stroke: "$danger" } },
        disabled: { style: { opacity: 0.5 } },
      },
    };
    if (id === "validation") root.invalid = true;
  } else {
    const copy = {
      notice: ["提示", "内容已保存在当前设备。"],
      feature: ["结构化编辑", "每个元素都可选择、修改与复用。"],
      empty: ["还没有内容", "添加第一个元素，开始整理你的想法。"],
      step: ["01 · 明确目标", "写下服务对象和要完成的主要任务。"],
      action: ["把想法变成设计", "保留你的内容，让结构与风格一起成长。"],
    }[id];
    root = {
      ...n("root", "frame", 320, id === "action" ? 248 : 168, "", {
        fill: "$surface",
        stroke: "$border",
        strokeWidth: 1,
        radius: "$radius",
      }),
      layout: {
        mode: "flex",
        direction: "column",
        gap: 12,
        padding: 24,
        align: "stretch",
      },
      children: [
        {
          ...n("title", "text", 272, 28, copy[0], {
            color: "$ink",
            fontSize: 20,
            fontWeight: 600,
          }),
          sizing: { w: "fill" },
        },
        {
          ...n("body", "text", 272, 56, copy[1], {
            color: "$muted",
            fontSize: 16,
            lineHeight: 1.5,
          }),
          sizing: { w: "fill", h: "hug" },
        },
        ...(id === "action" ? [button("cta", "开始创作")] : []),
      ],
    };
  }
  const variants = [{ id: "base", name: "默认", root }];
  if (item.category === "buttons")
    variants.push({
      id: "loading",
      name: "加载中",
      root: { ...clone(root), loading: true },
    });
  if (item.category === "inputs" && id !== "validation")
    variants.push({
      id: "error",
      name: "错误",
      root: { ...clone(root), invalid: true },
    });
  return { id: "starter-" + id, name: item.name, variants };
}
/** Reuse only an identical definition. User changes are never overwritten. */
export function insertStarter(project, boardId, itemId) {
  const next = clone(project),
    b = next.boards.find((b) => b.id === boardId);
  if (!b) throw Error("Unknown target board");
  const canonical = starterComponent(itemId);
  next.components ||= [];
  let component = next.components.find(
    (c) => JSON.stringify(c.variants) === JSON.stringify(canonical.variants),
  );
  if (!component) {
    let suffix = 1,
      id = canonical.id;
    while (next.components.some((c) => c.id === id))
      id = canonical.id + "-" + ++suffix;
    component = { ...canonical, id };
    next.components.push(component);
  }
  let count = 1,
    nodeId = "starterInstance";
  while (findNode(b, nodeId)) nodeId = "starterInstance" + ++count;
  const root = component.variants[0].root;
  const node = {
    id: nodeId,
    name: component.name,
    type: "instance",
    componentId: component.id,
    variantId: "base",
    x: 24,
    y: Math.min(24 + (count - 1) * 64, Math.max(24, b.h - root.h - 24)),
    w: root.w,
    h: root.h,
    text: "",
    style: {},
  };
  b.nodes.push(node);
  const issues = validateProject(next);
  if (issues.length) throw Error(issues[0].path + ": " + issues[0].reason);
  return { project: next, nodeId };
}
export function starterPreview(project, itemId) {
  const c = starterComponent(itemId),
    root = c.variants[0].root;
  const b = {
    id: "starterPreview",
    name: c.name,
    x: 0,
    y: 0,
    w: 360,
    h: root.h + 40,
    bg: "#F4F5F7",
    nodes: [{ ...clone(root), x: 20, y: 20 }],
  };
  // Only current validated tokens/fonts/assets and one original recipe enter this document.
  const context = {
    tokens: project.tokens,
    themes: project.themes,
    activeTheme: project.activeTheme,
    assets: project.assets || [],
    components: [],
  };
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><style>${exportStyles}body{margin:0}</style><body>${renderBoard(b, effectiveTokens(project), context)}</body></html>`;
}
export function starterCards(
  project,
  { query = "", category = "all", page = 0 } = {},
) {
  const found = findStarters(query, category),
    pages = Math.max(1, Math.ceil(found.length / 4));
  page = Math.max(0, Math.min(pages - 1, page));
  const cards = found
    .slice(page * 4, page * 4 + 4)
    .map((item) => {
      const h = starterComponent(item.id).variants[0].root.h + 40;
      return `<article class="starter-card"><div class="starter-preview" style="height:${Math.ceil(h * 0.55)}px"><iframe sandbox="" tabindex="-1" loading="lazy" title="${esc(item.name)} 本地预览" srcdoc="${esc(starterPreview(project, item.id))}" width="360" height="${h}"></iframe></div><b>${esc(item.name)}</b><button class="btn-small" data-insert-starter="${item.id}">插入组件</button></article>`;
    })
    .join("");
  return `<p class="property-help" role="status">${found.length} 项 · 第 ${page + 1}/${pages} 页 · 原生 AST</p>${cards || '<p class="property-help">未找到匹配素材，试试“按钮”或“输入框”。</p>'}<div class="button-row"><button class="btn-small" data-starter-page="${page - 1}" ${page === 0 ? "disabled" : ""}>上一页</button><button class="btn-small" data-starter-page="${page + 1}" ${page === pages - 1 ? "disabled" : ""}>下一页</button></div>`;
}
