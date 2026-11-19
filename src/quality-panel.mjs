import { escapeHtml as esc } from "./core.mjs";
const groups = {
  geometry: "布局",
  typography: "文字",
  color: "色彩",
  interaction: "交互",
};
const severities = { review: "需复核", suggestion: "可优化" };
function options(values, current) {
  return Object.entries(values)
    .map(
      ([value, label]) =>
        `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`,
    )
    .join("");
}
export function qualityPanelMarkup(view, report, current, project) {
  const filtered = current
    ? report.findings.filter(
        (f) =>
          (view.group === "all" || view.group === f.group) &&
          (view.severity === "all" || view.severity === f.severity),
      )
    : [];
  const rows = filtered
    .slice(0, view.visible)
    .map(
      (f) => `<article class="quality-finding">
    <button type="button" class="issue-row" data-auditboard="${esc(f.boardId)}" data-auditnode="${esc(f.nodeId)}" data-quality-rule="${esc(f.ruleId)}" data-quality-width="${f.width}">
    <strong class="issue-code">${esc(f.ruleId)} · ${severities[f.severity]}</strong><span>${esc(f.title)}</span>
    <small>${esc(project.boards.find((b) => b.id === f.boardId)?.name || f.boardId)} · #${esc(f.nodeId)}${f.sourceId ? " / 源 #" + esc(f.sourceId) : ""} · ${f.width}px · ${f.scenario === "text-expansion" ? "+30% 文字模拟" : "原稿"}</small></button>
    <p class="property-help">${esc(f.guidance)}</p>
    <details><summary>查看测量证据</summary><pre>${esc(JSON.stringify(f.evidence, null, 2))}</pre></details>
  </article>`,
    )
    .join("");
  const missing = current
    ? report.coverage.filter((c) => c.status !== "measured")
    : [];
  return `<section class="quality-panel" aria-label="本地设计质量">
    <div class="panel-section-title">本地设计质量 <small>只读</small></div>
    <p class="property-help">可测量当前预览或比较常用尺寸。圆角、字号和热区使用参考值。</p>
    <div class="singlefield"><label for="quality-scope">检查范围</label><select id="quality-scope">${options({ selection: "所选图层及子层", board: "当前画板", project: "所有画板" }, view.scope)}</select></div>
    <div class="singlefield"><label for="quality-widthMode">测量尺寸</label><select id="quality-widthMode"${view.scope === "project" ? " disabled" : ""}>${options({ preview: "当前预览", matrix: "390 / 768 / 1440 px" }, view.widthMode)}</select></div>
    ${view.widthMode === "matrix" ? '<p class="property-help">在隔离副本测量当前主题和普通控件状态；定位结果时切换到对应预览宽度。</p>' : ""}
    <label class="quality-expansion"><input id="quality-expansion" type="checkbox"${view.expansion ? " checked" : ""}> 同时模拟文字 +30%</label>
    <div class="button-row"><button type="button" class="btn-small primary" data-action="run-quality">运行质量检查</button><button type="button" class="btn-small" data-action="download-quality"${current ? "" : " disabled"}>导出质量报告</button></div>
    <p class="property-help" role="status" data-quality-status data-audit-stale="${report && !current ? "true" : "false"}">${current ? `本次测量：${report.findings.length} 项 · ${report.context.boards.length} 个测量视图` : report ? "质量报告已过期，请重新检查。" : "尚未运行质量检查。"}</p>
    ${
      current
        ? `<div class="fieldrow"><div class="fieldcol"><label for="quality-group">类别</label><select id="quality-group">${options({ all: "全部", ...groups }, view.group)}</select></div><div class="fieldcol"><label for="quality-severity">解读</label><select id="quality-severity">${options({ all: "全部", ...severities }, view.severity)}</select></div></div>
    ${report.limits.truncated ? '<p class="property-help">报告达到条数上限；可缩小范围后复查。</p>' : ""}
    ${missing.map((c) => `<p class="property-help">${esc(c.boardId)} · ${c.width}px：${esc(c.reason)}</p>`).join("")}
    ${rows || '<p class="property-help">当前筛选无结果。未检查的项目见检测边界。</p>'}
    ${filtered.length > view.visible ? `<button class="btn-small" type="button" data-action="more-quality">显示更多（${view.visible}/${filtered.length}）</button>` : ""}
    <details class="quality-limits"><summary>检测边界与上下文</summary>${report.limitations.map((v) => `<p class="property-help">${esc(v)}</p>`).join("")}<pre>${esc(JSON.stringify({ context: report.context, coverage: report.coverage }, null, 2))}</pre></details>`
        : ""
    }
  </section><div class="divider"></div>`;
}
