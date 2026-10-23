import test from "node:test";
import assert from "node:assert/strict";
import { snapPosition } from "../src/geometry.mjs";
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
