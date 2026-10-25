import test from "node:test";
import assert from "node:assert/strict";
import {
  STARTER_ITEMS,
  findStarters,
  insertStarter,
  starterPreview,
  starterComponent,
  starterCards,
} from "../src/starter-gallery.mjs";
import { interactionProject } from "./fixtures/interaction-project.mjs";
import { validateProject, standaloneHtml } from "../src/core.mjs";
import {
  exportDesignLibrary,
  importDesignLibrary,
} from "../src/design-library.mjs";
test("all 12 original starter recipes produce valid editable components and safe exported states", () => {
  let p = interactionProject();
  const before = structuredClone(p);
  for (const item of STARTER_ITEMS)
    p = insertStarter(p, "work", item.id).project;
  assert.equal(p.components.length, 12);
  assert.deepEqual(validateProject(p), []);
  assert.deepEqual(p.tokens, before.tokens);
  assert.deepEqual(p.boards[0].nodes.slice(0, 2), before.boards[0].nodes);
  assert.doesNotMatch(standaloneHtml(p.boards[0], p), /<script|https?:\/\//);
  const target = importDesignLibrary(
    interactionProject(),
    exportDesignLibrary(p),
    { prefix: "curated" },
  );
  assert.equal(target.components.length, 12);
  assert.deepEqual(validateProject(target), []);
});
test("search intersects words and category; pagination is bounded and hostile queries cannot create markup", () => {
  assert.equal(findStarters("button primary", "buttons")[0].id, "primary");
  assert.equal(findStarters("按钮", "inputs").length, 0);
  assert.equal(findStarters("空状态")[0].id, "empty");
  assert.equal(
    (starterCards(interactionProject(), { page: 999 }).match(/<iframe /g) || [])
      .length,
    4,
  );
  const html = starterCards(interactionProject(), {
    query: "<img src=x onerror=alert(1)>",
  });
  assert.doesNotMatch(html, /<img|<iframe/);
  assert.match(html, /未找到/);
});
test("repeated insert reuses identical definitions but never overwrites a hand-edited source", () => {
  const initial = interactionProject(),
    first = insertStarter(initial, "work", "primary"),
    next = insertStarter(first.project, "work", "primary");
  assert.notEqual(first.nodeId, next.nodeId);
  assert.equal(next.project.components.length, 1);
  next.project.components[0].variants[0].root.text = "Hand edited";
  const result = insertStarter(next.project, "work", "primary");
  assert.equal(result.project.components.length, 2);
  assert.equal(
    result.project.components[0].variants[0].root.text,
    "Hand edited",
  );
  assert.equal(result.project.components[1].variants[0].root.text, "开始设计");
  assert.equal(initial.components, undefined);
});
test("preview is sandbox compatible, offline and uses the current theme without project mutation", () => {
  const p = interactionProject(),
    before = structuredClone(p);
  p.tokens.primary = "#123456";
  const html = starterPreview(p, "primary");
  assert.match(html, /default-src 'none'/);
  assert.match(html, /font-src data:/);
  assert.match(html, /background:#123456/);
  assert.doesNotMatch(html, /<script|https?:\/\//);
  assert.equal(p.components, undefined);
  assert.deepEqual(p.boards, before.boards);
  assert.throws(() => starterComponent("unknown"));
  assert.throws(() => insertStarter(p, "missing", "primary"));
});
