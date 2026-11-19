import { hashProject } from "./core.mjs";
import { flattenNodes } from "./tree.mjs";

export const QUALITY_FORMAT = "designforge.quality-report";
export const QUALITY_LIMIT = 240;
export const QUALITY_SAMPLE_WIDTHS = Object.freeze([390, 768, 1440]);
export const qualitySampleKey = (view) =>
  JSON.stringify([view.boardId, view.width]);
export const QUALITY_SCOPES = Object.freeze(["selection", "board", "project"]);

// Two dimensions: what was observed, and how strongly it should be interpreted.
export const QUALITY_RULES = Object.freeze({
  QG01: Object.freeze({
    group: "geometry",
    severity: "suggestion",
    basis: "heuristic",
    title: "嵌套圆角",
    guidance:
      "复核边框与留白；若要视觉同心，可考虑建议半径。刻意对比时可以忽略。",
  }),
  QG05: Object.freeze({
    group: "geometry",
    severity: "review",
    basis: "measured",
    title: "图层超出边界",
    guidance: "检查容器尺寸、内边距或断点约束，确认超出是否有意。",
  }),
  QG06: Object.freeze({
    group: "geometry",
    severity: "suggestion",
    basis: "heuristic",
    title: "同级图层重叠",
    guidance: "检查重叠是否符合设计意图。",
  }),
  QT01: Object.freeze({
    group: "typography",
    severity: "suggestion",
    basis: "heuristic",
    title: "小字号文字",
    guidance: "实际字号低于 12 CSS px。按用途和阅读距离复核。",
  }),
  QT02: Object.freeze({
    group: "typography",
    severity: "review",
    basis: "measured",
    title: "文字被裁切",
    guidance: "查看文本、字号、行高与容器，处理有意省略以外的裁切。",
  }),
  QT05: Object.freeze({
    group: "typography",
    severity: "review",
    basis: "measured",
    title: "文字超出文本盒",
    guidance: "检查换行与内容撑开，避免文字覆盖周围内容。",
  }),
  QC02: Object.freeze({
    group: "color",
    severity: "review",
    basis: "measured",
    title: "控件文字配色对比偏低",
    guidance:
      "复核实测前景与控件自身不透明填充。4.5 / 3 是参考对比度，此检查不评估遮挡或完整 WCAG。",
  }),
  QI01: Object.freeze({
    group: "interaction",
    severity: "review",
    basis: "heuristic",
    title: "控件尺寸偏小",
    guidance: "按实际目标平台检查热区。44×44 CSS px 是设计参考值。",
  }),
});
const CODE_TO_RULE = {
  NESTED_RADIUS: "QG01",
  RENDER_OVERFLOW: "QG05",
  COLLISION: "QG06",
  MEASURED_TEXT_SIZE: "QT01",
  TEXT_CLIP: "QT02",
  TEXT_OVERFLOW: "QT05",
  TOUCH_TARGET: "QI01",
  LOCAL_CONTRAST: "QC02",
};
export const QUALITY_LIMITATIONS = Object.freeze([
  "仅检查列出的画板宽度与当前项目主题；未覆盖全部断点、真机和完整键盘流程。",
  "控件预览覆盖仅记录强制状态；默认以外的原生交互状态没有逐项测试。",
  "不判断遮挡、透明叠色、真实字形回退、语义层级和完整 WCAG；建议不代表设计错误。",
]);
const round = (n) => Math.round(n * 100) / 100;
const opaqueRgb = (value) => {
  const match =
    /^rgb\(\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\s*\)$/.exec(
      value,
    );
  if (!match) return null;
  const channels = match.slice(1).map(Number);
  return channels.every((n) => n >= 0 && n <= 255) ? channels : null;
};
export function localContrastEvidence({
  color,
  background,
  fontSize,
  fontWeight,
  opaqueChain,
}) {
  const fg = opaqueRgb(color),
    bg = opaqueRgb(background);
  if (
    !fg ||
    !bg ||
    !opaqueChain ||
    !Number.isFinite(fontSize) ||
    !Number.isFinite(fontWeight)
  )
    return null;
  const luminance = (rgb) =>
    rgb.reduce((sum, c, i) => {
      const s = c / 255,
        linear = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][i];
    }, 0);
  const a = luminance(fg),
    b = luminance(bg);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const reference =
    fontSize >= 24 || (fontSize >= 56 / 3 && fontWeight >= 700) ? 3 : 4.5;
  return ratio < reference
    ? {
        ratio: round(ratio),
        reference,
        foreground: color,
        background,
        fontSizePx: fontSize,
        fontWeight,
        method: "computed-own-opaque-fill",
      }
    : null;
}
export function nestedRadiusEvidence(parent, child) {
  if (
    !parent?.painted ||
    !child?.painted ||
    !parent.container ||
    !child.container
  )
    return null;
  if (
    ![parent.radius, parent.border, child.radius, child.border].every(
      Number.isFinite,
    )
  )
    return null;
  const p = parent.rect,
    c = child.rect;
  const insets = [
    c.x - p.x,
    c.y - p.y,
    p.x + p.w - c.x - c.w,
    p.y + p.h - c.y - c.h,
  ];
  // Equal outsets and uniform borders make the simple concentric model applicable.
  if (
    Math.min(...insets) < parent.border + 1 ||
    Math.max(...insets) - Math.min(...insets) > 1
  )
    return null;
  if (!(parent.radius > 0)) return null;
  if (
    parent.radius * 2 >= Math.min(p.w, p.h) ||
    child.radius * 2 >= Math.min(c.w, c.h)
  )
    return null;
  const inset = insets.reduce((sum, n) => sum + n, 0) / 4;
  const expected = Math.max(
    0,
    parent.radius - parent.border - (inset - parent.border),
  );
  if (Math.abs(expected - child.radius) < 3) return null;
  return {
    outerRadiusPx: round(parent.radius),
    innerRadiusPx: round(child.radius),
    parentBorderPx: round(parent.border),
    insetFromOuterEdgePx: round(inset),
    gapFromInnerBorderPx: round(inset - parent.border),
    suggestedRadiusPx: round(expected),
  };
}

export function qualityContext(
  project,
  {
    scope,
    boardId,
    nodeIds = [],
    widthFor = (b) => b.w,
    stateFor = () => null,
    locale = null,
    expansion = false,
    widthMode = "preview",
  },
) {
  if (!QUALITY_SCOPES.includes(scope)) throw Error("Unknown quality scope");
  if (
    !["preview", "matrix"].includes(widthMode) ||
    (widthMode === "matrix" && scope === "project")
  )
    throw Error("Size comparison requires a board or a selection");
  const boards =
    scope === "project"
      ? project.boards
      : project.boards.filter((b) => b.id === boardId);
  if (!boards.length) throw Error("Missing quality scope board");
  const roots = scope === "selection" ? [...new Set(nodeIds)].sort() : [];
  if (scope === "selection") {
    const known = new Set(flattenNodes(boards[0].nodes).map((e) => e.node.id));
    if (!roots.length || roots.some((id) => !known.has(id)))
      throw Error("Select at least one existing layer");
  }
  return {
    scope,
    widthMode,
    nodeIds: roots,
    theme: project.activeTheme || null,
    locale,
    scenario: expansion ? "normal-and-text-expansion" : "normal",
    boards: boards.flatMap((b) =>
      (widthMode === "matrix" ? QUALITY_SAMPLE_WIDTHS : [widthFor(b)]).map(
        (width) => ({
          boardId: b.id,
          width,
          forcedState: widthMode === "matrix" ? null : stateFor(b),
        }),
      ),
    ),
  };
}
export function qualityReportIsCurrent(report, project, context) {
  return (
    report?.format === QUALITY_FORMAT &&
    report.version === 1 &&
    report.baseHash === hashProject(project) &&
    JSON.stringify(report.context) === JSON.stringify(context)
  );
}

function targets(board, roots) {
  const result = new Set(),
    rootSet = new Set(roots);
  for (const { node, parent } of flattenNodes(board.nodes))
    if (!roots.length || rootSet.has(node.id) || result.has(parent?.id))
      result.add(node.id);
  return result;
}

/** Assemble a read-only report from this app's bounded measurements. Never imports patches. */
export function buildQualityReport(
  project,
  context,
  measurements,
  { maxFindings = QUALITY_LIMIT } = {},
) {
  if (
    !Number.isInteger(maxFindings) ||
    maxFindings < 1 ||
    maxFindings > QUALITY_LIMIT
  )
    throw Error("Invalid quality result limit");
  const findings = [],
    coverage = [],
    seen = new Set();
  let truncated = false;
  for (const view of context.boards) {
    const board = project.boards.find((b) => b.id === view.boardId);
    if (!board) throw Error("Unknown quality report board");
    const ids = targets(board, context.nodeIds),
      measured = measurements.get(qualitySampleKey(view));
    const incomplete =
      measured?.findings.some((f) => f.code === "AUDIT_LIMIT") ?? false;
    const scenarioIncomplete =
      context.scenario === "normal-and-text-expansion" &&
      (!measured?.expanded ||
        measured.expanded.some((f) => f.code === "AUDIT_LIMIT"));
    coverage.push({
      boardId: board.id,
      width: view.width,
      status: !measured
        ? "unavailable"
        : incomplete || scenarioIncomplete
          ? "partial"
          : "measured",
      ...(measured ? { measuredWidth: measured.width } : {}),
      reason: !measured
        ? "找不到可测量画板。"
        : incomplete || scenarioIncomplete
          ? "测量或文字模拟达到预算，部分内容未检查。"
          : null,
    });
    for (let f of [
      ...(measured?.findings || []),
      ...(measured?.expanded || []),
    ]) {
      const ruleId = CODE_TO_RULE[f.code],
        rule = QUALITY_RULES[ruleId],
        scenario =
          f.scenario === "text-expansion" ? "text-expansion" : "normal";
      if (!rule || f.boardId !== board.id) continue;
      if (!ids.has(f.nodeId)) {
        if (!ids.has(f.relatedNodeId)) continue;
        f = {
          ...f,
          nodeId: f.relatedNodeId,
          sourceId: f.relatedSourceId,
          relatedNodeId: f.nodeId,
          relatedSourceId: f.sourceId,
          rect: undefined,
        };
      }
      const pair = f.relatedNodeId
        ? [
            [f.nodeId, f.sourceId || null],
            [f.relatedNodeId, f.relatedSourceId || null],
          ].sort()
        : null;
      const key = JSON.stringify([
        board.id,
        view.width,
        ruleId,
        scenario,
        pair ?? [f.nodeId, f.sourceId || null],
      ]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (findings.length === maxFindings) {
        truncated = true;
        continue;
      }
      findings.push({
        ruleId,
        group: rule.group,
        severity: rule.severity,
        basis: rule.basis,
        boardId: board.id,
        width: view.width,
        nodeId: f.nodeId,
        sourceId: f.sourceId || null,
        relatedNodeId: f.relatedNodeId || null,
        relatedSourceId: f.relatedSourceId || null,
        scenario,
        title: rule.title,
        guidance: rule.guidance,
        evidence: structuredClone({
          ...(f.rect ? { rect: f.rect } : {}),
          ...f.evidence,
        }),
      });
    }
  }
  return {
    format: QUALITY_FORMAT,
    version: 1,
    baseHash: hashProject(project),
    context: structuredClone(context),
    findings,
    coverage,
    limits: { maxFindings, truncated },
    limitations: [...QUALITY_LIMITATIONS],
  };
}
