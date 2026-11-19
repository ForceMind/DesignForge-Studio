import {
  TOKEN_KEYS,
  escapeHtml,
  isObject,
  resolveToken,
  validateProject,
} from "./core.mjs";

const fixed = new Set([...TOKEN_KEYS, "radius", "fontFamily"]);
const validKey = (key) =>
  typeof key === "string" &&
  /^[a-zA-Z][a-zA-Z0-9]*$/.test(key) &&
  !["constructor", "prototype", "__proto__"].includes(key);
function requireKey(key) {
  if (!validKey(key))
    throw Error("Token 名称必须以英文字母开头，仅含字母数字且不能使用保留名称");
  return key;
}
function activeTheme(project) {
  if (!project.activeTheme) return null;
  if (
    !isObject(project.themes) ||
    !Object.hasOwn(project.themes, project.activeTheme) ||
    !isObject(project.themes[project.activeTheme])
  )
    throw Error("Unknown active theme");
  return project.activeTheme;
}
function parseValue(raw) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw Error("Token 必须是有限数值");
    return raw;
  }
  if (typeof raw !== "string")
    throw Error("Token 值必须是颜色、数字、字体或 $alias");
  const value = raw.trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) ? Number(value) : value;
}
function editTokens(project, mutate) {
  const next = structuredClone(project);
  mutate(next);
  const issues = validateProject(next);
  if (issues.length)
    throw Error(
      issues
        .slice(0, 2)
        .map((i) => `${i.path}: ${i.reason}`)
        .join("\n"),
    );
  // Preserve unrelated project object identities and let the editor own timestamps/history.
  project.tokens = next.tokens;
  if (next.themes !== undefined) project.themes = next.themes;
  return project;
}
/** Add/edit a raw Token value in the selected theme or the base map, atomically. */
export function setDesignToken(project, key, raw) {
  requireKey(key);
  const theme = activeTheme(project),
    value = parseValue(raw);
  return editTokens(project, (next) => {
    const target = theme ? next.themes[theme] : next.tokens;
    target[key] = value;
  });
}
/** Delete only an explicit active-theme override and restore base inheritance. */
export function resetThemeToken(project, key) {
  requireKey(key);
  const theme = activeTheme(project);
  if (!theme || !Object.hasOwn(project.themes[theme], key))
    throw Error("当前主题没有该 Token 覆盖");
  return editTokens(project, (next) => {
    delete next.themes[theme][key];
  });
}
/** Deleting a custom base Token must leave every alias, node and theme valid. */
export function deleteDesignToken(project, key) {
  requireKey(key);
  if (activeTheme(project)) throw Error("请切换到基础 Tokens 后删除");
  if (fixed.has(key)) throw Error("不能删除必需的设计 Token");
  if (!isObject(project.tokens) || !Object.hasOwn(project.tokens, key))
    throw Error("Unknown base token");
  return editTokens(project, (next) => {
    delete next.tokens[key];
  });
}
function tokenRow(project, key, theme) {
  const base = project.tokens || {},
    overrides = theme ? project.themes[theme] : {},
    ownsOverride = Object.hasOwn(overrides, key);
  const raw = ownsOverride ? overrides[key] : base[key],
    palette = { ...base, ...overrides },
    resolved = resolveToken(raw, palette),
    esc = escapeHtml;
  return `<div class="singlefield design-token-row"><label for="design-token-${esc(key)}">${esc(key)} <small>· ${theme ? (ownsOverride ? "主题覆盖" : "继承基础") : "基础"}</small></label><input id="design-token-${esc(key)}" type="text" data-design-token="${esc(key)}" value="${esc(raw)}" aria-label="Token ${esc(key)} 原始值"><p class="property-help">解析：${esc(resolved === undefined ? "无法解析" : resolved)}</p><div class="button-row">${ownsOverride ? `<button type="button" class="btn-small" data-token-reset="${esc(key)}">恢复基础继承</button>` : ""}${!theme && !fixed.has(key) ? `<button type="button" class="btn-small danger" data-token-delete="${esc(key)}">删除未引用 Token</button>` : ""}</div></div>`;
}
/** Raw aliases stay editable; custom theme-only keys are not lost from the UI. */
export function tokenRowsMarkup(project) {
  let theme;
  try {
    theme = activeTheme(project);
  } catch {
    return '<p class="property-help">当前主题不存在，无法编辑 Token。</p>';
  }
  const keys = [
    ...new Set([
      ...Object.keys(project.tokens || {}),
      ...Object.keys(theme ? project.themes[theme] : {}),
    ]),
  ].filter(validKey);
  const extra = keys.filter((key) => !fixed.has(key));
  return `<section class="design-token-editor"><div class="divider"></div><div class="panel-section-title">颜色引用 / Alias</div><p class="property-help">文本输入保留 $alias，取色器会写入具体颜色。当前写入范围：${theme ? escapeHtml(theme) : "基础 Tokens"}。</p>${TOKEN_KEYS.filter(
    (key) => keys.includes(key),
  )
    .map((key) => tokenRow(project, key, theme))
    .join(
      "",
    )}<div class="divider"></div><div class="panel-section-title">扩展 Tokens <small>${extra.length}</small></div><p class="property-help">支持颜色、数字及 $alias。删除或恢复继承必须保持所有主题和图层引用有效；当前主题新增的 Token 也会列出。</p>${extra.map((key) => tokenRow(project, key, theme)).join("") || '<p class="property-help">暂无额外 Token；可点击“新增 Token”。</p>'}</section>`;
}
