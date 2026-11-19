import test from "node:test";
import assert from "node:assert/strict";
import { positionChanges } from "../src/geometry.mjs";
import { effectiveNode } from "../src/responsive.mjs";
import { newProject, validateProject, standaloneHtml } from "../src/core.mjs";

test("end-constrained movement accounts for both measured Hug/Fill extents without changing dimensions", () => {
  const node = {
    x: 600,
    y: 300,
    w: 100,
    h: 80,
    sizing: { w: "hug", h: "hug" },
    constraints: { horizontal: "end", vertical: "end" },
  };
  const before = structuredClone(node);
  for (const extent of [
    { w: 50, h: 22 },
    { w: 800, h: 600 },
  ]) {
    const actual = { w: 800, h: 600 };
    const box = {
      x: node.x + node.w - extent.w + 1,
      y: node.y + node.h - extent.h + 10,
      ...extent,
    };
    assert.deepEqual(positionChanges(node, box, actual, actual), {
      x: 601,
      y: 310,
    });
  }
  assert.deepEqual(node, before);
});

test("end-constrained movement uses effective responsive sizes and explicit reference dimensions", () => {
  const node = {
    x: 600,
    y: 300,
    w: 100,
    h: 80,
    sizing: { w: "hug", h: "hug" },
    constraints: {
      horizontal: "end",
      vertical: "end",
      referenceW: 900,
      referenceH: 700,
    },
    responsive: [{ maxWidth: 600, changes: { w: 220, h: 120 } }],
  };
  const view = effectiveNode(node, 600);
  const actual = { w: 500, h: 400 },
    design = { w: 800, h: 600 };
  const box = { x: 371, y: 91, w: 50, h: 30 };
  const changes = positionChanges(view, box, design, actual);
  assert.deepEqual(changes, { x: 601, y: 301 });
  assert.equal(actual.w - (900 - changes.x - view.w) - box.w, box.x);
  assert.equal(actual.h - (700 - changes.y - view.h) - box.h, box.y);
});

test("icon export inherits CSS color including guarded breakpoint and theme values", () => {
  const p = newProject("Responsive icons");
  p.themes = { dark: { primary: "#AABBCC" } };
  p.activeTheme = "dark";
  p.boards = [
    {
      id: "work",
      name: "Icons",
      x: 0,
      y: 0,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "icon",
          type: "icon",
          x: 10,
          y: 10,
          w: 24,
          h: 24,
          text: "",
          icon: "grid",
          style: { color: "$primary" },
          responsive: [
            { maxWidth: 600, changes: { style: { color: "#FF0000" } } },
          ],
        },
      ],
    },
  ];
  assert.deepEqual(validateProject(p), []);
  const html = standaloneHtml(p.boards[0], p);
  assert.match(html, /stroke="currentColor"/);
  assert.match(html, /color:#AABBCC/);
  assert.match(html, /color:#FF0000!important/);
  assert.doesNotMatch(html, /stroke="#/);
});
