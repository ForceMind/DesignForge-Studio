import { activeBreakpoint } from "./responsive.mjs";

export const PREVIEW_MIN = 280,
  PREVIEW_MAX = 2400;
/** Contiguous width intervals. Beyond the first, lower bounds are exclusive. */
export function breakpointIntervals(node) {
  const widths = [
    ...new Set(
      (Array.isArray(node?.responsive) ? node.responsive : [])
        .map((rule) => rule?.maxWidth)
        .filter(
          (width) =>
            Number.isFinite(width) &&
            width >= PREVIEW_MIN &&
            width <= PREVIEW_MAX,
        ),
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, 8);
  let lower = PREVIEW_MIN;
  const ranges = widths.map((width) => {
    const range = { min: lower, max: width, scope: width };
    lower = width;
    return range;
  });
  if (!widths.length || lower < PREVIEW_MAX)
    ranges.push({ min: lower, max: PREVIEW_MAX, scope: null });
  return ranges;
}
/** All interpolated values are bounded numbers; project text is never HTML here. */
export function breakpointOverviewMarkup(
  node,
  { width = PREVIEW_MIN, scope = null, baseWidth = 1280 } = {},
) {
  const ranges = breakpointIntervals(node),
    current = Number.isFinite(width)
      ? Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, width))
      : PREVIEW_MIN,
    active = activeBreakpoint(node, current),
    percent = (value) =>
      ((value - PREVIEW_MIN) / (PREVIEW_MAX - PREVIEW_MIN)) * 100;
  return `<section class="breakpoint-overview" aria-label="本节点断点总览"><div class="panel-section-title">断点范围 <small>${current}px 预览</small></div><div class="breakpoint-track" aria-hidden="true">${ranges.map((r) => `<span class="breakpoint-segment ${r.scope === active ? "current" : ""}" style="left:${percent(r.min)}%;width:${percent(r.max) - percent(r.min)}%"></span>`).join("")}<i class="breakpoint-cursor" style="left:${percent(current)}%"></i></div><div class="breakpoint-range-buttons" role="group" aria-label="切换本节点修改范围">${ranges
    .map((r, i) => {
      const title =
          r.scope === null
            ? `基础样式，预览范围 ${r.min} ${i === 0 ? "≤" : "<"} 宽度 ≤ ${r.max}px`
            : i === 0
              ? `${PREVIEW_MIN} ≤ 宽度 ≤ ${r.max}px`
              : `${r.min} < 宽度 ≤ ${r.max}px`,
        sample =
          r.scope ??
          Math.min(
            r.max,
            Math.max(
              Number.isFinite(baseWidth) ? baseWidth : 1280,
              Math.min(r.max, r.min + 1),
            ),
          );
      return `<button type="button" data-range-scope="${r.scope ?? ""}" data-range-width="${sample}" aria-pressed="${r.scope === scope}" class="${r.scope === active ? "is-preview" : ""}" title="${title}">${r.scope === null ? "基础" : `≤ ${r.scope}`}<small>${i === 0 ? `≥ ${PREVIEW_MIN}` : `> ${r.min}`}px</small></button>`;
    })
    .join(
      "",
    )}</div><div class="breakpoint-preview-field"><label for="breakpoint-preview-value">仅预览宽度</label><input id="breakpoint-preview-value" data-breakpoint-preview type="number" min="${PREVIEW_MIN}" max="${PREVIEW_MAX}" step="1" value="${current}"><span>px</span></div><p class="property-help">点击范围切换编辑；宽度预览不改项目。这里只显示本节点覆盖，父布局和组件源仍可影响结果。</p></section>`;
}
