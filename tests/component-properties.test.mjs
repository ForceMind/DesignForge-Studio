import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  componentPropertiesMarkup,
  applyComponentProperty,
  resetComponentProperty,
} from "../src/component-properties.mjs";
import { validateProject, materializeInstance } from "../src/core.mjs";
const base = JSON.parse(
  fs.readFileSync(new URL("../examples/Studio.project.json", import.meta.url)),
);
function project() {
  const p = structuredClone(base),
    leaf = (id, type, text = "") => ({
      id,
      type,
      text,
      name: id,
      x: 10,
      y: 10,
      w: 180,
      h: 50,
      style: {},
    });
  p.components = [
    {
      id: "controls",
      name: "Controls",
      variants: [
        {
          id: "normal",
          name: "Normal",
          root: {
            ...leaf("sourceRoot", "frame"),
            w: 500,
            h: 400,
            children: [
              {
                ...leaf("label", "text", "Inherited title"),
                name: 'Label <img src=x onerror="alert(1)">',
              },
              {
                ...leaf("button", "button", "Continue"),
                y: 90,
                style: { fill: "$primary", radius: 8 },
              },
              { ...leaf("decoration", "rect"), y: 160 },
              {
                ...leaf("hiddenGroup", "group"),
                hidden: true,
                children: [leaf("hiddenText", "text", "Hidden")],
              },
              {
                ...leaf("lockedGroup", "group"),
                locked: true,
                children: [leaf("lockedText", "text", "Locked")],
              },
            ],
          },
        },
      ],
    },
  ];
  p.boards = [
    {
      ...p.boards[0],
      nodes: [
        {
          ...leaf("instance", "instance"),
          w: 500,
          h: 400,
          componentId: "controls",
          variantId: "normal",
          overrides: {},
        },
      ],
    },
  ];
  p.comments = [];
  return p;
}
const instance = (p) => p.boards[0].nodes[0];
test("component text/style edits preserve source definitions, sibling fields and related instances", () => {
  const p = project(),
    n = instance(p),
    source = structuredClone(p.components);
  n.overrides.button = { text: "Already customized", style: { radius: 12 } };
  applyComponentProperty(n, p, "label", "text", "My <b>literal</b> title");
  applyComponentProperty(n, p, "button", "style.fill", "$success");
  applyComponentProperty(n, p, "button", "style.opacity", ".5");
  assert.deepEqual(n.overrides.button, {
    text: "Already customized",
    style: { radius: 12, fill: "$success", opacity: 0.5 },
  });
  assert.equal(n.overrides.label.text, "My <b>literal</b> title");
  assert.deepEqual(p.components, source);
  assert.deepEqual(validateProject(p), []);
  const sibling = { ...structuredClone(n), id: "sibling", overrides: {} };
  assert.equal(
    materializeInstance(sibling, p).children[0].text,
    "Inherited title",
  );
  assert.equal(
    materializeInstance(n, p).children[0].text,
    "My <b>literal</b> title",
  );
});
test("component reset removes only requested override and restores current inherited definitions", () => {
  const p = project(),
    n = instance(p);
  n.overrides = {
    label: { text: "Custom", style: { color: "#123456", fontSize: 24 } },
    button: { text: "Keep" },
  };
  resetComponentProperty(n, "label", "style.color", p);
  assert.deepEqual(n.overrides.label, {
    text: "Custom",
    style: { fontSize: 24 },
  });
  resetComponentProperty(n, "label", "style.fontSize", p);
  assert.deepEqual(n.overrides.label, { text: "Custom" });
  p.components[0].variants[0].root.children[0].text = "Updated definition";
  resetComponentProperty(n, "label", "text", p);
  assert.equal(n.overrides.label, undefined);
  assert.deepEqual(n.overrides.button, { text: "Keep" });
  assert.equal(
    materializeInstance(n, p).children[0].text,
    "Updated definition",
  );
  assert.throws(() => resetComponentProperty(n, "missing", "text", p));
  assert.throws(() => resetComponentProperty(n, "button", "style.position", p));
});
test("component fields reject unknown sources, unsupported types, invalid ranges and injection atomically", () => {
  const p = project(),
    n = instance(p);
  for (const [id, field, value] of [
    ["missing", "text", "bad"],
    ["sourceRoot", "style.fill", "#111"],
    ["decoration", "text", "no"],
    ["label", "style.position", "fixed"],
    ["label", "style.color", "red;position:fixed"],
    ["button", "style.fill", "url(https://example.com)"],
    ["label", "style.fontSize", "200"],
    ["label", "style.fontSize", "Infinity"],
    ["label", "style.fontSize", ""],
    ["label", "style.fontSize", "0x20"],
    ["button", "style.opacity", "1.01"],
    ["label", "style.align", "justify"],
    ["label", "text", null],
    ["label", "text", "a".repeat(10001)],
    ["__proto__", "text", "bad"],
  ]) {
    const before = structuredClone(n);
    assert.throws(
      () => applyComponentProperty(n, p, id, field, value),
      `${id}/${field}/${String(value).slice(0, 30)}`,
    );
    assert.deepEqual(n, before);
  }
});
test("component values resolve across all themes and preserve legal token references", () => {
  const p = project(),
    n = instance(p);
  p.tokens.customSize = 20;
  p.themes = { light: { customSize: 24 }, dark: { customSize: 30 } };
  applyComponentProperty(n, p, "label", "style.fontSize", "$customSize");
  assert.equal(n.overrides.label.style.fontSize, "$customSize");
  const before = structuredClone(n);
  p.themes.dark.customSize = "#ff0000";
  assert.throws(() =>
    applyComponentProperty(n, p, "label", "style.fontSize", "$customSize"),
  );
  assert.deepEqual(n, before);
  assert.throws(() =>
    applyComponentProperty(n, p, "label", "style.color", "$missingColor"),
  );
});
test("locked source ancestors are read only while hidden descendants can be customized", () => {
  const p = project(),
    n = instance(p);
  n.overrides.lockedText = { text: "Previously overridden" };
  const before = structuredClone(n);
  assert.throws(() =>
    applyComponentProperty(n, p, "lockedText", "text", "Blocked"),
  );
  assert.throws(() => resetComponentProperty(n, "lockedText", "text", p));
  assert.deepEqual(n, before);
  n.locked = true;
  assert.throws(() => applyComponentProperty(n, p, "label", "text", "Blocked"));
  assert.throws(() => resetComponentProperty(n, "lockedText", "text"));
  n.locked = false;
  applyComponentProperty(n, p, "hiddenText", "text", "Prepared for later");
  assert.equal(n.overrides.hiddenText.text, "Prepared for later");
});
test("component inspector escapes labels/values and exposes only rendered properties and restore controls", () => {
  const p = project(),
    n = instance(p);
  n.overrides.label = {
    text: 'Literal <script>"&',
    style: { color: "#123456" },
  };
  const html = componentPropertiesMarkup(n, p);
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(html.includes("Literal &lt;script&gt;&quot;&amp;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img "));
  assert.ok(html.includes('data-component-reset="text"'));
  assert.ok(
    html.includes(
      'data-component-source="label" data-component-field="style.color"',
    ),
  );
  assert.ok(html.includes('data-component-entry="lockedText"'));
  assert.ok(html.includes('aria-label="lockedText · 文字 Text" disabled'));
  assert.ok(
    !html.includes(
      'data-component-source="decoration" data-component-field="text"',
    ),
  );
  assert.ok(!html.includes('data-component-source="sourceRoot"'));
  assert.ok(html.includes("隐藏"));
});

test("instance font properties preserve aliases/assets and stay isolated from siblings and definitions", () => {
  const p = project(),
    n = instance(p),
    source = structuredClone(p.components);
  p.tokens.fontHeading = "Georgia";
  p.themes = { dark: { fontHeading: "Verdana" } };
  applyComponentProperty(n, p, "label", "style.fontFamily", "$fontHeading");
  assert.equal(n.overrides.label.style.fontFamily, "$fontHeading");
  assert.equal(
    materializeInstance(n, p).children[0].style.fontFamily,
    "$fontHeading",
  );
  const sibling = { ...structuredClone(n), id: "sibling", overrides: {} };
  assert.equal(
    materializeInstance(sibling, p).children[0].style.fontFamily,
    undefined,
  );
  assert.deepEqual(p.components, source);
  p.assets = [
    {
      id: "assetHeadingFont",
      name: "Test font",
      type: "font",
      mime: "font/woff2",
      data:
        "data:font/woff2;base64," + Buffer.from("wOF2test").toString("base64"),
    },
  ];
  applyComponentProperty(
    n,
    p,
    "label",
    "style.fontFamily",
    "asset:assetHeadingFont",
  );
  assert.equal(n.overrides.label.style.fontFamily, "asset:assetHeadingFont");
  assert.deepEqual(validateProject(p), []);
  resetComponentProperty(n, "label", "style.fontFamily", p);
  assert.equal(n.overrides.label, undefined);
  assert.ok(
    componentPropertiesMarkup(n, p).includes(
      'data-component-field="style.fontFamily"',
    ),
  );
  assert.ok(componentPropertiesMarkup(n, p).includes('value="$fontFamily"'));
});
test("instance font properties reject URLs, missing assets and non-font aliases in every theme atomically", () => {
  const p = project(),
    n = instance(p);
  for (const value of [
    "url(https://example.com/font.woff2)",
    "https://example.com/font.woff2",
    "Arial;position:fixed",
    "Unknown Font",
    "asset:missingFont",
    "$spacing",
    "$primary",
    24,
  ]) {
    const before = structuredClone(n);
    assert.throws(() =>
      applyComponentProperty(n, p, "label", "style.fontFamily", value),
    );
    assert.deepEqual(n, before);
  }
  p.tokens.fontHeading = "Georgia";
  p.themes = { dark: { fontHeading: "#ff0000" } };
  const before = structuredClone(n);
  assert.throws(() =>
    applyComponentProperty(n, p, "label", "style.fontFamily", "$fontHeading"),
  );
  assert.deepEqual(n, before);
});
