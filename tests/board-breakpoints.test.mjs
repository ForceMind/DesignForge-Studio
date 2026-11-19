import test from "node:test";
import assert from "node:assert/strict";
import { newProject, validateProject, hashProject } from "../src/core.mjs";
import {
  collectBoardBreakpoints,
  filterBoardBreakpoints,
} from "../src/board-breakpoints.mjs";
function project() {
  const p = newProject("Board breakpoint map");
  const text = {
    id: "label",
    name: "Source label",
    type: "text",
    x: 10,
    y: 10,
    w: 100,
    h: 30,
    text: "Hello",
    style: { color: "$ink" },
    responsive: [
      { maxWidth: 600, changes: { style: { color: "#FF0000", fontSize: 20 } } },
      { maxWidth: 390, changes: { hidden: true } },
    ],
  };
  p.components = [
    {
      id: "card",
      name: "Card",
      variants: [
        {
          id: "base",
          name: "Base",
          root: {
            id: "root",
            type: "component",
            name: "Source root",
            x: 0,
            y: 0,
            w: 160,
            h: 100,
            text: "",
            style: {},
            responsive: [
              {
                maxWidth: 900,
                changes: { layout: { mode: "flex", direction: "column" } },
              },
            ],
            children: [text],
          },
        },
      ],
    },
  ];
  const instance = (id, x) => ({
    id,
    name: id,
    type: "instance",
    componentId: "card",
    variantId: "base",
    x,
    y: 200,
    w: 160,
    h: 100,
    text: "",
    style: {},
  });
  p.boards = [
    {
      id: "work",
      name: "Work",
      x: 0,
      y: 60,
      w: 1000,
      h: 700,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "parent",
          name: "Parent",
          type: "frame",
          x: 10,
          y: 10,
          w: 900,
          h: 600,
          text: "",
          style: {},
          responsive: [{ maxWidth: 600, changes: { w: 500 } }],
          children: [
            {
              id: "child",
              name: "Nested child",
              type: "rect",
              x: 10,
              y: 10,
              w: 100,
              h: 100,
              text: "",
              style: {},
              responsive: [{ maxWidth: 390, changes: { hidden: true } }],
            },
            instance("first", 20),
            instance("second", 220),
          ],
        },
      ],
    },
  ];
  return p;
}
const board = (p) => p.boards[0];
test("board scopes include nested parents, children and exact instance root/source projections", () => {
  const p = project();
  assert.deepEqual(validateProject(p), []);
  const before = hashProject(p),
    scopes = collectBoardBreakpoints(board(p), p);
  assert.deepEqual(
    scopes.map((s) => s.maxWidth),
    [900, 600, 390],
  );
  assert.equal(scopes[0].entries.length, 2);
  assert.equal(scopes[1].entries.length, 3);
  assert.equal(scopes[2].entries.length, 3);
  assert.equal(scopes[1].ownerCount, 3);
  assert.ok(
    scopes[0].entries.every((e) => e.sourceId === "root" && !e.editable),
  );
  assert.ok(
    scopes[1].entries.some((e) => e.ownerId === "parent" && e.editable),
  );
  assert.ok(
    scopes[1].entries.some(
      (e) => e.ownerId === "second" && e.sourceId === "label" && !e.editable,
    ),
  );
  assert.equal(hashProject(p), before);
});
test("instance overrides remove shadowed source fields without affecting other instances or definitions", () => {
  const p = project(),
    source = structuredClone(p.components);
  board(p).nodes[0].children[1].overrides = {
    label: { style: { color: "#00AA00" } },
  };
  const scopes = collectBoardBreakpoints(board(p), p),
    at600 = scopes.find((s) => s.maxWidth === 600);
  assert.deepEqual(at600.entries.find((e) => e.ownerId === "first").fields, [
    "style.fontSize",
  ]);
  assert.deepEqual(at600.entries.find((e) => e.ownerId === "second").fields, [
    "style.color",
    "style.fontSize",
  ]);
  assert.deepEqual(p.components, source);
});
test("explicit instance responsive arrays shadow only the source root, keeping descendant scopes", () => {
  const p = project(),
    first = board(p).nodes[0].children[1];
  first.responsive = [];
  let scopes = collectBoardBreakpoints(board(p), p);
  assert.equal(scopes.find((s) => s.maxWidth === 900).entries.length, 1);
  assert.equal(scopes.find((s) => s.maxWidth === 600).entries.length, 3);
  first.responsive = [{ maxWidth: 768, changes: { w: 120 } }];
  scopes = collectBoardBreakpoints(board(p), p);
  assert.deepEqual(scopes.find((s) => s.maxWidth === 768).entries[0], {
    ownerId: "first",
    sourceId: null,
    editable: true,
    label: "first",
    fields: ["w"],
  });
});
test("filters match source labels, owner IDs, fields or widths and return independent aggregate counts", () => {
  const p = project(),
    scopes = collectBoardBreakpoints(board(p), p),
    saved = structuredClone(scopes);
  assert.equal(filterBoardBreakpoints(scopes, "SECOND").length, 3);
  assert.equal(filterBoardBreakpoints(scopes, "source label").length, 2);
  assert.equal(
    filterBoardBreakpoints(scopes, "style.color")[0].entries.length,
    2,
  );
  assert.equal(filterBoardBreakpoints(scopes, "390")[0].entries.length, 3);
  assert.deepEqual(filterBoardBreakpoints(scopes, "missing"), []);
  assert.deepEqual(scopes, saved);
});
test("hidden layers retain definitions and empty source rules are explicit without invented fields", () => {
  const p = project(),
    child = board(p).nodes[0].children[0];
  child.hidden = true;
  child.responsive[0].changes = {};
  const r = collectBoardBreakpoints(board(p), p)
    .find((s) => s.maxWidth === 390)
    .entries.find((e) => e.ownerId === "child");
  assert.deepEqual(r.fields, []);
});
test("each board is isolated even when persistent layer IDs overlap", () => {
  const p = project(),
    other = structuredClone(board(p));
  other.id = "other";
  other.nodes[0].responsive = [{ maxWidth: 1200, changes: { w: 700 } }];
  p.boards.push(other);
  assert.ok(collectBoardBreakpoints(other, p).some((s) => s.maxWidth === 1200));
  assert.ok(
    !collectBoardBreakpoints(board(p), p).some((s) => s.maxWidth === 1200),
  );
});
test("projection budgets reject amplified component maps before expanding them", () => {
  const p = project(),
    template = board(p).nodes[0].children[1],
    root = p.components[0].variants[0].root;
  root.children = Array.from({ length: 499 }, (_, i) => ({
    ...structuredClone(root.children[0]),
    id: "source" + i,
  }));
  board(p).nodes = Array.from({ length: 20 }, (_, i) => ({
    ...structuredClone(template),
    id: "instance" + i,
  }));
  assert.throws(
    () => collectBoardBreakpoints(board(p), p),
    /budget|5000|limit/i,
  );
});
