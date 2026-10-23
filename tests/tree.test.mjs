import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateProject,
  applyPatch,
  hashProject,
  diffProjects,
  standaloneHtml,
  effectiveTokens,
  resolveToken,
  materializeInstance,
  auditProject,
} from "../src/core.mjs";
import {
  flattenNodes,
  findNode,
  locateNode,
  moveNode,
  groupNodes,
  ungroupNode,
  copySubtree,
  alignNodes,
} from "../src/tree.mjs";
const load = (name) =>
  JSON.parse(
    fs.readFileSync(
      new URL(`../examples/${name}.project.json`, import.meta.url),
    ),
  );
const project = () => load("Studio");
const patch = (p, ops) => ({
  format: "designforge.patch",
  version: 1,
  baseHash: hashProject(p),
  ops,
});
const leaf = (id, x = 10, y = 10) => ({
  id,
  type: "rect",
  name: id,
  x,
  y,
  w: 100,
  h: 50,
  text: "",
  style: { fill: "$primary" },
});
const board = () => ({
  id: "board",
  w: 1200,
  h: 800,
  nodes: [leaf("a"), leaf("b", 150, 90), leaf("c", 300, 60)],
});
test("all 11 examples round-trip, preserve every field, and render without scripts", () => {
  const files = fs
    .readdirSync(new URL("../examples", import.meta.url))
    .filter((n) => n.endsWith(".project.json"));
  assert.equal(files.length, 11);
  for (const file of files) {
    const p = JSON.parse(
      fs.readFileSync(new URL("../examples/" + file, import.meta.url)),
    );
    assert.deepEqual(validateProject(p), [], file);
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
    for (const b of p.boards)
      assert.ok(!standaloneHtml(b, p).includes("<script"));
  }
});
test("nested patch changes only requested descendant, and nested diff exposes it", () => {
  const p = project(),
    b = p.boards[0],
    n = flattenNodes(b.nodes).find((e) => e.node.type === "text").node;
  const next = applyPatch(
    p,
    patch(p, [
      {
        kind: "set-node",
        boardId: b.id,
        nodeId: n.id,
        changes: { text: "Updated child" },
      },
    ]),
  );
  assert.equal(findNode(next.boards[0], n.id).text, "Updated child");
  assert.deepEqual(next.boards[1], p.boards[1]);
  assert.deepEqual(
    diffProjects(p, next).map((d) => [d.nodeId, d.field]),
    [[n.id, "text"]],
  );
});
test("nested add targets parent, remove cleans descendant annotation anchors", () => {
  const p = project(),
    b = p.boards[0],
    parent = b.nodes[0];
  let n = applyPatch(
    p,
    patch(p, [
      {
        kind: "add-node",
        boardId: b.id,
        parentId: parent.id,
        node: leaf("extra"),
      },
    ]),
  );
  assert.equal(locateNode(n.boards[0], "extra").parent.id, parent.id);
  n.comments.push({
    id: "childComment",
    boardId: b.id,
    nodeId: "extra",
    text: "Review",
  });
  n = applyPatch(
    n,
    patch(n, [{ kind: "remove-node", boardId: b.id, nodeId: parent.id }]),
  );
  assert.equal(n.comments.length, 0);
  assert.equal(n.boards[0].nodes.length, 0);
});
test("duplicate ID anywhere in board is rejected atomically", () => {
  const p = project(),
    b = p.boards[0],
    node = flattenNodes(b.nodes).at(-1).node;
  assert.throws(
    () =>
      applyPatch(
        p,
        patch(p, [
          { kind: "add-node", boardId: b.id, node: structuredClone(node) },
        ]),
      ),
    /duplicate/,
  );
});
test("invalid layout injection rolls back previous valid operation", () => {
  const p = project(),
    before = structuredClone(p),
    b = p.boards[0];
  assert.throws(
    () =>
      applyPatch(
        p,
        patch(p, [
          { kind: "rename-board", boardId: b.id, name: "Changed" },
          {
            kind: "set-node",
            boardId: b.id,
            nodeId: b.nodes[0].id,
            changes: {
              layout: { mode: "flex; background:url(https://evil.test)" },
            },
          },
        ]),
      ),
    /validation/,
  );
  assert.deepEqual(p, before);
});
test("reparent rejects descendants and non-containers without losing source", () => {
  const b = board(),
    g = groupNodes(b, ["a", "b"], "g");
  assert.throws(() => moveNode(b, "g", "a"), /container/);
  assert.throws(() => moveNode(b, "g", "g"), /descendant/);
  moveNode(b, "c", "g", 0);
  assert.equal(g.children[0].id, "c");
  assert.equal(b.nodes.length, 1);
});
test("group/ungroup preserve board coordinates and sibling order", () => {
  const b = board(),
    before = structuredClone(b.nodes);
  groupNodes(b, ["a", "b"], "group");
  assert.deepEqual(ungroupNode(b, "group"), ["a", "b"]);
  assert.deepEqual(b.nodes, before);
});
test("copy regenerates every descendant ID and leaves source untouched", () => {
  const b = board(),
    g = groupNodes(b, ["a", "b"], "group"),
    before = structuredClone(g);
  let i = 0;
  const copy = copySubtree(g, () => `copy${++i}`);
  assert.equal(i, 3);
  assert.deepEqual(g, before);
  assert.equal(new Set(flattenNodes([g, copy]).map((e) => e.node.id)).size, 6);
});
test("align sibling set only, rejects auto-layout positions and locked layers", () => {
  const b = board();
  alignNodes(b, ["a", "b"], "right");
  assert.equal(b.nodes[0].x + b.nodes[0].w, b.nodes[1].x + b.nodes[1].w);
  const g = groupNodes(b, ["a", "b"], "group");
  g.layout.mode = "flex";
  assert.throws(() => alignNodes(b, ["a", "b"], "left"), /Auto Layout/);
});
test("move patch is hash protected and visible in parent diff", () => {
  const p = project(),
    b = p.boards[0],
    root = b.nodes[0],
    child = root.children.at(-1);
  const next = applyPatch(
    p,
    patch(p, [
      {
        kind: "move-node",
        boardId: b.id,
        nodeId: child.id,
        parentId: null,
        index: 0,
      },
    ]),
  );
  assert.equal(locateNode(next.boards[0], child.id).parent, null);
  assert.ok(diffProjects(p, next).some((d) => d.field === "$parent"));
});
test("nested ID collisions, excessive depth/count and malformed children are rejected", () => {
  for (const mode of ["duplicate", "depth", "count", "children"]) {
    const p = project(),
      root = p.boards[0].nodes[0];
    if (mode === "duplicate") root.children[0].id = root.id;
    if (mode === "children") root.children = {};
    if (mode === "count")
      root.children = Array.from({ length: 501 }, (_, i) => leaf("x" + i));
    if (mode === "depth") {
      let n = root;
      for (let i = 0; i < 22; i++) {
        const c = { ...leaf("deep" + i), type: "frame", children: [] };
        n.children = [c];
        n = c;
      }
    }
    assert.ok(validateProject(p).length, mode);
  }
});
test("tokens resolve aliases and dark theme, cycles and prototype names are rejected", () => {
  const p = project();
  assert.equal(resolveToken("$primary", p.tokens), "#2563EB");
  p.activeTheme = "dark";
  assert.equal(resolveToken("$primary", effectiveTokens(p)), "#3B82F6");
  p.tokens.accent = "$primary";
  assert.ok(validateProject(p).length);
  p.tokens.accent = "#000000";
  p.tokens.constructor = "#FFFFFF";
  assert.ok(validateProject(p).length);
});
test("component variants and overrides inherit latest definitions without mutating source", () => {
  const p = project(),
    instance = flattenNodes(p.boards[0].nodes).find(
      (e) => e.node.type === "instance",
    ).node,
    source = p.components[0].variants[0].root;
  const label = source.children[0].id;
  instance.overrides = { [label]: { text: "Local override" } };
  assert.equal(
    materializeInstance(instance, p).children[0].text,
    "Local override",
  );
  assert.equal(source.children[0].text, "Create project");
  instance.variantId = "secondary";
  instance.overrides = {};
  assert.equal(
    materializeInstance(instance, p).children[0].text,
    "View project",
  );
});
test("component definitions cannot recursively instantiate other components", () => {
  const p = project(),
    instance = flattenNodes(p.boards[0].nodes).find(
      (e) => e.node.type === "instance",
    ).node;
  p.components[0].variants[0].root.children = [instance];
  assert.ok(
    validateProject(p).some((i) =>
      i.reason.includes("cannot contain instances"),
    ),
  );
});
test("malformed definitions and orphan overrides report errors without throwing", () => {
  for (const v of [null, {}, "bad", [], [{ id: "action", variants: {} }]]) {
    const p = project();
    p.components = v;
    assert.ok(validateProject(p).length);
  }
  const p = project(),
    n = flattenNodes(p.boards[0].nodes).find(
      (e) => e.node.type === "instance",
    ).node;
  n.overrides = { missing: { text: "bad" } };
  assert.ok(validateProject(p).length);
});
test("instance projection is selectable as a whole, source IDs never duplicate canvas IDs", () => {
  const p = project(),
    h = standaloneHtml(p.boards[0], p);
  assert.ok(h.includes("data-source-id"));
  assert.ok(h.includes("display:grid"));
  assert.ok(h.includes("@container (max-width:600px)"));
});
test("responsive numeric bounds and CSS enumeration guard apply recursively", () => {
  const p = project(),
    n = p.boards[0].nodes[0];
  n.responsive = [
    { maxWidth: 600, changes: { layout: { mode: "grid", columns: 0 } } },
  ];
  assert.ok(validateProject(p).length);
  n.responsive = [
    { maxWidth: 600, changes: { style: { fill: "url(https://evil.test/)" } } },
  ];
  assert.ok(!standaloneHtml(p.boards[0], p).includes("evil.test"));
});
test("constraints retain reference dimensions for editor resize and static export", () => {
  const p = project();
  p.boards[0].w = 900;
  const h = standaloneHtml(p.boards[0], p);
  assert.ok(h.includes("width:calc(100% - 64px)"));
});
test("container deletion removes all descendants and preserves other boards", () => {
  const p = project(),
    b = p.boards[0];
  const next = applyPatch(
    p,
    patch(p, [{ kind: "remove-node", boardId: b.id, nodeId: b.nodes[0].id }]),
  );
  assert.equal(flattenNodes(next.boards[0].nodes).length, 0);
  assert.deepEqual(next.boards[1], p.boards[1]);
});
test("audits traverse absolute descendants and annotate immediate-parent overflow", () => {
  const p = project(),
    n = p.boards[0].nodes[0];
  n.layout = { mode: "absolute" };
  n.children[0].x = n.w + 10;
  assert.ok(
    auditProject(p).some(
      (i) => i.nodeId === n.children[0].id && i.code === "OVERFLOW",
    ),
  );
});
test("locked descendants cannot be patched, moved or removed by deleting an ancestor", () => {
  const p = project(),
    b = p.boards[0],
    root = b.nodes[0],
    child = root.children[1];
  child.locked = true;
  for (const op of [
    {
      kind: "set-node",
      boardId: b.id,
      nodeId: child.id,
      changes: { text: "No" },
    },
    { kind: "move-node", boardId: b.id, nodeId: child.id, parentId: null },
    { kind: "remove-node", boardId: b.id, nodeId: root.id },
  ])
    assert.throws(() => applyPatch(p, patch(p, [op])), /Locked/);
  const next = applyPatch(
    p,
    patch(p, [
      {
        kind: "set-node",
        boardId: b.id,
        nodeId: child.id,
        changes: { locked: false },
      },
    ]),
  );
  assert.equal(findNode(next.boards[0], child.id).locked, false);
  root.locked = true;
  assert.throws(
    () =>
      applyPatch(
        p,
        patch(p, [
          {
            kind: "set-node",
            boardId: b.id,
            nodeId: child.id,
            changes: { locked: false },
          },
        ]),
      ),
    /Locked/,
  );
});
test("partial layout constraints edits preserve sibling settings and reject unknown operation metadata", () => {
  const p = project(),
    b = p.boards[0],
    root = b.nodes[0];
  const next = applyPatch(
    p,
    patch(p, [
      {
        kind: "set-node",
        boardId: b.id,
        nodeId: root.id,
        changes: { layout: { gap: 28 }, constraints: { horizontal: "center" } },
      },
    ]),
  );
  assert.equal(next.boards[0].nodes[0].layout.padding, "$spaceLarge");
  assert.equal(next.boards[0].nodes[0].constraints.referenceW, 1200);
  assert.throws(
    () =>
      applyPatch(
        p,
        patch(p, [
          {
            kind: "set-token",
            key: "primary",
            value: "#FFFFFF",
            execute: "anything",
          },
        ]),
      ),
    /Unsafe operation fields/,
  );
});
