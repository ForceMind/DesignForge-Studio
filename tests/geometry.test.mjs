import test from "node:test";
import assert from "node:assert/strict";
import { snapPosition, positionChanges } from "../src/geometry.mjs";
const n = { id: "moving", x: 0, y: 0, w: 100, h: 40 },
  parent = { w: 1000, h: 800 };
test("snap nearest edge and center, otherwise 8px grid", () => {
  let r = snapPosition(
    n,
    203,
    319,
    [{ id: "other", x: 200, y: 300, w: 180, h: 100 }],
    parent,
  );
  assert.equal(r.x, 200);
  assert.equal(r.guideX, 200);
  assert.equal(r.y, 320);
  r = snapPosition(n, 26, 67, [], parent, 2);
  assert.equal(r.x, 24);
  assert.equal(r.y, 64);
});
test("hidden nodes do not attract snapping; source is not modified", () => {
  const before = structuredClone(n),
    r = snapPosition(
      n,
      203,
      97,
      [{ id: "hidden", hidden: true, x: 201, y: 99, w: 100, h: 10 }],
      parent,
      2,
    );
  assert.equal(r.guideX, null);
  assert.deepEqual(n, before);
});
test("measured-origin movement preserves anchors and cannot accumulate layout-engine rounding noise", () => {
  for (const rule of ["start", "end", "center", "stretch", "scale"]) {
    const node = {
        x: 100,
        y: 80,
        w: 120,
        h: 40,
        constraints: { horizontal: rule, vertical: rule },
      },
      parent = { w: 800, h: 600 },
      actual = { w: 500, h: 400 },
      step = rule === "scale" ? 1.6 : 1;
    for (let i = 0; i < 100; i++) {
      const origin = { x: 42.006, y: 37.006, w: 119.99, h: 39.99 };
      const value = positionChanges(
        node,
        { ...origin, x: origin.x + 1 },
        parent,
        actual,
        { origin },
      );
      node.x = value.x;
      assert.equal(value.y, 80);
      assert.equal(value.x, Math.round((100 + (i + 1) * step) * 100) / 100);
    }
    const origin = { x: 42.006, y: 37.006, w: 119.99, h: 39.99 };
    assert.deepEqual(
      positionChanges(node, origin, parent, actual, { origin }),
      { x: node.x, y: 80 },
    );
  }
});
