import {
  INTERACTION_STATES,
  STATE_STYLE_FIELDS,
} from "./interaction-states.mjs";
import { escapeHtml as esc, materializeInstance } from "./core.mjs";

export const STATE_LABELS = {
  default: "默认",
  hover: "悬停 Hover",
  active: "按下 Active",
  focus: "键盘焦点 Focus",
  error: "错误 Error",
  disabled: "禁用 Disabled",
  loading: "加载 Loading",
};
export function interactionControls(node, project, view = {}) {
  const rendered =
    node.type === "instance" ? materializeInstance(node, project) : node;
  if (!["button", "input"].includes(rendered.type)) return "";
  const edit = INTERACTION_STATES.includes(view.edit) ? view.edit : "hover";
  const flags = [
    "disabled",
    rendered.type === "button" ? "loading" : "invalid",
  ];
  return `<details class="state-inspector" open><summary>交互状态 <small>全局 · 所有断点</small></summary><p class="property-help">预览只改变画布。保存的状态样式覆盖普通外观；几何尺寸保持不变。输入框仍为原型只读。</p><div class="singlefield"><label for="state-preview">画布状态预览</label><select id="state-preview">${["default", ...INTERACTION_STATES].map((s) => `<option value="${s}" ${s === (view.preview || "default") ? "selected" : ""}>${STATE_LABELS[s]}</option>`).join("")}</select></div><div class="singlefield"><label for="state-edit">编辑状态</label><select id="state-edit">${INTERACTION_STATES.map((s) => `<option value="${s}" ${s === edit ? "selected" : ""}>${STATE_LABELS[s]}</option>`).join("")}</select></div><div class="state-fields">${STATE_STYLE_FIELDS.map((field) => `<label>${{ fill: "填充", color: "文字", stroke: "描边", opacity: "透明度" }[field]} / $token<input data-state-field="${field}" data-state-name="${edit}" aria-label="${STATE_LABELS[edit]} ${field}" placeholder="继承普通样式" value="${esc(node.states?.[edit]?.style?.[field] ?? "")}"></label>`).join("")}</div><button class="btn-small" data-reset-state="${edit}">重置此状态覆盖</button>${node.type === "instance" ? '<p class="property-help">空值恢复组件源状态；修改源定义请打开组件源副本。</p>' : ""}<div class="state-flags">${flags.map((flag) => `<label>${{ disabled: "实际禁用", loading: "实际加载", invalid: "实际错误" }[flag]}<select data-state-flag="${flag}" aria-label="${flag}"><option value="" ${node[flag] === undefined ? "selected" : ""}>继承 / 默认</option><option value="true" ${node[flag] === true ? "selected" : ""}>是</option><option value="false" ${node[flag] === false ? "selected" : ""}>否</option></select></label>`).join("")}</div></details>`;
}
/** Inspector deletion is explicit; Patch state maps retain their merge-only semantics. */
export function editInteraction(
  node,
  { state, field, value, flag, reset = false },
) {
  if (flag !== undefined) {
    if (
      !["disabled", "loading", "invalid"].includes(flag) ||
      !["", "true", "false"].includes(value)
    )
      throw Error("Invalid interaction flag");
    if (value === "") delete node[flag];
    else node[flag] = value === "true";
    return;
  }
  if (!INTERACTION_STATES.includes(state)) throw Error("Invalid state");
  if (reset) {
    if (node.states) delete node.states[state];
  } else {
    if (!STATE_STYLE_FIELDS.includes(field) || typeof value !== "string")
      throw Error("Invalid state field");
    const clean = value.trim();
    if (clean === "") {
      if (node.states?.[state]) delete node.states[state].style[field];
    } else {
      node.states ||= {};
      node.states[state] ||= { style: {} };
      node.states[state].style[field] =
        field === "opacity" && !clean.startsWith("$") ? Number(clean) : clean;
    }
    if (node.states?.[state] && !Object.keys(node.states[state].style).length)
      delete node.states[state];
  }
  if (node.states && !Object.keys(node.states).length) delete node.states;
}
