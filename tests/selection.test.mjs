import test from "node:test";
import assert from "node:assert/strict";
import { selectionInBox, boxFromPoints } from "../src/geometry.mjs";
const entries = [
  { id: "parent", parentId: null, rect: { x: 10, y: 10, w: 400, h: 200 } },
  { id: "a", parentId: "parent", rect: { x: 30, y: 30, w: 50, h: 50 } },
  { id: "b", parentId: "parent", rect: { x: 100, y: 30, w: 50, h: 50 } },
  {
    id: "locked",
    parentId: "parent",
    locked: true,
    rect: { x: 180, y: 30, w: 50, h: 50 },
  },
  {
    id: "hidden",
    parentId: "parent",
    hidden: true,
    rect: { x: 250, y: 30, w: 50, h: 50 },
  },
];
test("marquee selects fully contained visible unlocked descendants, not a partially covered parent", () => {
  assert.deepEqual(selectionInBox(entries, { x: 20, y: 20, w: 300, h: 80 }), [
    "a",
    "b",
  ]);
  assert.deepEqual(selectionInBox(entries, { x: 40, y: 40, w: 20, h: 20 }), []);
});
test("selected parent subsumes descendants and Shift retains valid existing selection", () => {
  assert.deepEqual(selectionInBox(entries, { x: 0, y: 0, w: 500, h: 300 }), [
    "parent",
  ]);
  assert.deepEqual(
    selectionInBox(entries, { x: 90, y: 20, w: 70, h: 70 }, ["a", "missing"]),
    ["a", "b"],
  );
});
test("reverse-direction marquee normalizes its rectangle without changing input", () => {
  const a = { x: 100, y: 200 },
    b = { x: 20, y: 30 };
  assert.deepEqual(boxFromPoints(a, b), { x: 20, y: 30, w: 80, h: 170 });
  assert.deepEqual(a, { x: 100, y: 200 });
});
