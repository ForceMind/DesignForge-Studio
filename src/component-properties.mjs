import { escapeHtml, resolveToken, validFontValue } from "./core.mjs";
import { flattenNodes, findNode, isNodeLocked } from "./tree.mjs";

const textTypes = new Set(["text", "button", "pill", "input"]);
const surfaceTypes = new Set([
  "rect",
  "text",
  "button",
  "pill",
  "input",
  "frame",
  "group",
  "component",
  "image",
]);
const labels = {
  text: "文字 Text",
  fill: "填充 Fill",
  color: "颜色 Color",
  stroke: "描边 Stroke",
  strokeWidth: "描边宽度 Stroke width",
  radius: "圆角 Radius",
  fontSize: "字号 Font size",
  fontWeight: "字重 Font weight",
  fontFamily: "字体 Font family",
  align: "对齐 Align",
  opacity: "透明度 Opacity",
  letterSpacing: "字距 Letter spacing",
  lineHeight: "行高 Line height",
};
const defaults = {
  fill: "",
  color: "#202238",
  stroke: "none",
  strokeWidth: 1,
  radius: 0,
  fontSize: 16,
  fontWeight: 500,
  fontFamily: "$fontFamily",
  align: "left",
  opacity: 1,
  letterSpacing: 0,
  lineHeight: 1.35,
};
const ranges = {
  strokeWidth: [0, 20],
  radius: [0, 200],
  fontSize: [8, 180],
  fontWeight: [100, 900],
  opacity: [0, 1],
  letterSpacing: [-3, 20],
  lineHeight: [0.8, 4],
};
const validSourceId = (id) =>
  typeof id === "string" &&
  /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(id) &&
  !["constructor", "prototype", "__proto__"].includes(id);
const styleKeys = new Set(Object.keys(defaults));

function sourceFields(node) {
  const fields = ["style.opacity"];
  if (surfaceTypes.has(node.type) || node.type === "circle")
    fields.push("style.fill", "style.stroke", "style.strokeWidth");
  if (surfaceTypes.has(node.type)) fields.push("style.radius");
  if (textTypes.has(node.type))
    fields.push(
      "text",
      "style.color",
      "style.fontSize",
      "style.fontWeight",
      "style.fontFamily",
      "style.align",
      "style.letterSpacing",
      "style.lineHeight",
    );
  if (node.type === "image") fields.push("text");
  if (node.type === "icon") fields.push("style.color");
  if (node.type === "line") fields.push("style.stroke", "style.strokeWidth");
  return fields;
}
function variantFor(instance, project) {
  if (instance?.type !== "instance") throw Error("Select a component instance");
  const component = project.components?.find(
    (c) => c.id === instance.componentId,
  );
  const variant = component?.variants?.find((v) => v.id === instance.variantId);
  if (!variant?.root) throw Error("Unknown component variant");
  return variant;
}
function sourceFor(instance, project, sourceId, field) {
  if (instance?.locked) throw Error("Locked component instance");
  if (!validSourceId(sourceId)) throw Error("Invalid component source ID");
  const variant = variantFor(instance, project);
  const board = { nodes: [variant.root] };
  const source = findNode(board, sourceId);
  if (!source || source === variant.root)
    throw Error("Unknown editable component source");
  if (isNodeLocked(board, sourceId)) throw Error("Locked component source");
  if (!sourceFields(source).includes(field))
    throw Error("Unsupported component property");
  return source;
}
function fieldInfo(field) {
  if (field === "text") return { key: field, text: true };
  if (!field?.startsWith("style.") || !styleKeys.has(field.slice(6)))
    throw Error("Unsupported component property");
  return { key: field.slice(6), text: false };
}
function normalizeValue(project, field, value) {
  const { key, text } = fieldInfo(field);
  if (text) {
    if (typeof value !== "string" || value.length > 10000)
      throw Error("Text must be at most 10000 characters");
    return value;
  }
  if (typeof value !== "string" && typeof value !== "number")
    throw Error("Invalid component value");
  let result = typeof value === "string" ? value.trim() : value;
  const token =
    typeof result === "string" && /^\$[a-zA-Z][a-zA-Z0-9]*$/.test(result);
  if (ranges[key] && !token) {
    if (
      result === "" ||
      (typeof result === "string" &&
        !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(result))
    )
      throw Error("Expected number or numeric token");
    result = Number(result);
  }
  const palettes = [
    project.tokens || {},
    ...Object.values(project.themes || {}).map((t) => ({
      ...project.tokens,
      ...t,
    })),
  ];
  for (const palette of palettes) {
    const resolved = resolveToken(result, palette);
    if (["fill", "color", "stroke"].includes(key)) {
      if (
        result !== "" &&
        !(key === "stroke" && result === "none") &&
        !(
          typeof resolved === "string" &&
          /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
            resolved,
          )
        )
      )
        throw Error("Expected hex color or color token");
    } else if (key === "fontFamily") {
      if (!validFontValue(project, resolved))
        throw Error("Expected supported font, local font asset or font token");
    } else if (key === "align") {
      if (!["left", "center", "right"].includes(result))
        throw Error("Unsupported alignment");
    } else {
      const [min, max] = ranges[key];
      if (!Number.isFinite(resolved) || resolved < min || resolved > max)
        throw Error(`Expected numeric token or ${min}–${max}`);
    }
  }
  return result;
}
/** Change one instance property without touching definitions or sibling overrides. */
export function applyComponentProperty(
  instance,
  project,
  sourceId,
  field,
  value,
) {
  sourceFor(instance, project, sourceId, field);
  const normalized = normalizeValue(project, field, value),
    { key, text } = fieldInfo(field);
  const next = structuredClone(instance.overrides || {}),
    override = next[sourceId] || {};
  if (text) override.text = normalized;
  else override.style = { ...(override.style || {}), [key]: normalized };
  next[sourceId] = override;
  instance.overrides = next;
  return instance;
}
/** Pass project to enforce source/ancestor locks in addition to the instance lock. */
export function resetComponentProperty(instance, sourceId, field, project) {
  if (instance?.type !== "instance") throw Error("Select a component instance");
  if (instance.locked) throw Error("Locked component instance");
  if (!validSourceId(sourceId)) throw Error("Invalid component source ID");
  const { key, text } = fieldInfo(field);
  if (project) sourceFor(instance, project, sourceId, field);
  const override = instance.overrides?.[sourceId];
  if (
    !override ||
    !(text
      ? Object.hasOwn(override, key)
      : Object.hasOwn(override.style || {}, key))
  )
    throw Error("No component override to reset");
  const next = structuredClone(instance.overrides);
  if (text) delete next[sourceId].text;
  else {
    delete next[sourceId].style[key];
    if (!Object.keys(next[sourceId].style).length) delete next[sourceId].style;
  }
  if (!Object.keys(next[sourceId]).length) delete next[sourceId];
  instance.overrides = next;
  return instance;
}
/** Safe inspector HTML; component roots are edited through instance properties. */
export function componentPropertiesMarkup(instance, project) {
  let variant;
  try {
    variant = variantFor(instance, project);
  } catch {
    return '<p class="property-help">组件变体不可用。</p>';
  }
  const entries = flattenNodes([variant.root]),
    board = { nodes: [variant.root] },
    esc = escapeHtml;
  const hasHiddenAncestor = (id) => {
    let node = findNode(board, id);
    while (node) {
      if (node.hidden) return true;
      node = entries.find((e) => e.node.id === node.id)?.parent;
    }
    return false;
  };
  const editable = entries.filter((e) => e.depth > 0);
  return `<section class="component-properties"><div class="panel-section-title">实例属性 <small>${editable.length} 个源图层</small></div><p class="property-help">仅覆盖当前实例。恢复按钮删除该字段覆盖，重新继承组件；隐藏图层仍可修改，锁定源图层只读。根容器使用上方实例属性。</p>${
    editable
      .map(({ node, depth }, index) => {
        const override = instance.overrides?.[node.id] || {},
          locked = isNodeLocked(board, node.id),
          hidden = hasHiddenAncestor(node.id);
        const disabled = locked ? " disabled" : "";
        const controls = sourceFields(node)
          .map((field) => {
            const { key, text } = fieldInfo(field),
              hasOverride = text
                ? Object.hasOwn(override, key)
                : Object.hasOwn(override.style || {}, key);
            const value = hasOverride
              ? text
                ? override.text
                : override.style[key]
              : text
                ? node.text
                : (node.style?.[key] ?? defaults[key]);
            const attrs = `data-component-source="${esc(node.id)}" data-component-field="${field}" aria-label="${esc(node.name || node.id)} · ${labels[key]}"${disabled}`;
            const input =
              key === "align"
                ? `<select ${attrs}>${[
                    ["left", "左 Left"],
                    ["center", "中 Center"],
                    ["right", "右 Right"],
                  ]
                    .map(
                      ([v, label]) =>
                        `<option value="${v}"${value === v ? " selected" : ""}>${label}</option>`,
                    )
                    .join("")}</select>`
                : `<input type="text" ${attrs} value="${esc(value)}"${text ? ` data-instance-text="${esc(node.id)}" maxlength="10000"` : ""}>`;
            return `<div class="singlefield"><label>${labels[key]}${hasOverride ? " · 已覆盖" : " · 继承"}</label>${input}${hasOverride ? `<button type="button" class="btn-small" data-component-reset="${field}" data-component-source="${esc(node.id)}"${disabled}>恢复继承</button>` : ""}</div>`;
          })
          .join("");
        return `<details data-component-entry="${esc(node.id)}"${index === 0 || Object.keys(override).length ? " open" : ""}><summary>${esc(node.name || node.type)} <small>· ${esc(node.type)}${hidden ? " · 隐藏" : ""}${locked ? " · 锁定" : ""}</small></summary><div class="selection-id">#${esc(node.id)} · 深度 ${depth}</div>${controls}</details>`;
      })
      .join("") || '<p class="property-help">此变体没有可覆盖的后代图层。</p>'
  }</section>`;
}
