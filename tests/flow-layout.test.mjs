import test from "node:test";
import assert from "node:assert/strict";
import { flowDropTarget, reorderSibling } from "../src/flow-layout.mjs";
const items = [
  { id: "a", rect: { x: 10, y: 10, w: 80, h: 40 } },
  { id: "b", rect: { x: 110, y: 10, w: 120, h: 60 } },
  { id: "c", rect: { x: 10, y: 100, w: 80, h: 40 } },
];
test("flow targets follow measured row/column halves and return viewport insertion edges", () => {
  const before = structuredClone(items);
  assert.deepEqual(
    flowDropTarget(items, { x: 120, y: 30 }, { direction: "row" }),
    {
      anchorId: "b",
      placement: "before",
      marker: { x: 110, y: 10, w: 0, h: 60 },
    },
  );
  assert.deepEqual(
    flowDropTarget(items, { x: 220, y: 30 }, { direction: "row" }),
    {
      anchorId: "b",
      placement: "after",
      marker: { x: 230, y: 10, w: 0, h: 60 },
    },
  );
  assert.deepEqual(flowDropTarget(items, { x: 40, y: 130 }), {
    anchorId: "c",
    placement: "after",
    marker: { x: 10, y: 140, w: 80, h: 0 },
  });
  assert.deepEqual(items, before);
});
test("wrapped rows and Grid use nearby boxes, preserving variable cell dimensions", () => {
  for (const layout of [
    { mode: "grid", direction: "column" },
    { mode: "flex", direction: "row" },
  ]) {
    assert.equal(
      flowDropTarget(items, { x: 75, y: 110 }, layout).anchorId,
      "c",
    );
    assert.equal(
      flowDropTarget(items, { x: 75, y: 110 }, layout).placement,
      "after",
    );
    assert.equal(
      flowDropTarget(items, { x: 20, y: 95 }, layout).placement,
      "before",
    );
  }
});
test("drop targeting ignores nonvisible or malformed boxes and bounds traversal", () => {
  assert.equal(flowDropTarget([], { x: 1, y: 1 }), null);
  assert.equal(flowDropTarget(items, { x: NaN, y: 1 }), null);
  assert.equal(flowDropTarget(Array(501).fill(items[0]), { x: 1, y: 1 }), null);
  assert.equal(
    flowDropTarget(
      [{ id: "hidden", rect: { x: 0, y: 0, w: 0, h: 0 } }, items[2]],
      { x: 0, y: 0 },
    ).anchorId,
    "c",
  );
});
function board() {
  return {
    nodes: [
      {
        id: "parent",
        type: "frame",
        children: ["a", "b", "hidden", "c"].map((id, i) => ({
          id,
          type: "text",
          x: i * 10,
          text: id,
          hidden: id === "hidden",
          style: { color: "$ink" },
          responsive: [{ maxWidth: 600, changes: { h: 40 } }],
        })),
      },
      { id: "elsewhere", type: "rect" },
    ],
  };
}
test("same-parent reordering changes only order, retaining hidden siblings and every node field", () => {
  const b = board(),
    saved = structuredClone(b),
    list = b.nodes[0].children;
  assert.equal(reorderSibling(b, "a", "c", "after"), true);
  assert.deepEqual(
    list.map((n) => n.id),
    ["b", "hidden", "c", "a"],
  );
  assert.deepEqual(
    [...list].sort((a, b) => a.id.localeCompare(b.id)),
    [...saved.nodes[0].children].sort((a, b) => a.id.localeCompare(b.id)),
  );
  assert.equal(reorderSibling(b, "a", "b", "before"), true);
  assert.deepEqual(b, saved);
});
test("no-op and failed reorders leave the exact source intact; parent locks and cross-parent targets reject", () => {
  const b = board(),
    before = structuredClone(b);
  assert.equal(reorderSibling(b, "a", "b", "before"), false);
  assert.equal(reorderSibling(b, "b", "a", "after"), false);
  assert.equal(reorderSibling(b, "a", "a", "after"), false);
  for (const fn of [
    () => reorderSibling(b, "a", "elsewhere", "after"),
    () => reorderSibling(b, "missing", "b", "after"),
    () => reorderSibling(b, "a", "b", "invalid"),
  ])
    assert.throws(fn);
  assert.deepEqual(b, before);
  b.nodes[0].locked = true;
  const locked = structuredClone(b);
  assert.throws(() => reorderSibling(b, "a", "b", "after"), /Locked/);
  assert.deepEqual(b, locked);
  b.nodes[0].locked = false;
  b.nodes[0].children[0].locked = true;
  assert.throws(() => reorderSibling(b, "a", "b", "after"), /Locked/);
});
