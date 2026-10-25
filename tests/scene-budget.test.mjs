import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SCENE_LIMITS,
  measureSceneBudget,
  sceneBudgetIssues,
  assertBoardSceneBudget,
} from "../src/scene-budget.mjs";
import { newProject, validateProject, renderBoard } from "../src/core.mjs";
const leaf = (id, text = "") => ({
  id,
  name: id,
  type: "text",
  x: 0,
  y: 0,
  w: 100,
  h: 40,
  text,
  style: { fontSize: 14, color: "$ink" },
});
function project({ instances = 100, children = 10, value = "" } = {}) {
  const p = newProject("Scene budget");
  p.components = [
    {
      id: "card",
      name: "Card",
      variants: [
        {
          id: "normal",
          name: "Normal",
          root: {
            ...leaf("root"),
            type: "frame",
            children: Array.from({ length: children }, (_, i) =>
              leaf("source" + i, value),
            ),
          },
        },
      ],
    },
  ];
  p.boards = [
    {
      id: "board",
      name: "Board",
      x: 0,
      y: 0,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: Array.from({ length: instances }, (_, i) => ({
        ...leaf("instance" + i),
        type: "instance",
        componentId: "card",
        variantId: "normal",
      })),
    },
  ];
  return p;
}
test("a tiny persisted file cannot amplify component instances past the projected board budget", () => {
  const p = project({ instances: 100, children: 100 }),
    before = structuredClone(p);
  assert.ok(JSON.stringify(p).length < 35000);
  assert.ok(
    sceneBudgetIssues(p).some((i) => /5000 render units/.test(i.reason)),
  );
  assert.ok(
    validateProject(p).some((i) =>
      i.reason.startsWith("Scene resource budget:"),
    ),
  );
  assert.throws(
    () => renderBoard(p.boards[0], p.tokens, p),
    /Scene resource budget.*5000 render units/,
  );
  assert.deepEqual(p, before);
});
test("a component variant is summarized once but each instance contributes its full projected cost", () => {
  const p = project({ instances: 100, children: 10, value: "abc" }),
    before = structuredClone(p),
    budget = measureSceneBudget(p);
  assert.deepEqual(budget.issues, []);
  assert.deepEqual(budget.totals, { units: 1100, textCharacters: 3000 });
  assert.equal(budget.stats.componentSummaries, 1);
  assert.equal(budget.stats.visitedNodes, 111);
  assert.deepEqual(p, before);
  assert.deepEqual(assertBoardSceneBudget(p.boards[0], p), budget.totals);
});
test("rich spans and inline wrappers count as render units; plain instance overrides replace their text costs", () => {
  const p = project({ instances: 2, children: 1 }),
    source = p.components[0].variants[0].root.children[0];
  source.text = "abcdef";
  source.textRuns = [
    { text: "ab" },
    { text: "cd", style: { fontWeight: 700 } },
    { text: "ef" },
  ];
  p.boards[0].nodes[1].overrides = { source0: { text: "long" } };
  const budget = measureSceneBudget(p);
  assert.deepEqual(budget.issues, []);
  assert.deepEqual(budget.totals, { units: 7, textCharacters: 10 });
  const button = { ...source, id: "button", type: "button" };
  p.boards[0].nodes = [source, button];
  assert.deepEqual(measureSceneBudget(p).totals, {
    units: 9,
    textCharacters: 12,
  });
});
test("render spans and total projected boards have separate bounded resource ceilings", () => {
  const p = project({ instances: 0, children: 0 });
  p.boards[0].nodes = Array.from({ length: 500 }, (_, i) => ({
    ...leaf("t" + i, "xxxxxxxxxxx"),
    textRuns: Array.from({ length: 11 }, (_, j) => ({
      text: "x",
      style: { fontWeight: j % 2 ? 700 : 400 },
    })),
  }));
  assert.ok(sceneBudgetIssues(p).some((i) => /render units/.test(i.reason)));
  const q = project({ instances: 500, children: 7 }),
    original = q.boards[0];
  q.boards = Array.from({ length: 5 }, (_, i) => ({
    ...original,
    id: "board" + i,
  }));
  assert.deepEqual(sceneBudgetIssues(q), []);
  assert.equal(measureSceneBudget(q).totals.units, SCENE_LIMITS.projectUnits);
  q.boards.push({ ...original, id: "board5" });
  assert.ok(
    sceneBudgetIssues(q).some((i) => /project exceeds 20000/.test(i.reason)),
  );
});
test("instance multiplication cannot bypass the projected text-character budget", () => {
  const p = project({ instances: 210, children: 1, value: "x".repeat(10000) }),
    before = structuredClone(p);
  assert.ok(
    sceneBudgetIssues(p).some((i) => /2000000 characters/.test(i.reason)),
  );
  assert.throws(
    () => renderBoard(p.boards[0], p.tokens, p),
    /2000000 characters/,
  );
  assert.deepEqual(p, before);
  const q = project({ instances: 110, children: 1, value: "x".repeat(10000) });
  q.boards.push({ ...q.boards[0], id: "other" });
  assert.ok(
    sceneBudgetIssues(q).some((i) =>
      /projected text characters/.test(i.reason),
    ),
  );
});
test("malformed, recursive or excessively deep trees fail closed without throwing from validation", () => {
  for (const kind of [
    "unknown",
    "bad-definition",
    "nested-instance",
    "cycle",
    "depth",
    "bad-runs",
  ]) {
    const p = project({ instances: 1, children: 1 });
    if (kind === "unknown") p.boards[0].nodes[0].variantId = "missing";
    if (kind === "bad-definition") p.components = [null];
    if (kind === "nested-instance")
      p.components[0].variants[0].root.children = [p.boards[0].nodes[0]];
    if (kind === "cycle") {
      const root = p.components[0].variants[0].root;
      root.children = [root];
    }
    if (kind === "depth") {
      let n = p.components[0].variants[0].root;
      for (let i = 0; i < 22; i++) {
        const next = { ...leaf("deep" + i), type: "frame", children: [] };
        n.children = [next];
        n = next;
      }
    }
    if (kind === "bad-runs")
      p.components[0].variants[0].root.children[0].textRuns = {};
    let issues;
    assert.doesNotThrow(() => {
      issues = sceneBudgetIssues(p);
    }, kind);
    assert.ok(issues.length, kind);
    assert.ok(
      issues.every((i) => i.reason.startsWith("Scene resource budget:")),
      kind,
    );
    assert.doesNotThrow(() => validateProject(p), kind);
    assert.throws(
      () => renderBoard(p.boards[0], p.tokens, p),
      /Scene resource budget/,
      kind,
    );
  }
});
test("direct board rendering guards only the requested scene without repeatedly validating unrelated boards", () => {
  const p = project({ instances: 2, children: 2 }),
    valid = p.boards[0];
  p.boards = [null];
  assert.deepEqual(assertBoardSceneBudget(valid, p), {
    units: 6,
    textCharacters: 0,
  });
  assert.match(renderBoard(valid, p.tokens, p), /data-board-id="board"/);
});
test("all existing v1 examples remain below projection budgets and retain their original data", () => {
  for (const file of fs
    .readdirSync(new URL("../examples", import.meta.url))
    .filter((name) => name.endsWith(".project.json"))) {
    const p = JSON.parse(
        fs.readFileSync(new URL("../examples/" + file, import.meta.url)),
      ),
      before = structuredClone(p);
    assert.deepEqual(sceneBudgetIssues(p), [], file);
    assert.deepEqual(p, before, file);
  }
});
