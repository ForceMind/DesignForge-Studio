import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTextStyle,
  replacePlainText,
  replaceTextPreservingRuns,
  validateTextRuns,
  renderRichText,
} from "../src/richtext.mjs";
import {
  newProject,
  validateProject,
  renderNode,
  standaloneHtml,
  hashProject,
  applyPatch,
  diffProjects,
  materializeInstance,
  effectiveTokens,
  resolveToken,
  validFontValue,
} from "../src/core.mjs";
const textNode = (text = "Hello world") => ({
  id: "heading",
  name: "Heading",
  type: "text",
  x: 20,
  y: 20,
  w: 400,
  h: 80,
  text,
  style: { fontSize: 20, color: "$ink" },
});
function project(node = textNode()) {
  const p = newProject("Rich text");
  p.boards = [
    {
      id: "desktop",
      name: "Desktop",
      x: 0,
      y: 0,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [node],
    },
  ];
  return p;
}
const patch = (p, changes) => ({
  format: "designforge.patch",
  version: 1,
  baseHash: hashProject(p),
  ops: [{ kind: "set-node", boardId: "desktop", nodeId: "heading", changes }],
});
test("range formatting clones input, splits runs, merges identical neighbors and removes individual styles", () => {
  const n = textNode(),
    before = structuredClone(n);
  let next = applyTextStyle(n, 0, 5, { fontWeight: 700, color: "$primary" });
  assert.deepEqual(next.textRuns, [
    { text: "Hello", style: { color: "$primary", fontWeight: 700 } },
    { text: " world" },
  ]);
  next = applyTextStyle(next, 5, 11, { color: "$primary", fontWeight: 700 });
  assert.deepEqual(next.textRuns, [
    { text: "Hello world", style: { color: "$primary", fontWeight: 700 } },
  ]);
  next = applyTextStyle(next, 0, 5, { fontWeight: null });
  assert.deepEqual(next.textRuns, [
    { text: "Hello", style: { color: "$primary" } },
    { text: " world", style: { color: "$primary", fontWeight: 700 } },
  ]);
  assert.deepEqual(n, before);
  assert.deepEqual(replacePlainText(next, "Updated"), {
    ...n,
    text: "Updated",
  });
});
test("UTF-16 selection expands to whole emoji and combining graphemes without corrupting text", () => {
  const text = "A👩‍💻e\u0301 Z",
    n = textNode(text),
    before = structuredClone(n);
  let next = applyTextStyle(n, 2, 3, { italic: true });
  assert.deepEqual(next.textRuns, [
    { text: "A" },
    { text: "👩‍💻", style: { italic: true } },
    { text: "e\u0301 Z" },
  ]);
  next = applyTextStyle(next, 7, 8, { underline: true });
  assert.deepEqual(next.textRuns[2], {
    text: "e\u0301",
    style: { underline: true },
  });
  assert.equal(next.textRuns.map((r) => r.text).join(""), text);
  assert.deepEqual(n, before);
  for (const [a, b] of [
    [0, 0],
    [-1, 2],
    [0, 100],
    [2, 1],
    [1.5, 3],
  ])
    assert.throws(() => applyTextStyle(n, a, b, { italic: true }));
  assert.throws(() =>
    applyTextStyle(n, 0, 1, { background: "url(https://evil.test)" }),
  );
  assert.throws(() =>
    applyTextStyle(textNode("\ud800"), 0, 1, { italic: true }),
  );
});
test("rich text schema rejects invalid types, desynchronized content, unbounded data and arbitrary CSS", () => {
  const base = textNode("Test"),
    good = {
      ...base,
      textRuns: [
        {
          text: "Test",
          style: {
            fontSize: 32,
            fontWeight: 800,
            color: "$primary",
            italic: true,
            underline: false,
            strike: true,
          },
        },
      ],
    };
  assert.deepEqual(validateProject(project(good)), []);
  const invalid = [
    null,
    {},
    Array(257).fill({ text: "T" }),
    [{ text: "Wrong" }],
    [{ text: "Test", html: "<script>" }],
    [{ text: "Test", style: { fontFamily: "url(https://evil.test)" } }],
    [{ text: "Test", style: { fontSize: 181 } }],
    [{ text: "Test", style: { fontWeight: 99 } }],
    [{ text: "Test", style: { color: "red;position:fixed" } }],
    [{ text: "Test", style: { italic: "true" } }],
    [{ text: "Test", style: { color: null } }],
    [{ text: "" }, { text: "Test" }],
    [{ text: "\ud800" }],
  ];
  for (const textRuns of invalid)
    assert.ok(
      validateProject(project({ ...base, textRuns })).some((i) =>
        i.path.endsWith(".textRuns"),
      ),
      JSON.stringify(textRuns),
    );
  assert.ok(
    validateProject(project({ ...good, type: "input" })).some((i) =>
      i.path.endsWith(".textRuns"),
    ),
  );
  assert.deepEqual(
    validateProject(project({ ...textNode(""), textRuns: [] })),
    [],
  );
});
test("safe span rendering escapes markup, resolves palette tokens and emits bounded line height", () => {
  let n = applyTextStyle(textNode('<img onerror="x"> & text'), 0, 16, {
    color: "$primary",
    fontSize: "$emphasisSize",
    fontWeight: 700,
    underline: true,
    strike: true,
  });
  n.style.lineHeight = "$leading";
  const p = project(n);
  p.tokens.emphasisSize = 32;
  p.tokens.leading = 1.6;
  assert.deepEqual(validateProject(p), []);
  const html = standaloneHtml(p.boards[0], p);
  assert.ok(html.includes("data-text-run"));
  assert.ok(
    html.includes(
      "color:#5C4ACF;font-size:32px;font-weight:700;text-decoration-line:underline line-through",
    ),
  );
  assert.ok(html.includes("line-height:1.6"));
  assert.ok(html.includes("&lt;img onerror="));
  assert.ok(!html.includes("<img onerror="));
  const bad = {
    ...n,
    textRuns: [{ text: n.text, style: { color: "url(https://evil.test)" } }],
  };
  const fallback = renderRichText(bad);
  assert.equal(fallback.includes("<span"), false);
  assert.equal(fallback.includes("https://evil.test"), false);
  assert.ok(
    renderRichText({
      ...textNode("plain"),
      textRuns: [
        {
          text: "plain",
          style: { underline: false, strike: false, italic: false },
        },
      ],
    }).includes("font-style:normal;text-decoration-line:none"),
  );
});
test("rich text style tokens are validated against every theme, not only the active palette", () => {
  const n = applyTextStyle(textNode(), 0, 5, {
      color: "$accentText",
      fontSize: "$emphasisSize",
    }),
    p = project(n);
  p.tokens.accentText = "#004477";
  p.tokens.emphasisSize = 24;
  p.themes = { dark: { accentText: "#FFFFFF", emphasisSize: 28 } };
  assert.deepEqual(validateProject(p), []);
  p.themes.dark.emphasisSize = 300;
  assert.ok(validateProject(p).some((i) => i.path.endsWith(".textRuns")));
  p.themes.dark.emphasisSize = 28;
  p.themes.dark.accentText = 44;
  assert.ok(validateProject(p).some((i) => i.path.endsWith(".textRuns")));
  p.themes.dark.accentText = "#FFFFFF";
  p.boards[0].nodes[0].style.lineHeight = 4.1;
  assert.ok(validateProject(p).some((i) => i.path.endsWith(".lineHeight")));
});
test("Patch supports rich text atomically, reports its diff and plain text changes remove old runs", () => {
  const p = project(),
    formatted = applyTextStyle(p.boards[0].nodes[0], 0, 5, { italic: true });
  const next = applyPatch(p, patch(p, { textRuns: formatted.textRuns }));
  assert.deepEqual(next.boards[0].nodes[0].textRuns, formatted.textRuns);
  assert.deepEqual(
    diffProjects(p, next).map((d) => d.field),
    ["textRuns"],
  );
  const plain = applyPatch(next, patch(next, { text: "Plain replacement" }));
  assert.equal(plain.boards[0].nodes[0].textRuns, undefined);
  assert.equal(plain.boards[0].nodes[0].text, "Plain replacement");
  const cleared = applyPatch(next, patch(next, { textRuns: null }));
  assert.equal(cleared.boards[0].nodes[0].textRuns, undefined);
  const before = structuredClone(next),
    bad = patch(next, { text: "Changed", textRuns: [{ text: "Wrong" }] });
  assert.throws(() => applyPatch(next, bad));
  assert.deepEqual(next, before);
  assert.throws(() =>
    applyPatch(
      next,
      patch(next, {
        textRuns: [
          { text: next.boards[0].nodes[0].text, style: { color: "$missing" } },
        ],
      }),
    ),
  );
});
test("instance plain text overrides clear inherited runs, preserve definition, and obey text budget", () => {
  const rich = applyTextStyle(textNode(), 0, 5, { fontWeight: 700 });
  const root = {
      id: "source",
      name: "Source",
      type: "frame",
      x: 0,
      y: 0,
      w: 400,
      h: 100,
      text: "",
      style: {},
      children: [rich],
    },
    p = project();
  p.components = [
    {
      id: "card",
      name: "Card",
      variants: [{ id: "default", name: "Default", root }],
    },
  ];
  const instance = {
    id: "cardInstance",
    name: "Card instance",
    type: "instance",
    x: 0,
    y: 0,
    w: 400,
    h: 100,
    text: "",
    style: {},
    componentId: "card",
    variantId: "default",
    overrides: { heading: { text: "Different words" } },
  };
  p.boards[0].nodes = [instance];
  assert.deepEqual(validateProject(p), []);
  const before = structuredClone(p.components),
    materialized = materializeInstance(instance, p);
  assert.equal(materialized.children[0].text, "Different words");
  assert.equal(materialized.children[0].textRuns, undefined);
  assert.deepEqual(p.components, before);
  instance.overrides.heading.text = "a".repeat(10001);
  assert.ok(validateProject(p).some((i) => i.path.endsWith(".overrides")));
});
test("stroke width tokens render at their resolved numeric width in surfaces and lines", () => {
  const p = project();
  p.tokens.stroke = 3;
  const surface = {
    ...textNode(""),
    type: "rect",
    style: { stroke: "$border", strokeWidth: "$stroke" },
  };
  const line = { ...surface, id: "line", type: "line" };
  p.boards[0].nodes = [surface, line];
  assert.deepEqual(validateProject(p), []);
  assert.ok(
    renderNode(surface, p.boards[0], p.tokens).includes("border:3px solid"),
  );
  assert.ok(
    renderNode(line, p.boards[0], p.tokens).includes("border-top:3px solid"),
  );
});

test("ordinary text edits preserve unchanged run formatting and inherit the replaced or adjacent style", () => {
  const n = {
      ...textNode("left middle right"),
      textRuns: [
        { text: "left ", style: { fontWeight: 700 } },
        { text: "middle", style: { color: "$primary" } },
        { text: " right", style: { italic: true } },
      ],
    },
    before = structuredClone(n);
  const replaced = replaceTextPreservingRuns(n, "left CHANGED right");
  assert.deepEqual(replaced.textRuns, [
    { text: "left ", style: { fontWeight: 700 } },
    { text: "CHANGED", style: { color: "$primary" } },
    { text: " right", style: { italic: true } },
  ]);
  const inserted = replaceTextPreservingRuns(n, "left NEW middle right");
  assert.deepEqual(inserted.textRuns, [
    { text: "left NEW ", style: { fontWeight: 700 } },
    { text: "middle", style: { color: "$primary" } },
    { text: " right", style: { italic: true } },
  ]);
  const deleted = replaceTextPreservingRuns(n, "left right");
  assert.deepEqual(deleted.textRuns, [
    { text: "left ", style: { fontWeight: 700 } },
    { text: "right", style: { italic: true } },
  ]);
  const atStart = replaceTextPreservingRuns(n, "NEW left middle right");
  assert.equal(atStart.textRuns[0].text, "NEW left ");
  assert.deepEqual(atStart.textRuns[0].style, { fontWeight: 700 });
  assert.deepEqual(replaceTextPreservingRuns(n, n.text), n);
  assert.notEqual(replaceTextPreservingRuns(n, n.text), n);
  assert.deepEqual(n, before);
});
test("text-preserving replacement handles emoji, combining characters, newlines and empty content", () => {
  const n = applyTextStyle(textNode("A👩‍💻e\u0301\nZ"), 1, 6, {
      color: "$primary",
    }),
    before = structuredClone(n);
  const inserted = replaceTextPreservingRuns(n, "A👩‍💻\ne\u0301\nZ");
  assert.deepEqual(inserted.textRuns, [
    { text: "A" },
    { text: "👩‍💻\n", style: { color: "$primary" } },
    { text: "e\u0301\nZ" },
  ]);
  const deleted = replaceTextPreservingRuns(n, "Ae\u0301\nZ");
  assert.deepEqual(deleted.textRuns, [{ text: "Ae\u0301\nZ" }]);
  const empty = replaceTextPreservingRuns(n, "");
  assert.equal(empty.text, "");
  assert.deepEqual(empty.textRuns, []);
  for (const next of [inserted, deleted, empty]) {
    assert.equal(next.textRuns.map((r) => r.text).join(""), next.text);
    assert.deepEqual(validateProject(project(next)), []);
  }
  assert.throws(() => replaceTextPreservingRuns(n, "x".repeat(10001)));
  assert.throws(() => replaceTextPreservingRuns(n, "\ud800"));
  assert.deepEqual(n, before);
  assert.deepEqual(
    replaceTextPreservingRuns(textNode(), "Plain updated"),
    textNode("Plain updated"),
  );
});
test("instance style properties override only matching responsive fields and reset restores themed inheritance", async () => {
  const { effectiveNode } = await import("../src/responsive.mjs");
  const source = {
    ...textNode(),
    responsive: [
      {
        maxWidth: 700,
        changes: { style: { color: "$danger", fontSize: 26 }, h: 90 },
      },
      {
        maxWidth: 500,
        changes: { style: { color: "$success" }, hidden: false },
      },
    ],
  };
  const root = {
      id: "sourceRoot",
      type: "frame",
      name: "Source",
      x: 0,
      y: 0,
      w: 400,
      h: 200,
      text: "",
      style: {},
      children: [source],
    },
    p = project();
  p.components = [
    {
      id: "card",
      name: "Card",
      variants: [{ id: "default", name: "Default", root }],
    },
  ];
  const instance = {
    id: "instance",
    type: "instance",
    name: "Instance",
    x: 0,
    y: 0,
    w: 400,
    h: 200,
    text: "",
    style: {},
    componentId: "card",
    variantId: "default",
    overrides: { heading: { style: { color: "$primary" } } },
  };
  p.boards[0].nodes = [instance];
  p.themes = { dark: { primary: "#AABBCC", success: "#CCDDEE" } };
  p.activeTheme = "dark";
  assert.deepEqual(validateProject(p), []);
  const before = structuredClone(p.components),
    projected = materializeInstance(instance, p).children[0];
  assert.deepEqual(projected.responsive, [
    { maxWidth: 700, changes: { style: { fontSize: 26 }, h: 90 } },
    { maxWidth: 500, changes: { hidden: false } },
  ]);
  const narrow = effectiveNode(projected, 400);
  assert.equal(resolveToken(narrow.style.color, effectiveTokens(p)), "#AABBCC");
  assert.equal(narrow.style.fontSize, 26);
  assert.equal(narrow.h, 90);
  assert.equal(narrow.hidden, false);
  delete instance.overrides.heading.style.color;
  const reset = effectiveNode(
    materializeInstance(instance, p).children[0],
    400,
  );
  assert.equal(resolveToken(reset.style.color, effectiveTokens(p)), "#CCDDEE");
  assert.deepEqual(p.components, before);
});

test("rich buttons and pills keep inline runs inside one flex item without changing plain output", () => {
  const source = applyTextStyle(textNode("A < B"), 0, 2, { fontWeight: 700 });
  const text = renderRichText(source);
  assert.equal(text.includes('class="df-rich-content"'), false);
  assert.equal((text.match(/data-text-run/g) || []).length, 2);
  for (const type of ["button", "pill"]) {
    const html = renderRichText({ ...source, type });
    assert.ok(
      html.startsWith(
        '<span class="df-rich-content" style="white-space:pre-wrap;max-width:100%;min-width:0">',
      ),
    );
    assert.equal((html.match(/class="df-rich-content"/g) || []).length, 1);
    assert.equal((html.match(/data-text-run/g) || []).length, 2);
    assert.ok(html.includes(">A </span>"));
    assert.ok(html.includes("&lt; B"));
    assert.equal(renderRichText({ ...textNode("A < B"), type }), "A &lt; B");
  }
});

const fontAsset = (id = "assetFontOne") => ({
  id,
  name: id,
  type: "font",
  mime: "font/woff2",
  data: "data:font/woff2;base64," + Buffer.from("wOF2test").toString("base64"),
});
test("safe node fonts allow two imported fonts and built-in families on the same board", () => {
  const p = project();
  p.assets = [fontAsset(), fontAsset("assetFontTwo")];
  p.tokens.fontFamily = "Georgia";
  p.boards[0].nodes = [
    {
      ...textNode("First font"),
      id: "first",
      style: { fontFamily: "asset:assetFontOne" },
    },
    {
      ...textNode("Second font"),
      id: "second",
      style: { fontFamily: "asset:assetFontTwo" },
    },
    { ...textNode("Default font"), id: "defaultFont" },
  ];
  assert.deepEqual(validateProject(p), []);
  const html = standaloneHtml(p.boards[0], p);
  assert.ok(html.includes("font-family:df-assetFontOne,system-ui,sans-serif"));
  assert.ok(html.includes("font-family:df-assetFontTwo,system-ui,sans-serif"));
  assert.ok(html.includes("font-family:Georgia,serif"));
  for (const family of [
    "system-ui",
    "ui-sans-serif",
    "Georgia",
    "Verdana",
    "Arial",
    "asset:assetFontOne",
  ])
    assert.equal(validFontValue(p, family), true);
  assert.equal(validFontValue(p, "asset:assetMissing"), false);
});
test("semantic font aliases resolve per theme and Patch edits use the same safe font whitelist", () => {
  const p = project();
  p.assets = [fontAsset()];
  p.tokens.brandFont = "asset:assetFontOne";
  p.tokens.headingFont = "$brandFont";
  p.boards[0].nodes[0].style.fontFamily = "$headingFont";
  p.themes = { dark: { brandFont: "Verdana" } };
  assert.deepEqual(validateProject(p), []);
  assert.ok(
    standaloneHtml(p.boards[0], p).includes("font-family:df-assetFontOne"),
  );
  p.activeTheme = "dark";
  assert.ok(
    standaloneHtml(p.boards[0], p).includes("font-family:Verdana,sans-serif"),
  );
  const changed = applyPatch(p, patch(p, { style: { fontFamily: "Arial" } }));
  assert.equal(changed.boards[0].nodes[0].style.fontFamily, "Arial");
  assert.ok(
    standaloneHtml(changed.boards[0], changed).includes(
      "font-family:Arial,sans-serif",
    ),
  );
  p.themes.dark.brandFont = "asset:assetMissing";
  assert.ok(
    validateProject(p).some(
      (i) =>
        i.path.endsWith(".fontFamily") ||
        i.path.includes("themes.dark.brandFont"),
    ),
  );
});
test("font fields reject arbitrary CSS, unknown assets and wrong asset types and protect referenced fonts on deletion", () => {
  for (const value of [
    "Georgia,serif",
    "url(https://evil.test/font)",
    "Arial;position:fixed",
    "asset:assetMissing",
    "asset:assetFontOne;src:url(x)",
    44,
    ["Arial"],
  ]) {
    const p = project();
    p.assets = [fontAsset()];
    p.boards[0].nodes[0].style.fontFamily = value;
    assert.ok(
      validateProject(p).some((i) => i.path.endsWith(".fontFamily")),
      JSON.stringify(value),
    );
    const baseline = project();
    assert.throws(
      () =>
        applyPatch(baseline, patch(baseline, { style: { fontFamily: value } })),
      /validation/,
    );
  }
  const p = project();
  p.assets = [fontAsset()];
  p.tokens.semanticFont = "asset:assetFontOne";
  p.boards[0].nodes[0].style.fontFamily = "$semanticFont";
  assert.deepEqual(validateProject(p), []);
  p.assets = [];
  assert.ok(
    validateProject(p).some(
      (i) => i.path.includes("semanticFont") || i.path.endsWith(".fontFamily"),
    ),
  );
  const wrong = project();
  wrong.assets = [{ ...fontAsset(), type: "image" }];
  wrong.boards[0].nodes[0].style.fontFamily = "asset:assetFontOne";
  assert.equal(validFontValue(wrong, "asset:assetFontOne"), false);
  assert.ok(validateProject(wrong).length);
  const injected = renderNode(
    { ...textNode(), style: { fontFamily: "url(https://evil.test/font)" } },
    project().boards[0],
    project().tokens,
  );
  assert.equal(injected.includes("https://evil.test/font"), false);
});
test("instance font overrides validate themes, beat source breakpoints and reset by removing only the property", async () => {
  const { effectiveNode } = await import("../src/responsive.mjs");
  const source = {
    ...textNode(),
    style: { fontFamily: "Georgia" },
    responsive: [
      {
        maxWidth: 500,
        changes: { style: { fontFamily: "Verdana", fontSize: 28 } },
      },
    ],
  };
  const root = {
      id: "sourceRoot",
      type: "frame",
      name: "Source",
      x: 0,
      y: 0,
      w: 400,
      h: 200,
      text: "",
      style: {},
      children: [source],
    },
    p = project();
  p.components = [
    {
      id: "card",
      name: "Card",
      variants: [{ id: "default", name: "Default", root }],
    },
  ];
  p.tokens.instanceFont = "Arial";
  p.themes = { dark: { instanceFont: "system-ui" } };
  const instance = {
    id: "instance",
    type: "instance",
    name: "Instance",
    x: 0,
    y: 0,
    w: 400,
    h: 200,
    text: "",
    style: {},
    componentId: "card",
    variantId: "default",
    overrides: { heading: { style: { fontFamily: "$instanceFont" } } },
  };
  p.boards[0].nodes = [instance];
  assert.deepEqual(validateProject(p), []);
  const projected = effectiveNode(
    materializeInstance(instance, p).children[0],
    400,
  );
  assert.equal(projected.style.fontFamily, "$instanceFont");
  assert.equal(projected.style.fontSize, 28);
  delete instance.overrides.heading.style.fontFamily;
  const reset = effectiveNode(
    materializeInstance(instance, p).children[0],
    400,
  );
  assert.equal(reset.style.fontFamily, "Verdana");
  assert.equal(reset.style.fontSize, 28);
  instance.overrides.heading.style.fontFamily = "Not a safe font";
  assert.ok(validateProject(p).some((i) => i.path.includes("overrides")));
});

function lockedComponentProject(ancestor = false) {
  const p = project();
  const locked = { ...textNode("Locked source"), locked: !ancestor };
  const branch = {
    id: "lockedBranch",
    name: "Locked branch",
    type: "frame",
    x: 0,
    y: 0,
    w: 400,
    h: 150,
    text: "",
    style: {},
    locked: true,
    children: [locked],
  };
  const other = { ...textNode("Other source"), id: "other", y: 120 };
  const root = {
    id: "sourceRoot",
    name: "Root",
    type: "frame",
    x: 0,
    y: 0,
    w: 400,
    h: 300,
    text: "",
    style: {},
    children: ancestor ? [branch, other] : [locked, other],
  };
  p.components = [
    {
      id: "card",
      name: "Card",
      variants: [
        { id: "default", name: "Default", root },
        { id: "alternate", name: "Alternate", root: structuredClone(root) },
      ],
    },
  ];
  const instance = {
    id: "heading",
    name: "Instance",
    type: "instance",
    x: 0,
    y: 0,
    w: 400,
    h: 300,
    text: "",
    style: {},
    componentId: "card",
    variantId: "default",
    overrides: {
      heading: {
        text: "Existing locked override",
        style: { color: "#112233", fontWeight: 700 },
      },
      other: { text: "Other override" },
    },
  };
  p.boards[0].nodes = [instance];
  return p;
}
test("Patch preserves old locked-source overrides while allowing independent editable properties and unchanged variants", () => {
  const p = lockedComponentProject(),
    original = structuredClone(p);
  assert.deepEqual(validateProject(p), []);
  const overrides = structuredClone(p.boards[0].nodes[0].overrides);
  overrides.heading.style = { fontWeight: 700, color: "#112233" };
  overrides.other.text = "Editable changed";
  const next = applyPatch(p, patch(p, { overrides }));
  assert.equal(
    next.boards[0].nodes[0].overrides.other.text,
    "Editable changed",
  );
  const switched = applyPatch(p, patch(p, { variantId: "alternate" }));
  assert.equal(switched.boards[0].nodes[0].variantId, "alternate");
  const explicitSame = applyPatch(
    p,
    patch(p, {
      variantId: "alternate",
      overrides: structuredClone(p.boards[0].nodes[0].overrides),
    }),
  );
  assert.deepEqual(
    explicitSame.boards[0].nodes[0].overrides,
    p.boards[0].nodes[0].overrides,
  );
  assert.deepEqual(p, original);
});
test("Patch source and ancestor locks reject changed or deleted overrides and roll back an earlier valid operation", () => {
  for (const ancestor of [false, true]) {
    const p = lockedComponentProject(ancestor),
      before = structuredClone(p),
      modified = structuredClone(p.boards[0].nodes[0].overrides);
    modified.heading.text = "Forbidden replacement";
    assert.throws(
      () => applyPatch(p, patch(p, { overrides: modified })),
      /Locked component source/,
    );
    const removed = structuredClone(p.boards[0].nodes[0].overrides);
    delete removed.heading;
    const batch = patch(p, { overrides: removed });
    batch.ops.unshift({ kind: "set-token", key: "primary", value: "#000000" });
    assert.throws(() => applyPatch(p, batch), /Locked component source/);
    assert.deepEqual(p, before);
    assert.deepEqual(validateProject(p), []);
  }
});
test("new instances cannot inject locked-source overrides but may inherit a locked definition without overrides", () => {
  const p = lockedComponentProject(true),
    fresh = { ...structuredClone(p.boards[0].nodes[0]), id: "freshInstance" };
  const add = {
    format: "designforge.patch",
    version: 1,
    baseHash: hashProject(p),
    ops: [{ kind: "add-node", boardId: "desktop", node: fresh }],
  };
  const before = structuredClone(p);
  assert.throws(() => applyPatch(p, add), /Locked component source/);
  assert.deepEqual(p, before);
  delete fresh.overrides;
  const next = applyPatch(p, add);
  assert.equal(next.boards[0].nodes.length, 2);
  assert.deepEqual(validateProject(next), []);
});
