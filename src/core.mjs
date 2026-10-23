import { validateAssets } from "./assets.mjs";
import {
  CONTAINERS,
  flattenNodes,
  findNode,
  locateNode,
  subtreeIds,
  moveNode,
  isNodeLocked,
} from "./tree.mjs";
/** DesignForge's original, dependency-free project protocol / renderer. */
export const FORMAT = "designforge.project";
export const VERSION = 1;
export const NODE_TYPES = new Set([
  "rect",
  "circle",
  "text",
  "button",
  "pill",
  "line",
  "icon",
  "input",
  "frame",
  "group",
  "component",
  "instance",
  "image",
]);
export const TOKEN_KEYS = [
  "primary",
  "primarySoft",
  "surface",
  "surfaceAlt",
  "canvas",
  "ink",
  "muted",
  "border",
  "success",
  "warning",
  "danger",
];
export const ICONS = {
  sparkle:
    '<path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z"/><path d="m19 16 .65 2.35L22 19l-2.35.65L19 22l-.65-2.35L16 19l2.35-.65L19 16Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 5-5 4 3 5-7"/>',
  layers:
    '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  wallet:
    '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18"/><path d="M16 14h2"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19 13.5c.1-.5.1-2.5 0-3l2-1.5-2-3.5-2.5 1c-.7-.6-1.2-.9-2-1L14 2h-4l-.5 2.5c-.8.1-1.4.4-2 1l-2.5-1L3 8l2 1.5a9 9 0 0 0 0 3L3 14l2 3.5 2.5-1c.7.6 1.2.9 2 1L10 20h4l.5-2.5c.8-.1 1.4-.4 2-1l2.5 1 2-3.5-2-1.5Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M4 12h16m-7-7 7 7-7 7"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  bolt: '<path d="m13 2-9 11h7l-1 9 10-12h-7V2Z"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  send: '<path d="m3 12 18-9-4 18-5-6-5 4 1-7Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
};
const TOKENS_DEFAULT = {
  primary: "#5C4ACF",
  primarySoft: "#EEEAFE",
  surface: "#FFFFFF",
  surfaceAlt: "#F7F8FB",
  canvas: "#F3F5F9",
  ink: "#202238",
  muted: "#848A9E",
  border: "#E4E7F0",
  success: "#13734F",
  warning: "#F4B754",
  danger: "#E16C70",
  radius: 14,
  fontFamily: "system-ui",
};
export const DEFAULT_TOKENS = Object.freeze(TOKENS_DEFAULT);
export const clone = (value) => structuredClone(value);
export const isObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export const escapeHtml = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const clamp = (v, min, max, fallback = min) =>
  Number.isFinite(Number(v))
    ? Math.min(max, Math.max(min, Number(v)))
    : fallback;
const safeColor = (value) =>
  typeof value === "string" &&
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
    value,
  )
    ? value
    : null;
export function resolveToken(value, tokens, seen = new Set()) {
  if (typeof value !== "string" || !value.startsWith("$")) return value;
  const key = value.slice(1);
  if (!Object.hasOwn(tokens, key) || seen.has(key)) return undefined;
  return resolveToken(tokens[key], tokens, new Set([...seen, key]));
}
export function effectiveTokens(project) {
  return {
    ...project.tokens,
    ...(project.themes?.[project.activeTheme] || {}),
  };
}
const cssColor = (value, tokens, fallback = "#000000") =>
  safeColor(resolveToken(value, tokens)) || fallback;
const scalar = (value, tokens, fallback = 0) =>
  Number.isFinite(resolveToken(value, tokens))
    ? resolveToken(value, tokens)
    : fallback;
const num = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);
const px = (v) => `${Math.round(num(v) * 100) / 100}px`;
const round = (v) => Math.round(num(v) * 10) / 10;
export function newProject(title = "Untitled project") {
  return {
    format: FORMAT,
    version: VERSION,
    id: "project-" + Date.now().toString(36),
    title,
    tokens: clone(DEFAULT_TOKENS),
    boards: [],
    comments: [],
    updatedAt: new Date().toISOString(),
  };
}
export function validId(id) {
  return typeof id === "string" && /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(id);
}
export function validateProject(project) {
  const issues = [];
  const error = (path, reason) =>
    issues.push({ severity: "error", path, reason });
  if (!isObject(project)) {
    error("root", "Project must be an object");
    return issues;
  }
  if (project.format !== FORMAT || project.version !== VERSION)
    error("format", "Unsupported project format/version");
  if (typeof project.title !== "string" || !project.title.trim())
    error("title", "Project title required");
  function checkTokens(tokens, path) {
    if (!isObject(tokens)) {
      error(path, "Design tokens object required");
      return;
    }
    if (Object.keys(tokens).length > 200) error(path, "At most 200 tokens");
    for (const [key, value] of Object.entries(tokens)) {
      if (
        !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) ||
        ["constructor", "prototype", "__proto__"].includes(key)
      )
        error(path + "." + key, "Unsafe token name");
      const resolved = resolveToken(value, tokens);
      if (key === "fontFamily") {
        if (
          ![
            "system-ui",
            "ui-sans-serif",
            "Georgia",
            "Verdana",
            "Arial",
          ].includes(resolved) &&
          !(
            typeof resolved === "string" &&
            resolved.startsWith("asset:") &&
            Array.isArray(project.assets) &&
            project.assets.some(
              (a) => a?.type === "font" && a.id === resolved.slice(6),
            )
          )
        )
          error(path + ".fontFamily", "Unsupported font stack");
      } else if (TOKEN_KEYS.includes(key)) {
        if (!safeColor(resolved))
          error(path + "." + key, "Expected hex color or resolvable alias");
      } else if (!(
        safeColor(resolved) ||
        (Number.isFinite(resolved) && resolved >= 0 && resolved <= 3200)
      ))
        error(path + "." + key, "Expected color, number or resolvable alias");
    }
    for (const key of TOKEN_KEYS)
      if (!safeColor(resolveToken(tokens[key], tokens)))
        error(path + "." + key, "Missing color token");
    const radius = resolveToken(tokens.radius, tokens);
    if (!Number.isFinite(radius) || radius < 0 || radius > 100)
      error(path + ".radius", "Must be between 0 and 100");
    if (!tokens.fontFamily) error(path + ".fontFamily", "Font required");
  }
  for (const reason of validateAssets(project.assets)) error("assets", reason);
  checkTokens(project.tokens, "tokens");
  if (project.themes !== undefined) {
    if (!isObject(project.themes) || Object.keys(project.themes).length > 12)
      error("themes", "Expected up to 12 theme maps");
    else
      for (const [key, value] of Object.entries(project.themes)) {
        if (!validId(key) || !isObject(value))
          error("themes." + key, "Invalid theme");
        else checkTokens({ ...project.tokens, ...value }, "themes." + key);
      }
    if (
      project.activeTheme &&
      !Object.hasOwn(project.themes, project.activeTheme)
    )
      error("activeTheme", "Unknown theme");
  }
  if (
    !Array.isArray(project.boards) ||
    project.boards.length < 1 ||
    project.boards.length > 24
  ) {
    error("boards", "Require 1–24 boards");
    return issues;
  }
  let globalIds = new Set();
  for (const [i, board] of project.boards.entries()) {
    let p = `boards[${i}]`;
    if (!isObject(board)) {
      error(p, "Board must be an object");
      continue;
    }
    if (!validId(board.id) || globalIds.has(board.id))
      error(p + ".id", "Invalid or duplicate ID");
    globalIds.add(board.id);
    if (typeof board.name !== "string" || !board.name.trim())
      error(p + ".name", "Board name required");
    if (!safeColor(board.bg)) error(p + ".bg", "Board background must be hex");
    if (!(
      Number.isFinite(board.w) &&
      board.w >= 280 &&
      board.w <= 2400 &&
      Number.isFinite(board.h) &&
      board.h >= 280 &&
      board.h <= 3200
    ))
      error(p + ".size", "Board dimensions out of range");
    if (!Number.isFinite(board.x) || !Number.isFinite(board.y))
      error(p + ".position", "Board position must be numeric");
    if (board.autoHeight !== undefined && typeof board.autoHeight !== "boolean")
      error(p + ".autoHeight", "Auto height requires one root container");
    if (!Array.isArray(board.nodes) || board.nodes.length > 500) {
      error(p + ".nodes", "Expected <= 500 nodes");
      continue;
    }
    validateNodes(board.nodes, p + ".nodes", new Set(), 0, { count: 0 });
  }
  if (project.components !== undefined) {
    if (!Array.isArray(project.components) || project.components.length > 100)
      error("components", "Expected up to 100 components");
    else {
      const componentIds = new Set();
      for (const [i, c] of project.components.entries()) {
        const path = `components[${i}]`;
        if (
          !isObject(c) ||
          !validId(c.id) ||
          componentIds.has(c.id) ||
          typeof c.name !== "string" ||
          !Array.isArray(c.variants) ||
          !c.variants.length ||
          c.variants.length > 20
        ) {
          error(path, "Invalid component");
          continue;
        }
        componentIds.add(c.id);
        const variants = new Set();
        for (const [j, v] of c.variants.entries()) {
          if (!isObject(v) || !validId(v.id) || variants.has(v.id)) {
            error(path + ".variants", "Invalid variant");
            continue;
          }
          variants.add(v.id);
          validateNodes(
            [v.root],
            `${path}.variants[${j}].root`,
            new Set(),
            0,
            { count: 0 },
            true,
          );
        }
      }
    }
  }
  function validateNodes(nodes, path, ids, depth, total, definition = false) {
    if (depth > 20) {
      error(path, "Nesting limit is 20");
      return;
    }
    for (const [j, node] of nodes.entries()) {
      const n = `${path}[${j}]`;
      if (++total.count > 500) {
        error(path, "Expected <= 500 nodes including descendants");
        return;
      }
      if (!isObject(node)) {
        error(n, "Node must be an object");
        continue;
      }
      if (!validId(node.id) || ids.has(node.id))
        error(n + ".id", "Invalid or duplicate node ID");
      ids.add(node.id);
      if (!NODE_TYPES.has(node.type))
        error(n + ".type", "Unsupported element type");
      if (
        ![node.x, node.y, node.w, node.h].every((v) => Number.isFinite(v)) ||
        node.w < 1 ||
        node.h < 1 ||
        node.w > 2400 ||
        node.h > 3200
      )
        error(n + ".bounds", "Invalid element bounds");
      if (node.hidden !== undefined && typeof node.hidden !== "boolean")
        error(n + ".hidden", "Expected boolean");
      if (node.locked !== undefined && typeof node.locked !== "boolean")
        error(n + ".locked", "Expected boolean");
      if (!isObject(node.style)) error(n + ".style", "Style object required");
      if (typeof node.text !== "string" || node.text.length > 10000)
        error(n + ".text", "Expected text up to 10000 chars");
      if (node.children !== undefined) {
        if (!CONTAINERS.has(node.type) || !Array.isArray(node.children))
          error(n + ".children", "Only containers may have children");
        else
          validateNodes(
            node.children,
            n + ".children",
            ids,
            depth + 1,
            total,
            definition,
          );
      }
      if (node.layout !== undefined) checkLayout(node.layout, n + ".layout");
      if (
        node.sizing !== undefined &&
        (!isObject(node.sizing) ||
          Object.entries(node.sizing).some(
            ([k, v]) =>
              !["w", "h"].includes(k) || !["fixed", "fill", "hug"].includes(v),
          ))
      )
        error(n + ".sizing", "Invalid sizing");
      if (
        node.constraints !== undefined &&
        (!isObject(node.constraints) ||
          Object.entries(node.constraints).some(([k, v]) =>
            ["referenceW", "referenceH"].includes(k)
              ? !Number.isFinite(v) || v < 1
              : !["horizontal", "vertical"].includes(k) ||
                !["start", "end", "center", "stretch", "scale"].includes(v),
          ))
      )
        error(n + ".constraints", "Invalid constraints");
      if (node.responsive !== undefined) {
        if (!Array.isArray(node.responsive) || node.responsive.length > 8)
          error(n + ".responsive", "Expected <= 8 breakpoint overrides");
        else
          for (const r of node.responsive) {
            if (
              !isObject(r) ||
              !Number.isFinite(r.maxWidth) ||
              r.maxWidth < 280 ||
              r.maxWidth > 2400 ||
              !isObject(r.changes) ||
              Object.keys(r.changes).some(
                (k) =>
                  !["w", "h", "layout", "sizing", "style", "hidden"].includes(
                    k,
                  ),
              )
            ) {
              error(n + ".responsive", "Invalid breakpoint");
              continue;
            }
            if (r.changes.layout)
              checkLayout(r.changes.layout, n + ".responsive.layout");
            const changed = { ...node, ...r.changes };
            delete changed.responsive;
            delete changed.children;
            validateNodes(
              [changed],
              n + ".responsive.changes",
              new Set(),
              depth + 1,
              { count: 0 },
              definition,
            );
          }
      }
      if (
        node.type === "image" &&
        (!Array.isArray(project.assets) ||
          !project.assets.some(
            (a) => a?.id === node.assetId && a.type === "image",
          ))
      )
        error(n + ".assetId", "Unknown image asset");
      if (node.type === "instance") {
        if (definition) {
          error(n, "Component definitions cannot contain instances");
          continue;
        }
        const c =
          Array.isArray(project.components) &&
          project.components.find((c) => c?.id === node.componentId);
        const variant = Array.isArray(c?.variants)
          ? c.variants.find((v) => v?.id === node.variantId)
          : null;
        if (!variant) error(n + ".componentId", "Unknown component/variant");
        if (node.overrides !== undefined) {
          if (!isObject(node.overrides))
            error(n + ".overrides", "Expected override map");
          else
            for (const [id, changes] of Object.entries(node.overrides)) {
              if (
                !variant ||
                !isObject(variant.root) ||
                !findNode({ nodes: [variant.root] }, id) ||
                !isObject(changes) ||
                Object.keys(changes).some(
                  (k) => !["text", "style"].includes(k),
                ) ||
                (changes.text !== undefined &&
                  typeof changes.text !== "string") ||
                (changes.style !== undefined &&
                  (!isObject(changes.style) ||
                    Object.keys(changes.style).some(
                      (k) => !editStyleKeys.has(k),
                    )))
              )
                error(n + ".overrides", "Invalid instance override");
            }
        }
      }
    }
  }
  function checkLayout(layout, path) {
    const keys = [
      "mode",
      "direction",
      "gap",
      "padding",
      "align",
      "justify",
      "columns",
      "wrap",
    ];
    if (
      !isObject(layout) ||
      Object.keys(layout).some((k) => !keys.includes(k)) ||
      !["absolute", "flex", "grid"].includes(layout.mode)
    ) {
      error(path, "Invalid layout");
      return;
    }
    for (const k of ["gap", "padding"])
      if (layout[k] !== undefined) {
        const value = resolveToken(layout[k], effectiveTokens(project));
        if (!Number.isFinite(value) || value < 0 || value > 500)
          error(path + "." + k, "Expected spacing token or 0–500");
      }
    if (
      layout.direction !== undefined &&
      !["row", "column"].includes(layout.direction)
    )
      error(path + ".direction", "Invalid direction");
    if (
      layout.align !== undefined &&
      !["start", "center", "end", "stretch"].includes(layout.align)
    )
      error(path + ".align", "Invalid alignment");
    if (
      layout.justify !== undefined &&
      !["start", "center", "end", "space-between"].includes(layout.justify)
    )
      error(path + ".justify", "Invalid distribution");
    if (
      layout.columns !== undefined &&
      (!Number.isInteger(layout.columns) ||
        layout.columns < 1 ||
        layout.columns > 24)
    )
      error(path + ".columns", "Expected 1–24 columns");
    if (layout.wrap !== undefined && typeof layout.wrap !== "boolean")
      error(path + ".wrap", "Expected boolean");
  }

  if (!Array.isArray(project.comments) || project.comments.length > 1000)
    error("comments", "Expected <= 1000 comments");
  else
    for (const [i, c] of project.comments.entries()) {
      if (
        !isObject(c) ||
        !validId(c.id) ||
        !globalIds.has(c.boardId) ||
        typeof c.text !== "string" ||
        c.text.length > 10000 ||
        (c.nodeId != null &&
          (!validId(c.nodeId) ||
            !findNode(
              project.boards.find((b) => b.id === c.boardId),
              c.nodeId,
            )))
      )
        error(`comments[${i}]`, "Invalid comment");
    }
  return issues;
}
export function contrastRatio(first, second) {
  function rgb(hex) {
    let s = hex.replace("#", "");
    if (s.length === 3)
      s = s
        .split("")
        .map((c) => c + c)
        .join("");
    if (s.length > 6) s = s.slice(0, 6);
    return [0, 2, 4]
      .map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  }
  const brightness = (x) => {
    let [r, g, b] = rgb(x);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = brightness(first),
    b = brightness(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function auditProject(project) {
  const findings = [];
  const problem = (severity, boardId, node, code, message) =>
    findings.push({
      severity,
      boardId,
      nodeId: node?.id || null,
      code,
      message,
    });
  for (const board of project.boards || []) {
    for (const { node, parent } of flattenNodes(board.nodes || [])) {
      const flow = parent?.layout?.mode && parent.layout.mode !== "absolute";
      const bounds = parent || board;
      if (node.locked) continue;
      if (
        !flow &&
        (node.x < 0 ||
          node.y < 0 ||
          node.x + node.w > bounds.w + 1 ||
          node.y + node.h > bounds.h + 1)
      )
        problem(
          "warning",
          board.id,
          node,
          "OVERFLOW",
          "Element extends outside artboard",
        );
      if (
        ["button", "input"].includes(node.type) &&
        (node.w < 44 || node.h < 44)
      )
        problem(
          "warning",
          board.id,
          node,
          "TOUCH_TARGET",
          "Interactive element smaller than 44×44 px",
        );
      if (["text", "pill", "button", "input"].includes(node.type)) {
        const size = num(node.style?.fontSize, 16);
        if (size < 12)
          problem("warning", board.id, node, "TEXT_SIZE", "Text is below 12px");
        // Comparison uses declared fill, not backdrop inferred from scene geometry.
        const foreground = cssColor(
          node.style?.color,
          effectiveTokens(project),
          "#202238",
        );
        const background = cssColor(
          node.style?.fill,
          effectiveTokens(project),
          board.bg,
        );
        if (
          node.style?.fill &&
          contrastRatio(foreground, background) < (size >= 24 ? 3 : 4.5)
        )
          problem(
            "warning",
            board.id,
            node,
            "CONTRAST",
            "Declared foreground/background contrast below WCAG AA",
          );
      }
      if (node.type === "icon" && !Object.hasOwn(ICONS, node.icon || ""))
        problem(
          "warning",
          board.id,
          node,
          "ICON",
          "Unknown icon; generic fallback will appear",
        );
    }
  }
  return findings;
}
export function hashProject(p) {
  const s = JSON.stringify(p);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function requireString(v, name) {
  if (typeof v !== "string" || v.length > 10000)
    throw Error(name + " must be a string");
  return v;
}
const editableKeys = new Set([
  "name",
  "text",
  "x",
  "y",
  "w",
  "h",
  "locked",
  "icon",
  "hidden",
  "sizing",
  "constraints",
  "responsive",
  "variantId",
  "overrides",
  "assetId",
]);
const editStyleKeys = new Set([
  "fill",
  "color",
  "stroke",
  "strokeWidth",
  "radius",
  "fontSize",
  "fontWeight",
  "align",
  "opacity",
  "letterSpacing",
]);
function getBoard(project, id) {
  const b = project.boards.find((x) => x.id === id);
  if (!b) throw Error("Unknown board " + id);
  return b;
}
function getNode(board, id) {
  const n = findNode(board, id);
  if (!n) throw Error("Unknown node " + id);
  return n;
}
export function applyPatch(project, patch) {
  if (
    !isObject(patch) ||
    patch.format !== "designforge.patch" ||
    patch.version !== 1 ||
    !Array.isArray(patch.ops) ||
    patch.ops.length > 100
  )
    throw Error("Invalid patch");
  if (
    typeof patch.baseHash !== "string" ||
    !/^[0-9a-f]{8}$/.test(patch.baseHash)
  )
    throw Error(
      "Patch requires a valid baseHash; read the current project first",
    );
  if (hashProject(project) !== patch.baseHash)
    throw Error(
      "Patch conflict: baseHash does not match; re-read current project before editing",
    );
  const next = clone(project);
  for (const op of patch.ops) {
    if (!isObject(op)) throw Error("Patch operation must be an object");
    const fields = new Map([
      ["set-node", ["kind", "boardId", "nodeId", "changes"]],
      ["add-node", ["kind", "boardId", "parentId", "node"]],
      ["remove-node", ["kind", "boardId", "nodeId"]],
      ["move-node", ["kind", "boardId", "nodeId", "parentId", "index"]],
      ["set-token", ["kind", "key", "value"]],
      ["rename-board", ["kind", "boardId", "name"]],
    ]);
    if (!fields.has(op.kind)) throw Error("Unsupported patch kind " + op.kind);
    if (Object.keys(op).some((k) => !fields.get(op.kind).includes(k)))
      throw Error("Unsafe operation fields");
    if (op.kind === "set-node") {
      const board = getBoard(next, op.boardId),
        n = getNode(board, op.nodeId);
      if (
        isNodeLocked(board, n.id) &&
        !(
          op.changes?.locked === false &&
          Object.keys(op.changes).length === 1 &&
          !isNodeLocked(board, n.id, true)
        )
      )
        throw Error("Locked layer");
      if (!isObject(op.changes)) throw Error("changes object required");
      for (const [key, value] of Object.entries(op.changes)) {
        if (["layout", "sizing", "constraints"].includes(key)) {
          if (!isObject(value)) throw Error("Expected " + key + " object");
          n[key] = { ...n[key], ...clone(value) };
        } else if (key === "style") {
          if (
            !isObject(value) ||
            Object.keys(value).some((k) => !editStyleKeys.has(k))
          )
            throw Error("Unsafe style keys");
          n.style = { ...n.style, ...clone(value) };
        } else if (editableKeys.has(key)) n[key] = clone(value);
        else throw Error("Property not editable: " + key);
      }
    } else if (op.kind === "add-node") {
      const b = getBoard(next, op.boardId);
      if (!isObject(op.node) || findNode(b, op.node.id))
        throw Error("Invalid/duplicate node");
      const parent = op.parentId ? getNode(b, op.parentId) : null;
      if (parent && isNodeLocked(b, parent.id)) throw Error("Locked layer");
      if (parent && !CONTAINERS.has(parent.type))
        throw Error("Parent must be container");
      (parent ? (parent.children ||= []) : b.nodes).push(clone(op.node));
    } else if (op.kind === "remove-node") {
      const b = getBoard(next, op.boardId);
      const entry = locateNode(b, op.nodeId);
      if (!entry) throw Error("Unknown node");
      const removed = subtreeIds(entry.node);
      if (
        isNodeLocked(b, entry.node.id) ||
        flattenNodes([entry.node]).some((e) => e.node.locked)
      )
        throw Error("Locked layer");
      entry.siblings.splice(entry.siblings.indexOf(entry.node), 1);
      next.comments = next.comments.filter(
        (c) => c.boardId !== b.id || !removed.includes(c.nodeId),
      );
    } else if (op.kind === "move-node") {
      moveNode(getBoard(next, op.boardId), op.nodeId, op.parentId, op.index);
    } else if (op.kind === "set-token") {
      if (!Object.hasOwn(next.tokens, op.key)) throw Error("Unsupported token");
      next.tokens[op.key] = op.value;
    } else if (op.kind === "rename-board") {
      getBoard(next, op.boardId).name = requireString(op.name, "name");
    } else throw Error("Unsupported patch kind " + op.kind);
  }
  next.updatedAt = new Date().toISOString();
  const issues = validateProject(next);
  if (issues.length)
    throw Error(
      "Patch rejected by validation: " +
        issues.map((i) => i.path + ": " + i.reason).join("; "),
    );
  return next;
}
function colorStyle(node, tokens, board, parent = board) {
  const s = node.style || {};
  const parts = [
    `position:absolute`,
    `left:${px(node.x)}`,
    `top:${px(node.y)}`,
    `width:${px(node.w)}`,
    `height:${px(node.h)}`,
    "box-sizing:border-box",
    `opacity:${clamp(s.opacity ?? 1, 0, 1, 1)}`,
  ];
  const fill = s.fill ? cssColor(s.fill, tokens, "transparent") : "transparent";
  if (fill !== "transparent") parts.push(`background:${fill}`);
  if (s.stroke && s.stroke !== "none")
    parts.push(
      `border:${clamp(s.strokeWidth ?? 1, 0, 20, 1)}px solid ${cssColor(s.stroke, tokens, "#000000")}`,
    );
  const radius = resolveToken(s.radius, tokens);
  if (Number.isFinite(radius))
    parts.push(`border-radius:${px(clamp(radius, 0, 200))}`);
  if (node.type === "circle") parts.push("border-radius:50%");
  if (["text", "button", "pill", "input"].includes(node.type)) {
    parts.push(
      `color:${cssColor(s.color, tokens, "#202238")}`,
      `font-size:${px(clamp(scalar(s.fontSize, tokens, 16), 8, 180, 16))}`,
      `font-weight:${clamp(scalar(s.fontWeight, tokens, 500), 100, 900, 500)}`,
      `letter-spacing:${px(clamp(scalar(s.letterSpacing, tokens, 0), -3, 20, 0))}`,
      `text-align:${["left", "center", "right"].includes(s.align) ? s.align : "left"}`,
    );
    parts.push(
      `font-family:${resolveToken(tokens.fontFamily, tokens) === "Georgia" ? "Georgia,serif" : resolveToken(tokens.fontFamily, tokens) === "Verdana" ? "Verdana,sans-serif" : resolveToken(tokens.fontFamily, tokens) === "Arial" ? "Arial,sans-serif" : "system-ui,-apple-system,BlinkMacSystemFont,sans-serif"}`,
    );
    if (
      typeof resolveToken(tokens.fontFamily, tokens) === "string" &&
      /^asset:asset[a-zA-Z0-9_-]{1,64}$/.test(
        resolveToken(tokens.fontFamily, tokens),
      )
    )
      parts.push(
        `font-family:df-${resolveToken(tokens.fontFamily, tokens).slice(6)},system-ui,sans-serif`,
      );
    parts.push("white-space:pre-wrap", "overflow-wrap:anywhere");
  }
  parts.push(layoutStyle(node, tokens, parent));
  return parts.join(";");
}
/** CSS is generated exclusively from enumerations and bounded numbers. */
function layoutStyle(node, tokens, parent) {
  const p = [],
    l = node.layout || {},
    flow = parent.layout?.mode && parent.layout.mode !== "absolute";
  if (parent.autoHeight && parent.nodes?.length === 1)
    p.push("position:relative");
  if (flow)
    p.push(
      "position:relative",
      "left:auto",
      "top:auto",
      "flex-shrink:0",
      "min-width:0",
      "min-height:0",
    );
  if (node.sizing?.w === "fill")
    p.push(
      "width:100%",
      flow && parent.layout.direction === "row" && parent.layout.mode === "flex"
        ? "flex:1 1 0"
        : "",
    );
  if (node.sizing?.h === "fill")
    p.push(
      "height:100%",
      flow && parent.layout.mode === "flex" && parent.layout.direction !== "row"
        ? "flex:1 1 0"
        : "",
    );
  if (node.sizing?.w === "hug") p.push("width:max-content", "max-width:100%");
  if (node.sizing?.h === "hug") p.push("height:auto", "min-height:1px");
  if (!flow)
    for (const [axis, pos, size, extent] of [
      ["horizontal", "left", "width", "w"],
      ["vertical", "top", "height", "h"],
    ]) {
      const rule = node.constraints?.[axis],
        start = axis === "horizontal" ? node.x : node.y,
        baseline =
          node.constraints?.[
            axis === "horizontal" ? "referenceW" : "referenceH"
          ] || parent[extent];
      if (rule === "end")
        p.push(
          `${pos}:auto`,
          `${axis === "horizontal" ? "right" : "bottom"}:${px(baseline - start - node[extent])}`,
        );
      if (rule === "center")
        p.push(`${pos}:calc(50% + ${px(start - baseline / 2)})`);
      if (rule === "stretch")
        p.push(`${size}:calc(100% - ${px(baseline - node[extent])})`);
      if (rule === "scale")
        p.push(
          `${pos}:${(start / baseline) * 100}%`,
          `${size}:${(node[extent] / baseline) * 100}%`,
        );
    }
  if (l.mode === "flex" || l.mode === "grid") {
    p.push(
      `display:${l.mode}`,
      `gap:${px(clamp(scalar(l.gap, tokens), 0, 500))}`,
      `padding:${px(clamp(scalar(l.padding, tokens), 0, 500))}`,
      `align-items:${{ start: "flex-start", end: "flex-end", center: "center", stretch: "stretch" }[l.align] || "flex-start"}`,
      `justify-content:${{ start: "flex-start", end: "flex-end", center: "center", "space-between": "space-between" }[l.justify] || "flex-start"}`,
    );
    if (l.mode === "flex")
      p.push(
        `flex-direction:${l.direction === "row" ? "row" : "column"}`,
        `flex-wrap:${l.wrap ? "wrap" : "nowrap"}`,
      );
    else
      p.push(
        `grid-template-columns:repeat(${Math.round(clamp(l.columns ?? 2, 1, 24))},minmax(0,1fr))`,
      );
  }
  if (node.hidden) p.push("display:none");
  return p.filter(Boolean).join(";");
}
export function materializeInstance(instance, project) {
  const c = project.components?.find((c) => c.id === instance.componentId),
    v = c?.variants.find((v) => v.id === instance.variantId);
  if (!v) return { ...instance, type: "frame", children: [] };
  const root = clone(v.root);
  for (const { node } of flattenNodes([root])) {
    const changes = instance.overrides?.[node.id];
    if (changes?.text !== undefined) node.text = changes.text;
    if (changes?.style) node.style = { ...node.style, ...changes.style };
    node.$sourceId = node.id;
  }
  return {
    ...root,
    ...instance,
    type: "frame",
    layout: instance.layout || root.layout,
    children: root.children || [],
    style: { ...root.style, ...instance.style },
    $sourceId: undefined,
  };
}
function responsiveStyles(board, tokens) {
  const rules = [];
  for (const { node, parent } of flattenNodes(board.nodes))
    for (const r of [...(node.responsive || [])].sort(
      (a, b) => b.maxWidth - a.maxWidth,
    )) {
      const effective = {
        ...node,
        ...r.changes,
        style: { ...node.style, ...r.changes.style },
      };
      const css = colorStyle(effective, tokens, board, parent || board)
        .split(";")
        .filter(Boolean)
        .map((s) => s + "!important")
        .join(";");
      rules.push(
        `@container (max-width:${px(r.maxWidth)}){[data-board-id="${escapeHtml(board.id)}"] [${node.$sourceId ? "data-source-id" : "data-node-id"}="${escapeHtml(node.id)}"]{${css}}}`,
      );
    }
  return rules.length ? `<style>${rules.join("")}</style>` : "";
}
export function renderNode(
  node,
  board,
  tokens,
  parent = board,
  project = null,
) {
  if (!NODE_TYPES.has(node.type)) node = { ...node, type: "rect" };
  if (node.type === "instance" && project)
    node = materializeInstance(node, project);
  const st = escapeHtml(colorStyle(node, tokens, board, parent));
  const content = CONTAINERS.has(node.type)
    ? (node.children || [])
        .map((n) => renderNode(n, board, tokens, node, project))
        .join("")
    : escapeHtml(node.text || "");
  const wrap = `<div class="df-node df-${node.type}" ${node.$sourceId ? "data-source-id" : "data-node-id"}="${escapeHtml(node.id)}" style="${st}">${content}</div>`;
  if (node.type === "image") {
    const asset = validateAssets(project?.assets).length
      ? null
      : project?.assets?.find((a) => a.id === node.assetId);
    return `<img class="df-node df-image" data-node-id="${escapeHtml(node.id)}" alt="${escapeHtml(node.text)}" src="${escapeHtml(asset?.data || "")}" style="${st};object-fit:contain" draggable="false" />`;
  }
  if (node.type === "button")
    return `<button type="button" class="df-node df-button" ${node.$sourceId ? "data-source-id" : "data-node-id"}="${escapeHtml(node.id)}" style="${st}">${content}</button>`;
  if (node.type === "input")
    return `<input class="df-node df-input" aria-label="${content}" ${node.$sourceId ? "data-source-id" : "data-node-id"}="${escapeHtml(node.id)}" style="${st}" placeholder="${content}" readonly />`;
  if (node.type === "icon")
    return `<div class="df-node df-icon" ${node.$sourceId ? "data-source-id" : "data-node-id"}="${escapeHtml(node.id)}" style="${st}"><svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="${cssColor(node.style?.color, tokens, "#202238")}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${Object.hasOwn(ICONS, node.icon) ? ICONS[node.icon] : ICONS.grid}</svg></div>`;
  if (node.type === "line")
    return `<div class="df-node df-line" ${node.$sourceId ? "data-source-id" : "data-node-id"}="${escapeHtml(node.id)}" style="${st};border-top:${clamp(node.style?.strokeWidth ?? 1, 1, 10, 1)}px solid ${cssColor(node.style?.stroke, tokens, "#E4E7F0")}"></div>`;
  return wrap;
}
export const exportStyles = `*{box-sizing:border-box}body{margin:0}.df-board{position:relative;overflow:hidden;margin:0 auto}.df-node{margin:0;padding:0}.df-button,.df-pill{display:flex;align-items:center;justify-content:center;cursor:pointer;border:0}.df-input{padding:0 14px;outline:0}.df-icon{display:flex;align-items:center;justify-content:center}.df-icon svg{width:100%;height:100%}.df-text{line-height:1.35}.df-line{pointer-events:none}`;
export function renderBoard(board, tokens, project = null) {
  const auto =
    board.autoHeight &&
    board.nodes.length === 1 &&
    CONTAINERS.has(board.nodes[0].type);
  const assets = validateAssets(project?.assets).length
    ? []
    : project?.assets || [];
  if (project) project = { ...project, assets };
  const fonts = assets
    .filter((a) => a.type === "font")
    .map(
      (a) =>
        `@font-face{font-family:df-${a.id};src:url("${a.data}");font-display:swap}`,
    )
    .join("");
  return `${fonts ? `<style>${fonts}</style>` : ""}<main class="df-board" data-board-id="${escapeHtml(board.id)}" style="container-type:inline-size;width:${px(board.w)};max-width:100%;height:${auto ? "auto" : px(board.h)};${auto ? `min-height:${px(board.h)};padding-bottom:${px(Math.max(0, board.nodes[0]?.y || 0) * 2)};` : ""}background:${safeColor(board.bg) || "#FFFFFF"}">${board.nodes.map((n) => renderNode(n, board, tokens, board, project)).join("")}</main>${responsiveStyles(board, tokens)}`;
}
export function standaloneHtml(board, project) {
  const title = escapeHtml(`${board.name} – ${project.title}`);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${exportStyles}body{background:#e8eaf0;overflow:auto}.df-board{box-shadow:0 18px 70px #1b21401a;margin:40px auto}</style></head><body>${renderBoard(board, effectiveTokens(project), project)}</body></html>`;
}
export function exportIndexHtml(project) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.title)}</title><style>body{font:16px system-ui;background:#f4f5f9;color:#232639;max-width:780px;margin:80px auto;padding:24px}a{display:block;padding:20px;background:white;border:1px solid #e4e6ec;border-radius:14px;margin:16px 0;color:#6958e8;text-decoration:none}</style></head><body><h1>${escapeHtml(project.title)}</h1><p>Static artboard exports • DesignForge Studio</p>${project.boards.map((b, i) => `<a href="board-${i + 1}.html">${escapeHtml(b.name)} (${b.w} × ${b.h}) →</a>`).join("")}</body></html>`;
}
/** Human-readable, deterministic node-level diff for reviewing agent edits. */
export function diffProjects(before, after) {
  const changes = [];
  const oldTokens = before.tokens || {},
    newTokens = after.tokens || {};
  for (const k of new Set([
    ...Object.keys(oldTokens),
    ...Object.keys(newTokens),
  ]))
    if (JSON.stringify(oldTokens[k]) !== JSON.stringify(newTokens[k]))
      changes.push({
        kind: "token",
        key: k,
        before: oldTokens[k],
        after: newTokens[k],
      });
  for (const key of ["themes", "activeTheme", "components", "assets"])
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      changes.push({
        kind: "system-changed",
        key,
        before: before[key],
        after: after[key],
      });
  const oldBoards = new Map(before.boards.map((b) => [b.id, b]));
  const newBoards = new Map(after.boards.map((b) => [b.id, b]));
  for (const [id, board] of oldBoards)
    if (!newBoards.has(id))
      changes.push({ kind: "board-removed", boardId: id, name: board.name });
  for (const [id, board] of newBoards) {
    const previous = oldBoards.get(id);
    if (!previous) {
      changes.push({ kind: "board-added", boardId: id, name: board.name });
      continue;
    }
    for (const field of ["x", "y", "w", "h", "bg", "autoHeight"])
      if (JSON.stringify(previous[field]) !== JSON.stringify(board[field]))
        changes.push({
          kind: "board-changed",
          boardId: id,
          field,
          before: previous[field],
          after: board[field],
        });
    if (previous.name !== board.name)
      changes.push({
        kind: "board-renamed",
        boardId: id,
        before: previous.name,
        after: board.name,
      });
    const olds = new Map(
      flattenNodes(previous.nodes).map(({ node: n, parent, siblings }) => [
        n.id,
        {
          ...n,
          children: undefined,
          $parent: parent?.id || null,
          $order: siblings.indexOf(n),
        },
      ]),
    );
    const news = new Map(
      flattenNodes(board.nodes).map(({ node: n, parent, siblings }) => [
        n.id,
        {
          ...n,
          children: undefined,
          $parent: parent?.id || null,
          $order: siblings.indexOf(n),
        },
      ]),
    );
    for (const [nodeId, n] of olds)
      if (!news.has(nodeId))
        changes.push({
          kind: "node-removed",
          boardId: id,
          nodeId,
          name: n.name,
        });
    for (const [nodeId, n] of news) {
      const old = olds.get(nodeId);
      if (!old) {
        changes.push({ kind: "node-added", boardId: id, nodeId, name: n.name });
        continue;
      }
      const keys = [
        "name",
        "text",
        "x",
        "y",
        "w",
        "h",
        "locked",
        "icon",
        "style",
        "layout",
        "sizing",
        "constraints",
        "responsive",
        "componentId",
        "variantId",
        "overrides",
        "assetId",
        "hidden",
        "$parent",
        "$order",
      ];
      for (const key of keys) {
        if (JSON.stringify(old[key]) !== JSON.stringify(n[key]))
          changes.push({
            kind: "node-changed",
            boardId: id,
            nodeId,
            name: n.name,
            field: key,
            before: old[key],
            after: n[key],
          });
      }
    }
  }
  return changes;
}
