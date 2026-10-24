import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateGuides,
  addGuide,
  updateGuide,
  removeGuide,
  guideTargets,
  rulerTicks,
} from "../src/guides.mjs";
import {
  validateProject,
  hashProject,
  diffProjects,
  standaloneHtml,
  applyPatch,
} from "../src/core.mjs";
import { snapPosition, positionChanges } from "../src/geometry.mjs";
const fixture = JSON.parse(
  fs.readFileSync(new URL("../examples/Orbit.project.json", import.meta.url)),
);
const guide = { id: "baseline", axis: "x", position: 300 };
test("optional guides preserve v1 and alter hash/diff without entering HTML export", () => {
  const p = structuredClone(fixture),
    before = hashProject(p);
  assert.deepEqual(validateProject(p), []);
  addGuide(p.boards[0], guide);
  assert.deepEqual(validateProject(p), []);
  assert.notEqual(hashProject(p), before);
  assert.ok(
    diffProjects(fixture, p).some(
      (d) => d.kind === "board-changed" && d.field === "guides",
    ),
  );
  assert.equal(
    standaloneHtml(p.boards[0], p),
    standaloneHtml(fixture.boards[0], fixture),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(p)).boards[0].guides, [guide]);
  assert.throws(() =>
    applyPatch(p, {
      format: "designforge.patch",
      version: 1,
      baseHash: hashProject(p),
      ops: [{ kind: "set-guides", boardId: p.boards[0].id, guides: [] }],
    }),
  );
});
test("guide schema rejects duplicate IDs, injections, unknown fields and unbounded coordinates", () => {
  for (const value of [
    null,
    {},
    Array(101).fill(guide),
    [guide, guide],
    [null],
    [{ ...guide, id: '"><script>' }],
    [{ ...guide, axis: "z" }],
    [{ ...guide, position: NaN }],
    [{ ...guide, position: -1 }],
    [{ ...guide, position: 10001 }],
    [{ ...guide, position: "30" }],
    [{ ...guide, hidden: "false" }],
    [{ ...guide, style: "url(https://example.com)" }],
  ]) {
    assert.ok(validateGuides(value).length, JSON.stringify(value));
    const p = structuredClone(fixture);
    p.boards[0].guides = value;
    assert.ok(validateProject(p).some((i) => i.path.endsWith(".guides")));
  }
});
test("guide edits enforce lock boundaries and reject mutations without losing data", () => {
  const b = {};
  addGuide(b, guide);
  updateGuide(b, guide.id, { locked: true });
  const before = structuredClone(b);
  for (const fn of [
    () => updateGuide(b, guide.id, { position: 20 }),
    () => updateGuide(b, guide.id, { hidden: true }),
    () => updateGuide(b, guide.id, { locked: false, position: 20 }),
    () => removeGuide(b, guide.id),
    () => addGuide(b, guide),
  ]) {
    assert.throws(fn);
    assert.deepEqual(b, before);
  }
  updateGuide(b, guide.id, { locked: false });
  updateGuide(b, guide.id, { position: 42, hidden: true });
  assert.equal(b.guides[0].position, 42);
  removeGuide(b, guide.id);
  assert.deepEqual(b.guides, []);
});
test("ruler ticks track negative origins, pan and zoom with bounded density", () => {
  for (const z of [0.16, 0.5, 1, 2]) {
    const ticks = rulerTicks(-137, z, 900);
    assert.ok(ticks.length > 10 && ticks.length < 100);
    for (const tick of ticks) {
      assert.ok(tick.pixel >= 20 && tick.pixel <= 900);
      assert.ok(Math.abs(tick.pixel - (-137 + tick.value * z)) < 0.01);
    }
    const majors = ticks.filter((t) => t.major);
    assert.ok(majors.length > 1);
    assert.ok(majors[1].pixel - majors[0].pixel >= 60);
  }
  assert.deepEqual(rulerTicks(0, 0, 900), []);
});
test("board guides snap nested coordinates with borders; hidden guides are ignored, locked guides attract", () => {
  const targets = guideTargets(
    [
      guide,
      { id: "horizontal", axis: "y", position: 200, locked: true },
      { id: "hidden", axis: "x", position: 301, hidden: true },
    ],
    { x: 42, y: 42 },
  );
  assert.deepEqual(targets, { x: [258], y: [158] });
  const n = { id: "item", w: 160, h: 80 },
    parent = { w: 636, h: 476 };
  const pos = snapPosition(n, 260, 160, [], parent, 4, 8, targets);
  assert.equal(pos.x, 258);
  assert.equal(pos.y, 158);
});
test("movement in narrower parents retains end/center/stretch/scale constraints and dimensions", () => {
  const p = { w: 800, h: 600 },
    actual = { w: 500, h: 400 };
  for (const [rule, x, y] of [
    ["start", 100, 60],
    ["end", 400, 260],
    ["center", 250, 160],
    ["stretch", 100, 60],
    ["scale", 160, 90],
  ]) {
    const n = {
      w: 120,
      h: 80,
      constraints: { horizontal: rule, vertical: rule },
    };
    const before = structuredClone(n),
      c = positionChanges(n, { x: 100, y: 60 }, p, actual);
    assert.deepEqual(c, { x, y });
    assert.deepEqual(n, before);
  }
});
