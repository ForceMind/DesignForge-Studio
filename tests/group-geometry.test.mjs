import test from "node:test";
import assert from "node:assert/strict";
import { groupNodes, ungroupNode, alignNodes, findNode } from "../src/tree.mjs";
const rect = (id, x, y, w = 100, h = 50, extra = {}) => ({
  id,
  type: "rect",
  name: id,
  x,
  y,
  w,
  h,
  text: "Kept content",
  style: { fill: "$primary", radius: 7 },
  ...extra,
});
const board = (nodes) => ({ id: "board", w: 800, h: 600, nodes });
test("grouping a right-pinned fixed layer rebases its reference instead of moving it outside the group", () => {
  const b = board([
      rect("a", 100, 20, 100, 50, {
        constraints: { horizontal: "end", referenceW: 800 },
      }),
      rect("b", 300, 20),
    ]),
    before = structuredClone(b.nodes);
  const g = groupNodes(b, ["a", "b"], "group");
  assert.equal(g.x, 100);
  assert.equal(g.w, 300);
  assert.deepEqual(findNode(b, "a").constraints, {
    horizontal: "end",
    referenceW: 300,
  });
  assert.equal(findNode(b, "a").x, 0);
  // Group right = 400; new child right inset = 200; child width = 100 => original board x = 100.
  assert.equal(
    g.x +
      g.w -
      (findNode(b, "a").constraints.referenceW -
        findNode(b, "a").x -
        findNode(b, "a").w) -
      findNode(b, "a").w,
    100,
  );
  ungroupNode(b, "group");
  assert.deepEqual(b.nodes, before);
});
test("measured group/ungroup round-trip all four constraint rules at a narrower parent without losing fields", () => {
  const nodes = [
    rect("end", 800, 10, 100, 50, {
      constraints: { horizontal: "end", referenceW: 1000 },
    }),
    rect("center", 450, 80, 100, 50, {
      constraints: { horizontal: "center", referenceW: 1000 },
    }),
    rect("stretch", 40, 150, 800, 50, {
      constraints: { horizontal: "stretch", referenceW: 1000 },
    }),
    rect("scale", 100, 220, 100, 50, {
      constraints: { horizontal: "scale", referenceW: 1000 },
    }),
  ];
  const b = { ...board(nodes), w: 1000, h: 800 },
    before = structuredClone(nodes);
  const boxes = [
    { id: "end", x: 400, y: 10, w: 100, h: 50 },
    { id: "center", x: 250, y: 80, w: 100, h: 50 },
    { id: "stretch", x: 40, y: 150, w: 400, h: 50 },
    { id: "scale", x: 60, y: 220, w: 60, h: 50 },
  ];
  const g = groupNodes(
    b,
    nodes.map((n) => n.id),
    "group",
    { boxes, parentSize: { w: 600, h: 500 } },
  );
  assert.equal(g.x, 40);
  assert.equal(g.w, 460);
  assert.deepEqual(
    g.children.map((n) => [
      n.id,
      n.x,
      n.w,
      n.constraints.horizontal,
      n.constraints.referenceW,
    ]),
    [
      ["end", 360, 100, "end", 460],
      ["center", 210, 100, "center", 460],
      ["stretch", 0, 400, "stretch", 460],
      ["scale", 20, 60, "scale", 460],
    ],
  );
  assert.deepEqual(
    ungroupNode(b, "group", { boxes, parentSize: { w: 600, h: 500 } }),
    nodes.map((n) => n.id),
  );
  assert.deepEqual(
    b.nodes,
    before.map((n) => ({ ...n, sizing: { w: "fixed", h: "fixed" } })),
  );
});
test("fallback geometry accounts for a literal parent border before and after grouping", () => {
  const children = [
    rect("a", 100, 20, 100, 50, {
      constraints: { horizontal: "end", referenceW: 500 },
    }),
    rect("b", 280, 90),
  ];
  const parent = {
    ...rect("parent", 40, 40, 500, 300),
    type: "frame",
    layout: { mode: "absolute" },
    style: { stroke: "$border", strokeWidth: 2 },
    children,
  };
  const b = board([parent]),
    before = structuredClone(children);
  const g = groupNodes(b, ["a", "b"], "group");
  assert.equal(g.x, 96);
  ungroupNode(b, "group");
  assert.deepEqual(parent.children, before);
});
test("ungrouping bordered containers converts child bounds to the destination parent origin", () => {
  const child = rect("a", 300, 20, 80, 50, {
    constraints: { horizontal: "end", referenceW: 400 },
  });
  const container = {
    ...rect("container", 100, 50, 400, 200),
    type: "frame",
    layout: { mode: "absolute" },
    style: { stroke: "$border", strokeWidth: 4 },
    children: [child],
  };
  const b = board([container]);
  ungroupNode(b, "container");
  assert.equal(b.nodes[0].x, 396);
  assert.equal(b.nodes[0].y, 74);
  assert.deepEqual(b.nodes[0].constraints, {
    horizontal: "end",
    referenceW: 800,
  });
  assert.equal(b.nodes[0].text, "Kept content");
  assert.deepEqual(b.nodes[0].style, { fill: "$primary", radius: 7 });
});
test("grouping rejects unresolved responsive, Fill/Hug, duplicate or invalid geometry atomically", () => {
  for (const mode of [
    "responsive",
    "fill",
    "hug",
    "locked",
    "hidden",
    "duplicate-id",
    "bad-box",
    "bad-group-id",
  ]) {
    const b = board([rect("a", 40, 20), rect("b", 300, 100)]);
    if (mode === "responsive")
      b.nodes[0].responsive = [{ maxWidth: 600, changes: { w: 60 } }];
    if (mode === "fill" || mode === "hug") b.nodes[0].sizing = { w: mode };
    if (mode === "locked") b.nodes[0].locked = true;
    if (mode === "hidden") b.nodes[0].hidden = true;
    const before = structuredClone(b);
    const boxes =
      mode === "bad-box"
        ? [
            { id: "a", x: 40, y: 20, w: NaN, h: 50 },
            { id: "b", x: 300, y: 100, w: 100, h: 50 },
          ]
        : undefined;
    assert.throws(
      () =>
        groupNodes(
          b,
          mode === "duplicate-id" ? ["a", "a"] : ["a", "b"],
          mode === "bad-group-id" ? "a" : "group",
          { boxes },
        ),
      mode,
    );
    assert.deepEqual(b, before, mode);
  }
});
test("ungrouping rejects dynamic children, locked children, flow targets and unrepresentable inversions without data loss", () => {
  for (const mode of [
    "responsive",
    "fill",
    "locked",
    "flow-source",
    "flow-target",
    "bad-inverse",
  ]) {
    const child = rect("a", 10, 20),
      container = {
        ...rect("container", 50, 40, 300, 200),
        type: "group",
        style: {},
        layout: { mode: "absolute" },
        children: [child],
      },
      b = board([container]);
    if (mode === "responsive")
      child.responsive = [{ maxWidth: 600, changes: { w: 60 } }];
    if (mode === "fill") child.sizing = { w: "fill" };
    if (mode === "locked") child.locked = true;
    if (mode === "flow-source") container.layout.mode = "flex";
    if (mode === "flow-target") b.layout = { mode: "flex" };
    if (mode === "bad-inverse") child.constraints = { horizontal: "stretch" };
    const before = structuredClone(b);
    assert.throws(
      () =>
        ungroupNode(
          b,
          "container",
          mode === "bad-inverse"
            ? {
                boxes: [{ id: "a", x: 20, y: 20, w: 100, h: 50 }],
                parentSize: { w: 1500, h: 600 },
              }
            : {},
        ),
      mode,
    );
    assert.deepEqual(b, before, mode);
  }
});
test("static alignment refuses advanced geometry instead of silently misaligning constrained roots", () => {
  for (const extra of [
    { constraints: { horizontal: "end" } },
    { sizing: { h: "hug" } },
    { responsive: [{ maxWidth: 600, changes: { w: 50 } }] },
  ]) {
    const b = board([rect("a", 40, 20, 100, 50, extra), rect("b", 300, 100)]),
      before = structuredClone(b);
    assert.throws(() => alignNodes(b, ["a", "b"], "left"), /measured geometry/);
    assert.deepEqual(b, before);
  }
});

test("measured grouping normalizes Fill/Hug roots while preserving layout-only responsive fields and descendants", () => {
  const nested = rect("nested", 8, 12),
    a = {
      ...rect("a", 40, 20, 200, 100),
      type: "frame",
      sizing: { w: "fill", h: "hug" },
      layout: { mode: "grid", columns: 2 },
      responsive: [
        {
          maxWidth: 600,
          changes: { layout: { columns: 1 }, style: { fill: "$surface" } },
        },
      ],
      children: [nested],
    },
    b = board([a, rect("b", 300, 150)]),
    before = structuredClone(a),
    boxes = [
      { id: "a", x: 40, y: 20, w: 250, h: 80 },
      { id: "b", x: 300, y: 150, w: 100, h: 50 },
    ];
  const g = groupNodes(b, ["a", "b"], "group", {
    boxes,
    parentSize: { w: 800, h: 600 },
  });
  const grouped = findNode(b, "a");
  assert.deepEqual(grouped.sizing, { w: "fixed", h: "fixed" });
  assert.equal(grouped.w, 250);
  assert.equal(grouped.h, 80);
  assert.deepEqual(grouped.children, before.children);
  assert.deepEqual(grouped.responsive, before.responsive);
  assert.deepEqual(grouped.style, before.style);
  assert.equal(grouped.text, before.text);
  ungroupNode(b, g.id, { boxes, parentSize: { w: 800, h: 600 } });
  assert.deepEqual(b.nodes[0].sizing, { w: "fixed", h: "fixed" });
  assert.deepEqual(b.nodes[0].responsive, before.responsive);
  assert.deepEqual(b.nodes[0].children, before.children);
  assert.deepEqual(
    [b.nodes[0].x, b.nodes[0].y, b.nodes[0].w, b.nodes[0].h],
    [40, 20, 250, 80],
  );
});
test("measured group still refuses root size/visibility breakpoint overrides without changing the project", () => {
  for (const changes of [
    { w: 90 },
    { h: 90 },
    { sizing: { w: "fill" } },
    { hidden: true },
  ]) {
    const b = board([
        rect("a", 40, 20, 100, 50, {
          responsive: [{ maxWidth: 600, changes }],
        }),
        rect("b", 300, 100),
      ]),
      before = structuredClone(b);
    assert.throws(
      () =>
        groupNodes(b, ["a", "b"], "group", {
          boxes: [
            { id: "a", x: 40, y: 20, w: 100, h: 50 },
            { id: "b", x: 300, y: 100, w: 100, h: 50 },
          ],
          parentSize: { w: 800, h: 600 },
        }),
      /responsive/,
    );
    assert.deepEqual(b, before);
  }
});
