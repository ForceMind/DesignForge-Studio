import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQualityReport,
  localContrastEvidence,
  nestedRadiusEvidence,
  qualityContext,
  qualityReportIsCurrent,
} from "../src/quality-core.mjs";
const project = {
  activeTheme: "day",
  boards: [
    {
      id: "board",
      w: 800,
      nodes: [
        { id: "frame", children: [{ id: "child" }] },
        { id: "instance" },
        { id: "other" },
      ],
    },
    { id: "second", w: 390, nodes: [] },
  ],
};
const shape = (rect, radius, border = 0) => ({
  rect,
  radius,
  border,
  container: true,
  painted: true,
});

test("concentric radius advice accounts for border and skips matching, asymmetric and unpainted shapes", () => {
  const outer = shape({ x: 0, y: 0, w: 120, h: 100 }, 22, 2);
  const inner = shape({ x: 8, y: 8, w: 104, h: 84 }, 22);
  assert.deepEqual(nestedRadiusEvidence(outer, inner), {
    outerRadiusPx: 22,
    innerRadiusPx: 22,
    parentBorderPx: 2,
    insetFromOuterEdgePx: 8,
    gapFromInnerBorderPx: 6,
    suggestedRadiusPx: 14,
  });
  assert.equal(nestedRadiusEvidence(outer, { ...inner, radius: 14 }), null);
  assert.equal(
    nestedRadiusEvidence(outer, { ...inner, rect: { ...inner.rect, x: 6 } }),
    null,
  );
  assert.equal(nestedRadiusEvidence(outer, { ...inner, painted: false }), null);
  assert.equal(nestedRadiusEvidence(outer, { ...inner, border: NaN }), null);
  assert.equal(nestedRadiusEvidence({ ...outer, radius: 50 }, inner), null);
});
test("opaque button colors report a ratio while unknown alpha and translucent ancestors remain unverified", () => {
  const pair = {
    color: "rgb(153, 153, 153)",
    background: "rgb(255, 255, 255)",
    fontSize: 16,
    fontWeight: 400,
    opaqueChain: true,
  };
  assert.equal(localContrastEvidence(pair).ratio, 2.85);
  assert.equal(
    localContrastEvidence({ ...pair, fontSize: 20, fontWeight: 700 }).reference,
    3,
  );
  assert.equal(localContrastEvidence({ ...pair, color: "rgb(0, 0, 0)" }), null);
  assert.equal(
    localContrastEvidence({ ...pair, color: "rgba(0, 0, 0, 0.5)" }),
    null,
  );
  assert.equal(localContrastEvidence({ ...pair, opaqueChain: false }), null);
});
test("quality report records a stable version and provenance, rejects stale view or source hash, and does not write project", () => {
  const initial = JSON.stringify(project),
    options = {
      scope: "selection",
      boardId: "board",
      nodeIds: ["frame"],
      widthFor: () => 768,
      stateFor: () => ({ nodeId: "child", state: "focus" }),
      locale: "zh-CN",
      expansion: true,
    };
  const context = qualityContext(project, options);
  const item = {
    boardId: "board",
    nodeId: "child",
    code: "TEXT_CLIP",
    evidence: { scope: "clip-chain", measuredGlyphRects: 4 },
  };
  const measurements = new Map([
    [
      "board",
      {
        width: 768,
        findings: [
          item,
          item,
          { ...item, nodeId: "other" },
          { ...item, nodeId: "unknown" },
        ],
        expanded: [{ ...item, scenario: "text-expansion", factor: 1.3 }],
      },
    ],
  ]);
  const result = buildQualityReport(project, context, measurements);
  assert.equal(result.format, "designforge.quality-report");
  assert.equal(result.version, 1);
  assert.deepEqual(
    result.findings.map((f) => [f.ruleId, f.nodeId, f.scenario]),
    [
      ["QT02", "child", "normal"],
      ["QT02", "child", "text-expansion"],
    ],
  );
  assert.equal(result.coverage[0].status, "measured");
  assert.equal(qualityReportIsCurrent(result, project, context), true);
  assert.equal(
    qualityReportIsCurrent(
      result,
      project,
      qualityContext(project, { ...options, widthFor: () => 390 }),
    ),
    false,
  );
  assert.equal(
    qualityReportIsCurrent(
      result,
      project,
      qualityContext(project, { ...options, stateFor: () => null }),
    ),
    false,
  );
  assert.equal(
    qualityReportIsCurrent(
      result,
      { ...project, activeTheme: "night" },
      context,
    ),
    false,
  );
  assert.equal(JSON.stringify(project), initial);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.throws(
    () =>
      qualityContext(project, {
        ...options,
        nodeIds: ["source-not-a-board-node"],
      }),
    /existing layer/,
  );
});
test("same instance source IDs on different owners remain distinct; incomplete DOM and report limits stay explicit", () => {
  const context = qualityContext(project, { scope: "project" });
  const item = {
    boardId: "board",
    nodeId: "instance",
    sourceId: "source",
    code: "TOUCH_TARGET",
    rect: { x: 0, y: 0, w: 30, h: 40 },
  };
  const measurements = new Map([
    [
      "board",
      {
        width: 800,
        findings: [
          item,
          item,
          { ...item, nodeId: "other" },
          { code: "AUDIT_LIMIT", boardId: "board" },
        ],
      },
    ],
  ]);
  const report = buildQualityReport(project, context, measurements, {
    maxFindings: 1,
  });
  assert.deepEqual(
    report.coverage.map((c) => c.status),
    ["partial", "unavailable"],
  );
  assert.equal(report.limits.truncated, true);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].sourceId, "source");
  assert.equal(
    buildQualityReport(project, context, measurements).findings.length,
    2,
  );
});
test("a collision involving the selection points to the selected node even if the other node was measured first", () => {
  const context = qualityContext(project, {
    scope: "selection",
    boardId: "board",
    nodeIds: ["other"],
  });
  const base = {
    boardId: "board",
    code: "COLLISION",
    evidence: { overlapArea: 30 },
  };
  const measurements = new Map([
    [
      "board",
      {
        width: 800,
        findings: [
          { ...base, nodeId: "child", relatedNodeId: "other" },
          { ...base, nodeId: "other", relatedNodeId: "child" },
        ],
      },
    ],
  ]);
  const [finding, ...rest] = buildQualityReport(
    project,
    context,
    measurements,
  ).findings;
  assert.deepEqual(rest, []);
  assert.equal(finding.nodeId, "other");
  assert.equal(finding.relatedNodeId, "child");
});
