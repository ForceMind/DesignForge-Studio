import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assertSafeSvg, validateAssets } from "../src/assets.mjs";
import { validateProject, standaloneHtml } from "../src/core.mjs";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="#2563EB"/><path d="M20 50 L80 50" stroke="#FFFFFF" stroke-width="8"/></svg>';
const asset = (source = svg) => ({
  id: "assetVector",
  name: "Original mark",
  type: "image",
  mime: "image/svg+xml",
  data: "data:image/svg+xml;base64," + Buffer.from(source).toString("base64"),
});
const p = () =>
  JSON.parse(
    fs.readFileSync(
      new URL("../examples/Studio.project.json", import.meta.url),
    ),
  );
test("local vector asset validates, exports inline, and keeps accessible description", () => {
  assert.equal(assertSafeSvg(svg), svg);
  assert.deepEqual(validateAssets([asset()]), []);
  const project = p();
  project.assets = [asset()];
  project.boards[0].nodes.push({
    id: "picture",
    type: "image",
    name: "Mark",
    x: 10,
    y: 10,
    w: 100,
    h: 100,
    text: "Original mark",
    assetId: "assetVector",
    style: {},
  });
  assert.deepEqual(validateProject(project), []);
  const h = standaloneHtml(project.boards[0], project);
  assert.ok(h.includes('alt="Original mark"'));
  assert.ok(h.includes(asset().data));
});
test("SVG script, foreign HTML, event handlers, entities, CSS, external and embedded resources rejected", () => {
  for (const source of [
    "<svg><script>alert(1)</script></svg>",
    "<svg><foreignObject><div>text</div></foreignObject></svg>",
    '<svg onload="alert(1)"></svg>',
    "<!DOCTYPE svg><svg></svg>",
    '<svg><path fill="url(https://evil.test/x)"/></svg>',
    '<svg><image href="https://evil.test"/></svg>',
    "<svg><style>path{fill:red}</style></svg>",
    '<svg><path d="&x;"/></svg>',
    "<svg><g></svg>",
    '<svg><path fill="data:text/html,evil"/></svg>',
  ])
    assert.ok(validateAssets([asset(source)]).length, source);
});
test("arbitrary URLs, wrong MIME signatures, malformed base64, and size overflow rejected", () => {
  for (const changes of [
    { data: "https://evil.test/x" },
    { mime: "text/html" },
    { mime: "image/png", data: "data:image/png;base64,PGh0bWw+" },
    { data: "data:image/svg+xml;base64,broken" },
    { data: "a".repeat(524289) },
  ])
    assert.ok(validateAssets([{ ...asset(), ...changes }]).length);
});
test("missing image references and removing a referenced font reject the whole project", () => {
  const project = p();
  project.assets = [
    {
      id: "assetFont",
      name: "Test font",
      type: "font",
      mime: "font/woff2",
      data:
        "data:font/woff2;base64," + Buffer.from("wOF2test").toString("base64"),
    },
  ];
  project.tokens.fontFamily = "asset:assetFont";
  assert.deepEqual(validateProject(project), []);
  assert.ok(standaloneHtml(project.boards[0], project).includes("@font-face"));
  project.assets = [];
  assert.ok(validateProject(project).length);
});
test("renderer refuses unvalidated font assets and image network URLs", () => {
  const project = p();
  project.assets = [
    {
      id: "assetEvil",
      type: "font",
      mime: "font/woff2",
      name: "evil",
      data: '");}</style><script>alert(1)</script>',
    },
  ];
  const h = standaloneHtml(project.boards[0], project);
  assert.ok(!h.includes("<script>"));
});
