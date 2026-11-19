import test from "node:test";
import assert from "node:assert/strict";
import { resizeBox, geometryChanges } from "../src/geometry.mjs";
const start = { x: 40, y: 60, w: 200, h: 100 };
test("northwest resize keeps opposite corner fixed and clamps without flipping", () => {
  const r = resizeBox(start, "nw", 80, 20);
  assert.deepEqual(r, { x: 120, y: 80, w: 120, h: 80 });
  const tiny = resizeBox(start, "nw", 400, 400);
  assert.equal(tiny.w, 1);
  assert.equal(tiny.x + tiny.w, 240);
  assert.equal(tiny.y + tiny.h, 160);
});
test("center and proportional resize support shrinking, bounds and immutable input", () => {
  assert.deepEqual(resizeBox(start, "se", 20, 10, { center: true }), {
    x: 20,
    y: 50,
    w: 240,
    h: 120,
  });
  const r = resizeBox(start, "se", -80, 0, { ratio: true });
  assert.equal(r.w, 120);
  assert.equal(r.h, 60);
  const max = resizeBox(start, "se", 10000, 9000, { ratio: true });
  assert.ok(max.w <= 2400 && max.h <= 3200);
  assert.equal(max.w / max.h, 2);
  assert.deepEqual(start, { x: 40, y: 60, w: 200, h: 100 });
});
test("constraint inversion retains CSS right, center, stretch and scale semantics", () => {
  const node = {
    x: 40,
    y: 60,
    w: 200,
    h: 100,
    constraints: { referenceW: 1000, referenceH: 800 },
  };
  for (const [rule, expected] of [
    ["start", { x: 120, w: 300 }],
    ["end", { x: 520, w: 300 }],
    ["center", { x: 320, w: 300 }],
    ["stretch", { x: 120, w: 700 }],
    ["scale", { x: 200, w: 500 }],
  ]) {
    const changes = geometryChanges(
      { ...node, constraints: { ...node.constraints, horizontal: rule } },
      { x: 120, y: 60, w: 300, h: 100 },
      { w: 1000, h: 800 },
      { w: 600, h: 800 },
      { height: false },
    );
    assert.equal(changes.x, expected.x, rule);
    assert.equal(changes.w, expected.w, rule);
    assert.deepEqual(changes.sizing, { w: "fixed" });
    assert.equal(changes.h, undefined);
  }
});
test("flow and breakpoint resize do not introduce global position changes", () => {
  const node = {
    constraints: { horizontal: "end" },
    sizing: { w: "fill", h: "hug" },
  };
  for (const opts of [{ flow: true }, { position: false }]) {
    const c = geometryChanges(
      node,
      start,
      { w: 800, h: 600 },
      { w: 800, h: 600 },
      opts,
    );
    assert.equal(c.x, undefined);
    assert.equal(c.y, undefined);
    assert.deepEqual(c.sizing, { w: "fixed", h: "fixed" });
  }
});
