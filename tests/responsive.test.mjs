import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  effectiveNode,
  setScopedChanges,
  resetScopedField,
  activeBreakpoint,
} from "../src/responsive.mjs";
import { validateProject } from "../src/core.mjs";
const node = () => ({
  id: "node",
  w: 400,
  h: 200,
  layout: { mode: "grid", columns: 3, gap: 24, padding: 16 },
  style: { fill: "#FFFFFF", radius: 12 },
  responsive: [
    {
      maxWidth: 900,
      changes: { layout: { columns: 2, gap: 20 }, style: { radius: 16 } },
    },
    {
      maxWidth: 600,
      changes: { layout: { columns: 1 }, style: { fill: "#000000" } },
    },
  ],
});
test("narrow breakpoints inherit larger overrides, including nested layout/style fields", () => {
  const n = node(),
    before = structuredClone(n),
    e = effectiveNode(n, 390);
  assert.equal(e.layout.columns, 1);
  assert.equal(e.layout.gap, 20);
  assert.equal(e.layout.padding, 16);
  assert.equal(e.style.radius, 16);
  assert.equal(e.style.fill, "#000000");
  assert.equal(activeBreakpoint(n, 390), 600);
  assert.equal(activeBreakpoint(n, 1200), null);
  assert.deepEqual(n, before);
});
test("scoped edit preserves base, other widths and unrelated override fields", () => {
  const n = node(),
    base = structuredClone(n.layout);
  setScopedChanges(n, { layout: { gap: 8 }, sizing: { w: "hug" } }, 600);
  assert.deepEqual(n.layout, base);
  assert.equal(n.responsive[0].changes.layout.gap, 20);
  assert.equal(n.responsive[1].changes.layout.columns, 1);
  assert.equal(effectiveNode(n, 390).layout.gap, 8);
  assert.equal(effectiveNode(n, 768).layout.gap, 20);
});
test("field reset restores inherited value without deleting siblings or the scope", () => {
  const n = node();
  setScopedChanges(n, { layout: { gap: 8 } }, 600);
  resetScopedField(n, 600, "layout.gap");
  assert.equal(effectiveNode(n, 390).layout.gap, 20);
  assert.equal(effectiveNode(n, 390).layout.columns, 1);
  resetScopedField(n, 600, "style.fill");
  assert.equal(effectiveNode(n, 390).style.fill, "#FFFFFF");
  assert.equal(n.responsive.length, 2);
  assert.throws(() => resetScopedField(n, 600, "style.__proto__"), /Invalid/);
});
test("scopes reject structural edits, and project validation rejects duplicate widths", () => {
  assert.throws(
    () => setScopedChanges(node(), { text: "Cannot scope content" }, 600),
    /Field/,
  );
  assert.throws(() => setScopedChanges(node(), {}, 100), /width/);
  const p = JSON.parse(
    fs.readFileSync(
      new URL("../examples/Studio.project.json", import.meta.url),
    ),
  );
  p.boards[0].nodes[0].responsive = [
    { maxWidth: 600, changes: {} },
    { maxWidth: 600, changes: {} },
  ];
  assert.ok(
    validateProject(p).some((i) => i.reason.includes("Duplicate breakpoint")),
  );
});
