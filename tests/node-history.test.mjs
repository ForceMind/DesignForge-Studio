import test from "node:test";
import assert from "node:assert/strict";
import { newProject, validateProject, hashProject } from "../src/core.mjs";
import { findNode } from "../src/tree.mjs";
import {
  retainHistory,
  historyNodeChoices,
  nodeRevisionTimeline,
  planNodeRevisionRevert,
} from "../src/node-history.mjs";
const copy = structuredClone;
function fixture() {
  const p = newProject("Node revision acceptance");
  p.id = "history-project";
  p.boards = [
    {
      id: "work",
      name: "Work",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "parent",
          name: "Parent",
          type: "frame",
          x: 20,
          y: 20,
          w: 700,
          h: 500,
          text: "",
          style: {},
          children: [
            {
              id: "alpha",
              name: "Alpha",
              type: "text",
              x: 20,
              y: 20,
              w: 160,
              h: 40,
              text: "Original",
              style: { color: "$ink", fontSize: 16 },
            },
            {
              id: "beta",
              name: "Beta",
              type: "button",
              x: 220,
              y: 20,
              w: 100,
              h: 40,
              text: "Keep",
              style: { color: "$ink", fill: "$surface" },
            },
            {
              id: "gamma",
              name: "Gamma",
              type: "rect",
              x: 340,
              y: 20,
              w: 100,
              h: 80,
              text: "",
              style: { fill: "$primary" },
            },
          ],
        },
        {
          id: "destination",
          type: "frame",
          x: 40,
          y: 400,
          w: 500,
          h: 160,
          text: "",
          style: {},
          children: [],
        },
      ],
    },
    {
      id: "other",
      name: "Other board",
      x: 1000,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "alpha",
          type: "text",
          x: 20,
          y: 20,
          w: 160,
          h: 40,
          text: "Other board",
          style: {},
        },
      ],
    },
  ];
  return p;
}
const board = (p) => p.boards[0];
const node = (p, id = "alpha") => findNode(board(p), id);
const plan = (current, before, after, opts = {}) =>
  planNodeRevisionRevert(current, before, after, {
    boardId: "work",
    nodeId: "alpha",
    ...opts,
  });
function valid(p) {
  assert.deepEqual(validateProject(p), []);
  return p;
}
test("selective revert preserves later fields, other nodes, boards, Tokens and preview source bytes", () => {
  const before = valid(fixture()),
    after = copy(before);
  node(after).text = "Revised";
  node(after).style.color = "#FF0000";
  const current = copy(after);
  node(current).style.fontSize = 24;
  node(current, "beta").text = "Manual edit";
  current.tokens.primary = "#336699";
  const saved = copy(current),
    result = plan(current, before, after);
  assert.equal(result.error, null);
  assert.ok(result.project);
  assert.equal(node(result.project).text, "Original");
  assert.equal(node(result.project).style.color, "$ink");
  assert.equal(node(result.project).style.fontSize, 24);
  assert.deepEqual(node(result.project, "beta"), node(current, "beta"));
  assert.deepEqual(result.project.boards[1], current.boards[1]);
  assert.deepEqual(result.project.tokens, current.tokens);
  assert.deepEqual(current, saved);
  assert.equal(result.baseHash, hashProject(current));
});
test("later edits to the same field conflict, while unconflicted explicit subsets can be restored", () => {
  const before = fixture(),
    after = copy(before);
  node(after).text = "First edit";
  node(after).style.color = "#FF0000";
  const current = copy(after);
  node(current).text = "Later manual edit";
  const result = plan(current, before, after);
  assert.equal(
    result.changes.find((c) => c.kind === "text").status,
    "conflict",
  );
  assert.deepEqual(result.selected, ["style.color"]);
  assert.equal(node(result.project).text, "Later manual edit");
  assert.throws(
    () => plan(current, before, after, { keys: ["text + textRuns"] }),
    /冲突/,
  );
  assert.equal(plan(current, before, after, { keys: [] }).project, null);
  assert.throws(
    () =>
      plan(current, before, after, { keys: ["style.color", "style.color"] }),
    /Unknown/,
  );
  assert.throws(
    () => plan(current, before, after, { keys: ["__proto__.polluted"] }),
    /Unknown/,
  );
});
test("text and rich runs revert atomically and respect later formatting edits", () => {
  const before = fixture();
  node(before).textRuns = [{ text: "Original", style: { fontWeight: 700 } }];
  const after = copy(before);
  node(after).text = "Revised";
  delete node(after).textRuns;
  assert.deepEqual(
    node(plan(after, before, after).project).textRuns,
    node(before).textRuns,
  );
  const current = copy(after);
  node(current).textRuns = [{ text: "Revised", style: { italic: true } }];
  assert.equal(plan(current, before, after).changes[0].status, "conflict");
});
test("deleting an introduced nested field preserves newer siblings and restores original field presence", () => {
  const before = fixture();
  delete node(before).sizing;
  const after = copy(before);
  node(after).sizing = { w: "hug" };
  assert.equal(
    Object.hasOwn(node(plan(after, before, after).project), "sizing"),
    false,
  );
  const current = copy(after);
  node(current).sizing.h = "fill";
  assert.deepEqual(node(plan(current, before, after).project).sizing, {
    h: "fill",
  });
  const empty = fixture();
  node(empty).sizing = {};
  const changed = copy(empty);
  node(changed).sizing.w = "hug";
  assert.deepEqual(node(plan(changed, empty, changed).project).sizing, {});
});
test("locks block node and ancestor edits and structural reversal of locked descendants", () => {
  const before = fixture(),
    after = copy(before);
  node(after).name = "Changed";
  for (const id of ["alpha", "parent"]) {
    const current = copy(after);
    node(current, id).locked = true;
    const p = plan(current, before, after);
    assert.equal(p.changes[0].status, "blocked");
    assert.equal(p.project, null);
  }
  const reordered = copy(before);
  node(reordered, "parent").children.reverse();
  node(reordered).locked = true;
  assert.equal(
    plan(reordered, before, reordered, { nodeId: "parent" }).changes.at(-1)
      .status,
    "blocked",
  );
});
test("already restored steps are no-ops and semantic object key order is irrelevant", () => {
  const before = fixture(),
    after = copy(before);
  node(after).style.color = "#FF0000";
  const current = copy(before);
  node(current).style = { fontSize: 16, color: "$ink" };
  const p = plan(current, before, after);
  assert.equal(p.project, null);
  assert.equal(p.changes[0].status, "already");
});
test("removed layers and their annotations recover without disturbing current siblings or annotations", () => {
  const before = fixture();
  before.comments = [
    {
      id: "note",
      boardId: "work",
      nodeId: "alpha",
      text: "Preserve annotation",
    },
  ];
  const after = copy(before);
  node(after, "parent").children.shift();
  after.comments = [];
  const current = copy(after);
  node(current, "beta").text = "Later manual";
  current.comments.push({
    id: "later",
    boardId: "work",
    nodeId: "beta",
    text: "Manual note",
  });
  const result = plan(current, before, after);
  assert.deepEqual(node(result.project), node(before));
  assert.equal(node(result.project, "parent").children[0].id, "alpha");
  assert.equal(node(result.project, "beta").text, "Later manual");
  assert.equal(result.project.comments.length, 2);
  assert.equal(
    plan(result.project, before, after).changes[0].status,
    "already",
  );
});
test("reversing an added layer refuses later subtree edits or new annotations", () => {
  const before = fixture();
  node(before, "parent").children.shift();
  const after = fixture();
  assert.equal(node(plan(after, before, after).project), null);
  for (const mutate of [
    (p) => (node(p).text = "Manual"),
    (p) =>
      p.comments.push({
        id: "newnote",
        boardId: "work",
        nodeId: "alpha",
        text: "Keep",
      }),
  ]) {
    const current = copy(after);
    mutate(current);
    assert.equal(plan(current, before, after).changes[0].status, "conflict");
  }
});
test("recovery refuses missing/locked parents, ID collisions and comment ID reuse without mutation", () => {
  const before = fixture(),
    after = copy(before);
  node(after, "parent").children.shift();
  for (const mutate of [
    (p) => (node(p, "parent").locked = true),
    (p) => board(p).nodes.shift(),
    (p) =>
      node(p, "destination").children.push({
        ...copy(node(before)),
        name: "ID reused",
      }),
  ]) {
    const current = copy(after);
    mutate(current);
    valid(current);
    const saved = copy(current),
      result = plan(current, before, after);
    assert.equal(result.project, null);
    assert.ok(result.error || result.changes[0].status === "conflict");
    assert.deepEqual(current, saved);
  }
  const withNote = copy(before);
  withNote.comments.push({
    id: "collision",
    boardId: "work",
    nodeId: "alpha",
    text: "Old",
  });
  const current = copy(after);
  current.comments.push({
    id: "collision",
    boardId: "work",
    nodeId: "beta",
    text: "New",
  });
  const result = plan(current, withNote, after);
  assert.equal(result.project, null);
  assert.match(result.error, /批注/);
});
test("container order reversal preserves later child content and comments, but conflicts with later reorders", () => {
  const before = fixture(),
    after = copy(before);
  node(after, "parent").children.reverse();
  const current = copy(after);
  node(current).text = "Later text";
  current.comments.push({
    id: "note",
    boardId: "work",
    nodeId: "alpha",
    text: "Keep",
  });
  const result = plan(current, before, after, { nodeId: "parent" });
  assert.deepEqual(
    node(result.project, "parent").children.map((n) => n.id),
    ["alpha", "beta", "gamma"],
  );
  assert.equal(node(result.project).text, "Later text");
  assert.deepEqual(result.project.comments, current.comments);
  node(current, "parent").children.push(
    node(current, "parent").children.shift(),
  );
  assert.equal(
    plan(current, before, after, { nodeId: "parent" }).changes.at(-1).status,
    "conflict",
  );
});
test("children additions/deletions restore as a guarded subtree and preserve own parent fields", () => {
  const before = fixture(),
    after = copy(before);
  node(after, "parent").children.shift();
  const current = copy(after);
  node(current, "parent").style.fill = "#112233";
  const result = plan(current, before, after, { nodeId: "parent" });
  assert.equal(node(result.project, "parent").children.length, 3);
  assert.equal(node(result.project, "parent").style.fill, "#112233");
  node(current, "beta").text = "Later edit";
  assert.equal(
    plan(current, before, after, { nodeId: "parent" }).changes.at(-1).status,
    "conflict",
  );
});
test("parent changes restore original geometry together, leaving later text intact and detecting geometry conflicts", () => {
  const before = fixture(),
    after = copy(before),
    moved = node(after);
  node(after, "parent").children.shift();
  node(after, "destination").children.push(moved);
  moved.x = 35;
  moved.w = 120;
  const current = copy(after);
  node(current).text = "Later content";
  const result = plan(current, before, after);
  assert.ok(result.project);
  assert.equal(node(result.project, "parent").children[0].id, "alpha");
  assert.equal(node(result.project).x, 20);
  assert.equal(node(result.project).w, 160);
  assert.equal(node(result.project).text, "Later content");
  node(current).x = 77;
  assert.equal(plan(current, before, after).changes[0].status, "conflict");
});
test("coordinate reversal after a later reparent is blocked while unrelated text can be restored", () => {
  const before = fixture(),
    after = copy(before);
  node(after).x = 50;
  node(after).text = "Changed";
  const current = copy(after),
    moved = node(current);
  node(current, "parent").children.shift();
  node(current, "destination").children.push(moved);
  const result = plan(current, before, after);
  assert.equal(result.changes.find((c) => c.key === "x").status, "conflict");
  assert.equal(node(result.project).x, 50);
  assert.equal(node(result.project).text, "Original");
});
test("type replacement restores exact source only when its current subtree remains unchanged", () => {
  const before = fixture(),
    after = copy(before);
  node(after).type = "button";
  assert.deepEqual(node(plan(after, before, after).project), node(before));
  const current = copy(after);
  node(current).text = "Manual";
  assert.equal(plan(current, before, after).changes[0].status, "conflict");
});
test("missing token references reject the candidate atomically, while unselecting that field allows other changes", () => {
  const before = fixture();
  before.tokens.brand = "#AABBCC";
  node(before).style.color = "$brand";
  const after = copy(before);
  node(after).style.color = "#112233";
  node(after).name = "New name";
  const current = copy(after);
  delete current.tokens.brand;
  const p = plan(current, before, after);
  assert.equal(p.project, null);
  assert.ok(p.error);
  const subset = plan(current, before, after, { keys: ["name"] });
  assert.equal(node(subset.project).name, "Alpha");
  assert.equal(node(subset.project).style.color, "#112233");
});
test("timeline excludes descendant-only changes and future/cross-project history, and includes removed layers", () => {
  const a = fixture(),
    b = copy(a),
    c = copy(b);
  node(b).text = "Revised";
  node(c).text = "Revised";
  node(c, "parent").children.shift();
  const frames = [a, b, c];
  assert.deepEqual(
    nodeRevisionTimeline(frames, 1, "work", "alpha", a.id).map((r) => r.index),
    [1],
  );
  assert.deepEqual(
    nodeRevisionTimeline(frames, 2, "work", "alpha", a.id).map((r) => r.index),
    [2, 1],
  );
  assert.ok(
    historyNodeChoices(frames, 2, "work", a.id).some((n) => n.id === "alpha"),
  );
  assert.deepEqual(nodeRevisionTimeline([a, b], 1, "work", "parent", a.id), []);
  const foreign = copy(a);
  foreign.id = "foreign";
  assert.deepEqual(
    nodeRevisionTimeline([a, b, foreign, c], 3, "work", "alpha", a.id),
    [],
  );
  assert.throws(() => plan(foreign, a, b), /different projects/);
});
test("history retention enforces entry and serialized size limits without modifying snapshots", () => {
  const snapshots = Array.from({ length: 40 }, (_, i) => ({
    id: "history",
    title: "step" + i,
  }));
  assert.equal(retainHistory(snapshots).length, 35);
  assert.equal(retainHistory(snapshots)[0].title, "step5");
  assert.deepEqual(retainHistory(snapshots, { maxEntries: 10, maxChars: 1 }), [
    snapshots.at(-1),
  ]);
  assert.throws(() => retainHistory(snapshots, { maxEntries: 0 }));
  const saved = copy(snapshots);
  retainHistory(snapshots);
  assert.deepEqual(snapshots, saved);
});
test("untrusted layer labels cannot crash the history view or enter saved revisions", () => {
  for (const name of [false, { toString: "not callable" }, "x".repeat(1001)]) {
    const p = fixture();
    node(p).name = name;
    assert.ok(validateProject(p).some((i) => i.path.endsWith(".name")));
    assert.doesNotThrow(() => historyNodeChoices([p], 0, "work", p.id));
  }
});
