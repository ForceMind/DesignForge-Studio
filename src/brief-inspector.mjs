import {
  BRIEF_FIELDS,
  BRIEF_PROFILES,
  BRIEF_SECTIONS,
  briefPlan,
} from "./design-brief.mjs";
import { escapeHtml as esc } from "./core.mjs";

export function briefControls(project, open = false) {
  const brief = project.designBrief || {},
    plan = briefPlan(brief);
  return `<details class="design-brief" id="design-brief-panel" ${open ? "open" : ""}><summary>项目设计简报 <small>随工程保存 · 可撤销</small></summary><p class="property-help">先明确服务对象、主要行动和已有证据，再按段落逐步设计。可选风格仅提供建议；不会改写当前字体与 Tokens。</p>${Object.entries(
    BRIEF_FIELDS,
  )
    .map(
      ([key, label]) =>
        `<div class="singlefield"><label for="brief-${key}">${label}</label><textarea id="brief-${key}" data-brief-field="${key}" maxlength="3000" placeholder="${key === "evidence" ? "填写真实资料与来源；没有证据可留空" : "尚未填写"}">${esc(brief[key] || "")}</textarea></div>`,
    )
    .join(
      "",
    )}<div class="singlefield"><label for="brief-profile">可选创作方向</label><select id="brief-profile" data-brief-field="profile">${Object.entries(
    BRIEF_PROFILES,
  )
    .map(
      ([key, value]) =>
        `<option value="${key}" ${(brief.profile || "inherit") === key ? "selected" : ""}>${value.name}</option>`,
    )
    .join(
      "",
    )}</select></div><p class="property-help">${esc(plan.profile.guidance)}</p><fieldset class="brief-sections"><legend>页面内容大纲（按顺序）</legend>${Object.entries(
    BRIEF_SECTIONS,
  )
    .map(
      ([key, label]) =>
        `<label><input type="checkbox" data-brief-section="${key}" ${plan.outline.some((s) => s.id === key) ? "checked" : ""}>${label}</label>`,
    )
    .join(
      "",
    )}</fieldset><ol class="brief-outline" data-brief-outline>${plan.outline.map((s) => `<li>${s.label}</li>`).join("")}</ol><div data-brief-warnings role="status">${plan.warnings.map((w) => `<p class="property-help">${esc(w)}</p>`).join("")}</div><button class="btn-small" data-action="download-context">导出当前范围 Agent 上下文</button><p class="property-help">只读 JSON 包含当前哈希、范围、结构、组件源与简报；不包含资源二进制。导出后仍须读取最新工程并按 Patch 审核，不会调用模型。</p></details>`;
}
