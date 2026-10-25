import { interactionProject } from "./fixtures/interaction-project.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  newProject,
  validateProject,
  standaloneHtml,
  materializeInstance,
  applyPatch,
  hashProject,
  diffProjects,
} from "../src/core.mjs";
import { INTERACTION_STATES } from "../src/interaction-states.mjs";
import { editInteraction } from "../src/state-inspector.mjs";
import {
  exportDesignLibrary,
  importDesignLibrary,
} from "../src/design-library.mjs";
import { measureSceneBudget } from "../src/scene-budget.mjs";
import { planNodeRevisionRevert } from "../src/node-history.mjs";

const fixture = interactionProject;
const node = (p) => p.boards[0].nodes[0];
const patch = (p, changes) => ({
  format: "designforge.patch",
  version: 1,
  baseHash: hashProject(p),
  ops: [{ kind: "set-node", boardId: "work", nodeId: "action", changes }],
});
test("typed interaction states round-trip v1 with safe native CSS, focus and reduced motion", () => {
  const p = fixture();
  assert.deepEqual(validateProject(p), []);
  const html = standaloneHtml(p.boards[0], p);
  assert.match(html, /:hover:not\(:disabled\)/);
  assert.match(
    html,
    /data-node-id="action"\][^{}]*\{background:#123456!important/,
  );
  assert.match(html, /:focus-visible/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(html, /<script/);
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
});
test("unknown state names, geometry, scripting styles and invalid native flags are rejected", () => {
  const bad = [
    { states: { 'hover"]{body{color:red}': { style: { fill: "red" } } } },
    { states: { hover: { style: { w: 300 } } } },
    { states: { hover: { style: { fill: "url(https://example.com/a)" } } } },
    { states: { hover: { style: { opacity: 2 } } } },
    { states: { hover: { style: { fill: "$missing" } } } },
    { states: { hover: { style: { fill: "#123456" }, transition: "all 1s" } } },
    { disabled: "true" },
    { invalid: true },
    { states: [] },
    { states: null },
  ];
  for (const changes of bad) {
    const p = fixture();
    Object.assign(node(p), changes);
    assert.ok(validateProject(p).length, JSON.stringify(changes));
  }
  const p = fixture();
  p.boards[0].nodes[1].loading = true;
  assert.ok(validateProject(p).some((i) => i.path.includes("loading")));
  node(p).type = "rect";
  assert.ok(validateProject(p).some((i) => i.path.includes("states")));
});
test("state token aliases are checked against every project theme", () => {
  const p = fixture();
  p.tokens.hoverInk = "$primary";
  node(p).states.hover.style.color = "$hoverInk";
  p.themes = { broken: { hoverInk: 20 } };
  assert.ok(
    validateProject(p).some((i) => i.path.includes("states.hover.style.color")),
  );
});
test("Patch merges state leaves without replacing other states or user edits, and is atomic", () => {
  const p = fixture(),
    before = structuredClone(p);
  const next = applyPatch(
    p,
    patch(p, { states: { hover: { style: { color: "#FFFFFF" } } } }),
  );
  assert.deepEqual(node(next).states.hover.style, {
    fill: "#123456",
    color: "#FFFFFF",
  });
  assert.deepEqual(node(next).states.active, node(p).states.active);
  assert.deepEqual(next.boards[0].nodes[1], p.boards[0].nodes[1]);
  assert.deepEqual(
    diffProjects(p, next).map((d) => d.field),
    ["states"],
  );
  const bad = patch(p, { text: "Should roll back" });
  bad.ops.push({
    ...bad.ops[0],
    changes: { states: { hover: { style: { position: "fixed" } } } },
  });
  assert.throws(() => applyPatch(p, bad));
  assert.deepEqual(p, before);
  node(p).locked = true;
  assert.throws(() => applyPatch(p, patch(p, { loading: true })), /Locked/);
});
test("loading disables repeated activation; invalid inputs retain accessible native semantics", () => {
  const p = fixture();
  node(p).loading = true;
  p.boards[0].nodes[1].invalid = true;
  assert.deepEqual(validateProject(p), []);
  const html = standaloneHtml(p.boards[0], p);
  assert.match(html, /<button[^>]+disabled aria-busy="true"/);
  assert.match(html, /<input[^>]+aria-invalid="true"[^>]+readonly/);
  assert.match(html, /aria-busy=true\]::before/);
});
function linked() {
  const p = fixture(),
    root = structuredClone(node(p));
  root.id = "source";
  p.components = [
    {
      id: "control",
      name: "Control",
      variants: [{ id: "base", name: "Base", root }],
    },
  ];
  p.boards[0].nodes = [
    {
      id: "one",
      type: "instance",
      name: "One",
      componentId: "control",
      variantId: "base",
      x: 40,
      y: 40,
      w: 220,
      h: 48,
      text: "",
      style: {},
      states: { hover: { style: { color: "#FFDDCC" } } },
    },
    {
      id: "two",
      type: "instance",
      name: "Two",
      componentId: "control",
      variantId: "base",
      x: 40,
      y: 130,
      w: 220,
      h: 48,
      text: "",
      style: {},
    },
  ];
  return p;
}
test("leaf instances inherit and merge source states while exported selectors isolate instances", () => {
  const p = linked();
  assert.deepEqual(validateProject(p), []);
  const root = materializeInstance(node(p), p);
  assert.deepEqual(root.states.hover.style, {
    fill: "#123456",
    color: "#FFDDCC",
  });
  assert.equal(root.type, "button");
  const html = standaloneHtml(p.boards[0], p);
  assert.match(
    html,
    /data-node-id="one"\][^{}]*\{background:#123456!important;color:#FFDDCC!important/,
  );
  assert.match(
    html,
    /data-node-id="two"\][^{}]*\{background:#123456!important\}/,
  );
  assert.doesNotMatch(html, /data-node-id="source"/);
});
test("design library namespace rewrites state aliases without losing native flags", () => {
  const p = linked();
  p.components[0].variants[0].root.states.hover.style.fill = "$primary";
  p.components[0].variants[0].root.disabled = true;
  const bundle = exportDesignLibrary(p),
    target = fixture();
  const next = importDesignLibrary(target, bundle, { prefix: "kit" });
  const source = next.components[0].variants[0].root;
  assert.equal(source.states.hover.style.fill, "$kitPrimary");
  assert.equal(source.disabled, true);
  assert.deepEqual(validateProject(next), []);
});
test("inspector removes explicit state overrides and native flags without losing siblings", () => {
  const p = fixture(),
    n = node(p);
  editInteraction(n, { state: "hover", field: "fill", value: "" });
  assert.equal(n.states.hover, undefined);
  editInteraction(n, { state: "active", field: "opacity", value: "0.6" });
  assert.equal(n.states.active.style.opacity, 0.6);
  editInteraction(n, { flag: "loading", value: "true" });
  assert.equal(n.loading, true);
  editInteraction(n, { flag: "loading", value: "" });
  assert.equal(n.loading, undefined);
  editInteraction(n, { state: "active", reset: true });
  assert.equal(n.states.active, undefined);
  assert.ok(n.states.focus);
  assert.deepEqual(validateProject(p), []);
});
test("node-local history restores states and flags while preserving later independent text edits", () => {
  const before = fixture(),
    after = structuredClone(before);
  node(after).states.hover.style.fill = "#ABCDEF";
  node(after).loading = true;
  const current = structuredClone(after);
  node(current).text = "Manual wording";
  const result = planNodeRevisionRevert(current, before, after, {
    boardId: "work",
    nodeId: "action",
  });
  assert.equal(result.error, null);
  assert.equal(node(result.project).text, "Manual wording");
  assert.deepEqual(node(result.project).states, node(before).states);
  assert.equal(node(result.project).loading, undefined);
});
test("scene budget counts merged state CSS and actual leaf source text before materialization", () => {
  const p = linked();
  p.components[0].variants[0].root.states = Object.fromEntries(
    INTERACTION_STATES.map((s) => [
      s,
      {
        style: {
          fill: "$primary",
          color: "$ink",
          stroke: "$border",
          opacity: 0.8,
        },
      },
    ]),
  );
  p.boards[0].nodes = Array.from({ length: 170 }, (_, i) => ({
    ...node(p),
    id: "inst" + i,
  }));
  assert.ok(
    measureSceneBudget(p).issues.some((i) => i.reason.includes("render units")),
  );
  const text = linked();
  text.components[0].variants[0].root.text = "A".repeat(10000);
  const first = node(text);
  text.boards[0].nodes = Array.from({ length: 201 }, (_, i) => ({
    ...first,
    id: "inst" + i,
    text: "",
  }));
  assert.ok(
    measureSceneBudget(text).issues.some((i) => i.reason.includes("text")),
  );
});
