import test from "node:test";
import assert from "node:assert/strict";
import { auditGeometry } from "../src/browser-audit.mjs";
const bounds = { x: 0, y: 0, w: 800, h: 600 };
const record = (nodeId, rect, extra = {}) => ({
  nodeId,
  rect,
  parentRect: bounds,
  parentKey: "board",
  ...extra,
});
test("measured audit separates parent/board overflow, visible text overflow, clipping and CSS touch size", () => {
  const records = [
      record(
        "parentOverflow",
        { x: 120, y: 20, w: 40, h: 40 },
        { parentRect: { x: 20, y: 20, w: 120, h: 120 }, parentKey: "frame" },
      ),
      record(
        "boardOverflow",
        { x: 790, y: 20, w: 40, h: 40 },
        {
          parentRect: { x: 760, y: 0, w: 100, h: 100 },
          parentKey: "outsideFrame",
        },
      ),
      record("text", { x: 200, y: 200, w: 120, h: 40 }, { textOverflow: true }),
      record(
        "clipped",
        { x: 200, y: 260, w: 120, h: 40 },
        { textOverflow: true, textClipped: true },
      ),
      record("small", { x: 400, y: 400, w: 43, h: 44 }, { interactive: true }),
      record(
        "hidden",
        { x: -100, y: -100, w: 10, h: 10 },
        { hidden: true, interactive: true },
      ),
    ],
    before = structuredClone(records);
  const findings = auditGeometry(records, bounds, { boardId: "board1" });
  assert.deepEqual(
    findings.map((f) => [f.nodeId, f.code]),
    [
      ["parentOverflow", "RENDER_OVERFLOW"],
      ["boardOverflow", "RENDER_OVERFLOW"],
      ["text", "TEXT_OVERFLOW"],
      ["clipped", "TEXT_CLIP"],
      ["small", "TOUCH_TARGET"],
    ],
  );
  assert.equal(findings[0].evidence.scope, "parent");
  assert.equal(findings[1].evidence.scope, "board");
  assert.ok(
    findings.every((f) => f.boardId === "board1" && f.severity === "warning"),
  );
  assert.deepEqual(records, before);
});
test("collision audit warns on partial sibling overlap but excludes containment, decoration, containers and other parents", () => {
  const records = [
    record("one", { x: 20, y: 20, w: 80, h: 80 }),
    record("two", { x: 60, y: 60, w: 80, h: 80 }),
    record("surface", { x: 0, y: 0, w: 800, h: 600 }),
    record("icon", { x: 30, y: 30, w: 80, h: 80 }, { decorative: true }),
    record("frame", { x: 40, y: 40, w: 80, h: 80 }, { container: true }),
    record("elsewhere", { x: 50, y: 50, w: 80, h: 80 }, { parentKey: "other" }),
  ];
  const findings = auditGeometry(records, bounds);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "COLLISION");
  assert.equal(findings[0].nodeId, "one");
  assert.equal(findings[0].relatedNodeId, "two");
  assert.deepEqual(findings[0].evidence.overlap, {
    x: 60,
    y: 60,
    w: 40,
    h: 40,
  });
});
test("measured audit caps output and comparisons and reports incomplete inspection explicitly", () => {
  const records = Array.from({ length: 100 }, (_, i) =>
    record("node" + i, { x: i * 2, y: 20, w: 300, h: 80 }),
  );
  const bounded = auditGeometry(records, bounds, { maxFindings: 3 });
  assert.equal(bounded.length, 3);
  assert.equal(bounded.at(-1).code, "AUDIT_LIMIT");
  const comparisons = auditGeometry(records, bounds, { maxComparisons: 2 });
  assert.equal(comparisons.at(-1).code, "AUDIT_LIMIT");
  assert.throws(() => auditGeometry(records, { ...bounds, w: NaN }));
});
