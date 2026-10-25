import test from "node:test";
import assert from "node:assert/strict";
import { boundsOfBoxes, resizeSelectionBoxes } from "../src/geometry.mjs";
const boxes = [
  { id: "a", x: 20, y: 40, w: 80, h: 40 },
  { id: "b", x: 220, y: 160, w: 120, h: 80 },
];
test("multi resize scales gaps and boxes about anchored corner without touching input", () => {
  const before = structuredClone(boxes),
    r = resizeSelectionBoxes(boxes, "se", 320, 200);
  assert.deepEqual(r.bounds, { x: 20, y: 40, w: 640, h: 400 });
  assert.deepEqual(r.boxes, [
    { id: "a", x: 20, y: 40, w: 160, h: 80 },
    { id: "b", x: 420, y: 280, w: 240, h: 160 },
  ]);
  assert.deepEqual(boxes, before);
});
test("northwest, center and proportional selection resizing preserve anchor invariants", () => {
  const n = resizeSelectionBoxes(boxes, "nw", -160, -100);
  assert.equal(n.bounds.x + n.bounds.w, 340);
  assert.equal(n.bounds.y + n.bounds.h, 240);
  const c = resizeSelectionBoxes(boxes, "se", 80, 20, { center: true });
  assert.equal(c.bounds.x + c.bounds.w / 2, 180);
  assert.equal(c.bounds.y + c.bounds.h / 2, 140);
  const ratio = resizeSelectionBoxes(boxes, "se", 160, 0, { ratio: true });
  assert.equal(ratio.bounds.w / ratio.bounds.h, 1.6);
  assert.equal(ratio.boxes[0].w / ratio.boxes[0].h, 2);
});
test("selection minimums keep individual boxes positive; side resize preserves other axis", () => {
  const r = resizeSelectionBoxes(boxes, "nw", 1000, 1000);
  assert.ok(r.boxes.every((b) => b.w >= 1 && b.h >= 1));
  const side = resizeSelectionBoxes(boxes, "e", 80, 300);
  assert.deepEqual(
    side.boxes.map((b) => [b.y, b.h]),
    boxes.map((b) => [b.y, b.h]),
  );
});
test("selection resize refuses duplicate IDs, nonfinite geometry and unsupported extents", () => {
  assert.throws(() => resizeSelectionBoxes([boxes[0]], "se", 1, 1));
  assert.throws(() => resizeSelectionBoxes([boxes[0], boxes[0]], "se", 1, 1));
  assert.throws(() => boundsOfBoxes([{ x: 0, y: 0, w: NaN, h: 1 }]));
  assert.throws(() =>
    resizeSelectionBoxes([boxes[0], { ...boxes[1], x: 3000 }], "se", 1, 1),
  );
});
