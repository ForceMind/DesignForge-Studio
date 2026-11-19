import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  exportDesignLibrary,
  importDesignLibrary,
  summarizeDesignLibraryImport,
} from "../src/design-library.mjs";
import {
  validateProject,
  standaloneHtml,
  materializeInstance,
  DEFAULT_TOKENS,
} from "../src/core.mjs";
const source = () =>
  JSON.parse(
    fs.readFileSync(
      new URL("../examples/Studio.project.json", import.meta.url),
    ),
  );
const target = () =>
  JSON.parse(
    fs.readFileSync(new URL("../examples/Orbit.project.json", import.meta.url)),
  );
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#123456"/></svg>';
const image = {
  id: "assetLogo",
  name: "Logo",
  type: "image",
  mime: "image/svg+xml",
  data: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"),
};
function withAsset() {
  const p = source();
  p.assets = [image];
  const component = p.components[0];
  component.variants[0].root.children.push({
    id: "libraryImage",
    name: "Library icon",
    type: "image",
    x: 0,
    y: 0,
    w: 24,
    h: 24,
    text: "$primary literal text",
    style: {},
    assetId: image.id,
  });
  component.variants[0].root.children.push({
    id: "literal",
    name: "Literal token example",
    type: "text",
    x: 30,
    y: 0,
    w: 120,
    h: 30,
    text: "$primary",
    style: { color: "$primary", fontSize: 14 },
    textRuns: [{ text: "$primary", style: { color: "$primary" } }],
  });
  component.variants[0].root.responsive = [
    {
      maxWidth: 600,
      changes: {
        style: { fill: "$primary" },
        layout: { mode: "flex", gap: "$spacing" },
      },
    },
  ];
  return p;
}
test("library export contains no boards/comments and round-trips identical design systems without overwriting", () => {
  const p = source(),
    before = structuredClone(p),
    bundle = exportDesignLibrary(p);
  assert.deepEqual(Object.keys(bundle).sort(), [
    "assets",
    "components",
    "format",
    "name",
    "themes",
    "tokens",
    "version",
  ]);
  assert.equal(bundle.format, "designforge.library");
  assert.equal(bundle.version, 1);
  const next = importDesignLibrary(p, JSON.parse(JSON.stringify(bundle)));
  assert.deepEqual(next.boards, p.boards);
  assert.deepEqual(next.comments, p.comments);
  assert.deepEqual(next.tokens, p.tokens);
  assert.deepEqual(next.components, p.components);
  assert.deepEqual(p, before);
  const summary = summarizeDesignLibraryImport(p, bundle);
  assert.equal(summary.tokens.added, 0);
  assert.equal(summary.tokens.reused, Object.keys(p.tokens).length);
  assert.equal(summary.components.reused, p.components.length);
});
test("default conflicting tokens/components reject atomically and keep the current project unchanged", () => {
  const p = target(),
    before = structuredClone(p),
    bundle = exportDesignLibrary(source());
  assert.throws(() => importDesignLibrary(p, bundle), /conflict/);
  assert.deepEqual(p, before);
  const same = source(),
    own = exportDesignLibrary(same);
  own.components[0].name = "Different component";
  assert.throws(() => importDesignLibrary(same, own), /Component conflict/);
});
test("prefixed import namespaces alias/theme/asset/component references while preserving text and current designs", () => {
  const src = withAsset(),
    p = target(),
    before = structuredClone(p),
    bundle = exportDesignLibrary(src);
  const next = importDesignLibrary(p, bundle, { prefix: "kit" });
  assert.deepEqual(p, before);
  assert.deepEqual(next.boards, p.boards);
  assert.deepEqual(next.comments, p.comments);
  assert.equal(next.tokens.primary, p.tokens.primary);
  assert.equal(next.tokens.fontFamily, p.tokens.fontFamily);
  assert.equal(next.tokens.kitPrimary, "$kitAccent");
  assert.equal(next.tokens.kitAccent, src.tokens.accent);
  const oldComponent = src.components[0],
    component = next.components.find((c) => c.id === "kit-" + oldComponent.id);
  assert.ok(component);
  assert.equal(next.assets[0].id, "assetkit-assetLogo");
  const root = component.variants[0].root,
    icon = root.children.find((n) => n.id === "libraryImage"),
    literal = root.children.find((n) => n.id === "literal");
  assert.equal(icon.assetId, "assetkit-assetLogo");
  assert.equal(icon.text, "$primary literal text");
  assert.equal(literal.text, "$primary");
  assert.equal(literal.style.color, "$kitPrimary");
  assert.equal(literal.textRuns[0].text, "$primary");
  assert.equal(literal.textRuns[0].style.color, "$kitPrimary");
  assert.equal(root.responsive[0].changes.layout.gap, "$kitSpacing");
  assert.equal(root.responsive[0].changes.style.fill, "$kitPrimary");
  for (const [name, t] of Object.entries(src.themes))
    assert.deepEqual(
      next.themes["kit-" + name].kitPrimary,
      t.primary?.startsWith("$")
        ? "$kit" + t.primary[1].toUpperCase() + t.primary.slice(2)
        : t.primary,
    );
  assert.deepEqual(validateProject(next), []);
  const instance = {
    id: "importedInstance",
    type: "instance",
    name: "Imported card",
    componentId: component.id,
    variantId: component.variants[0].id,
    x: 10,
    y: 10,
    w: 320,
    h: 140,
    text: "",
    style: {},
  };
  next.boards[0].nodes.push(instance);
  assert.deepEqual(validateProject(next), []);
  const resolved = materializeInstance(instance, next);
  assert.equal(
    resolved.children.find((n) => n.$sourceId === "libraryImage").assetId,
    "assetkit-assetLogo",
  );
  const html = standaloneHtml(next.boards[0], next);
  assert.ok(html.includes(image.data));
  assert.ok(html.includes("$primary literal text"));
  assert.ok(html.includes(src.tokens.accent));
  const summary = summarizeDesignLibraryImport(p, bundle, { prefix: "kit" });
  assert.ok(summary.tokens.added > 10);
  assert.equal(summary.assets.added, 1);
  const again = importDesignLibrary(next, bundle, { prefix: "kit" });
  assert.equal(again.assets.length, next.assets.length);
  assert.equal(again.components.length, next.components.length);
});
test("theme-only token aliases also receive namespaced references", () => {
  const p = source();
  p.themes = { night: { nightOnly: "#123456", nightAlias: "$nightOnly" } };
  const next = importDesignLibrary(target(), exportDesignLibrary(p), {
    prefix: "kit",
  });
  assert.equal(next.themes["kit-night"].kitNightOnly, "#123456");
  assert.equal(next.themes["kit-night"].kitNightAlias, "$kitNightOnly");
});
test("library inputs reject unknown executable fields, prototype keys, malformed or oversized data", () => {
  const p = target(),
    bundle = exportDesignLibrary(source()),
    before = structuredClone(p);
  const bad = [];
  bad.push({ ...bundle, url: "https://example.com" });
  const extra = structuredClone(bundle);
  extra.components[0].variants[0].root.onclick = "alert(1)";
  bad.push(extra);
  const assetExtra = structuredClone(bundle);
  assetExtra.assets = [{ ...image, onload: "alert(1)" }];
  bad.push(assetExtra);
  const unsafeAsset = structuredClone(bundle);
  unsafeAsset.assets = [{ ...image, data: "https://example.com/logo.svg" }];
  bad.push(unsafeAsset);
  const proto = JSON.parse(JSON.stringify(bundle));
  proto.tokens = JSON.parse('{"__proto__": {"polluted":true}}');
  bad.push(proto);
  const large = structuredClone(bundle);
  large.components[0].name = "x".repeat(2 * 1024 * 1024);
  bad.push(large);
  bad.push({ ...bundle, version: 2 });
  bad.push({ ...bundle, assets: null });
  for (const value of bad) {
    assert.throws(() => importDesignLibrary(p, value));
    assert.deepEqual(p, before);
  }
  assert.throws(() => importDesignLibrary(p, bundle, { prefix: "../escape" }));
  assert.throws(() => importDesignLibrary(p, bundle, { prefix: 32 }));
  assert.equal({}.polluted, undefined);
});
test("prefixed imports isolate font families and reject generated token-name collisions", () => {
  const p = source();
  p.tokens.fontFamily = "Georgia";
  const destination = target();
  destination.tokens.fontFamily = "Arial";
  const next = importDesignLibrary(destination, exportDesignLibrary(p), {
    prefix: "kit",
  });
  assert.equal(next.tokens.fontFamily, "Arial");
  assert.equal(next.tokens.kitFontFamily, "Georgia");
  const component = next.components.find(
      (c) => c.id === "kit-" + p.components[0].id,
    ),
    root = component.variants[0].root;
  const textNode = root.children.find((n) =>
    ["text", "button", "pill", "input"].includes(n.type),
  );
  assert.equal(textNode.style.fontFamily, "$kitFontFamily");
  const instance = {
    id: "fontInstance",
    name: "Font instance",
    type: "instance",
    componentId: component.id,
    variantId: component.variants[0].id,
    x: 0,
    y: 0,
    w: 320,
    h: 140,
    text: "",
    style: {},
  };
  next.boards[0].nodes = [instance];
  const html = standaloneHtml(next.boards[0], next);
  assert.ok(html.includes("font-family:Georgia,serif"));
  assert.throws(
    () => importDesignLibrary(destination, exportDesignLibrary(p)),
    /conflict/,
  );
  const other = source();
  other.tokens.foo = 1;
  other.tokens.Foo = 2;
  assert.throws(
    () =>
      importDesignLibrary(target(), exportDesignLibrary(other), {
        prefix: "kit",
      }),
    /token name collisions/,
  );
});

test("library rejects accessors, sparse arrays and cycles before accessing or serializing them", () => {
  const p = target(),
    bundle = exportDesignLibrary(source());
  let invoked = false;
  Object.defineProperty(bundle, "payload", {
    get() {
      invoked = true;
      return "unsafe";
    },
    enumerable: true,
  });
  assert.throws(() => importDesignLibrary(p, bundle), /accessors/);
  assert.equal(invoked, false);
  const sparse = exportDesignLibrary(source());
  sparse.assets = new Array(50001);
  assert.throws(() => importDesignLibrary(p, sparse), /array/);
  const circular = exportDesignLibrary(source());
  circular.tokens.cycle = circular;
  assert.throws(() => importDesignLibrary(p, circular), /JSON/);
});
test("resource budgets and namespace ID limits reject the whole import", () => {
  const p = source(),
    bundle = exportDesignLibrary(p),
    before = structuredClone(p);
  const tooLarge = structuredClone(bundle);
  tooLarge.assets = [
    { ...image, data: "data:image/svg+xml;base64," + "A".repeat(524289) },
  ];
  assert.throws(() => importDesignLibrary(p, tooLarge), /512 KB/);
  assert.deepEqual(p, before);
  const longId = structuredClone(bundle);
  longId.assets = [{ ...image, id: "asset" + "x".repeat(64) }];
  assert.throws(
    () => importDesignLibrary(p, longId, { prefix: "sixteenCharPrefx" }),
    /asset/,
  );
  assert.deepEqual(p, before);
});

test("namespace preserves theme font aliases, explicit node fonts and font asset references", () => {
  const p = source();
  p.assets = [
    {
      id: "assetFace",
      name: "Original typeface",
      type: "font",
      mime: "font/woff2",
      data:
        "data:font/woff2;base64," +
        Buffer.from("wOF2\0\0\0\0font-test-data").toString("base64"),
    },
  ];
  p.tokens.bodyFont = "asset:assetFace";
  p.tokens.headingFont = "Georgia";
  p.tokens.fontFamily = "$bodyFont";
  p.themes = {
    night: {
      bodyFont: "Arial",
      fontFamily: "$bodyFont",
      headingFont: "Verdana",
    },
  };
  const root = p.components[0].variants[0].root;
  root.children.push({
    id: "explicitFace",
    type: "text",
    name: "Explicit typeface",
    x: 0,
    y: 0,
    w: 120,
    h: 30,
    text: "Sample",
    style: { fontSize: 16, fontFamily: "asset:assetFace" },
  });
  root.children.push({
    id: "semanticFace",
    type: "text",
    name: "Semantic typeface",
    x: 0,
    y: 40,
    w: 120,
    h: 30,
    text: "Heading",
    style: { fontSize: 16, fontFamily: "$headingFont" },
  });
  const destination = target();
  destination.tokens.fontFamily = "Arial";
  const next = importDesignLibrary(destination, exportDesignLibrary(p), {
    prefix: "kit",
  });
  assert.equal(next.tokens.fontFamily, "Arial");
  assert.equal(next.tokens.kitFontFamily, "$kitBodyFont");
  assert.equal(next.tokens.kitBodyFont, "asset:assetkit-assetFace");
  assert.equal(next.themes["kit-night"].kitFontFamily, "$kitBodyFont");
  assert.equal(next.themes["kit-night"].kitBodyFont, "Arial");
  const component = next.components.find(
      (c) => c.id === "kit-" + p.components[0].id,
    ),
    nodes = component.variants[0].root.children;
  assert.equal(
    nodes.find((n) => n.id === "explicitFace").style.fontFamily,
    "asset:assetkit-assetFace",
  );
  assert.equal(
    nodes.find((n) => n.id === "semanticFace").style.fontFamily,
    "$kitHeadingFont",
  );
  next.comments = [];
  next.boards[0].nodes = [
    {
      id: "fontAssetInstance",
      type: "instance",
      name: "Font asset instance",
      componentId: component.id,
      variantId: component.variants[0].id,
      x: 0,
      y: 0,
      w: 320,
      h: 140,
      text: "",
      style: {},
    },
  ];
  assert.deepEqual(validateProject(next), []);
  const light = standaloneHtml(next.boards[0], next);
  assert.ok(
    light.includes("font-family:df-assetkit-assetFace,system-ui,sans-serif"),
  );
  assert.ok(light.includes("font-family:Georgia,serif"));
  next.activeTheme = "kit-night";
  const dark = standaloneHtml(next.boards[0], next);
  assert.ok(dark.includes("font-family:Verdana,sans-serif"));
  assert.ok(dark.includes("font-family:Arial,sans-serif"));
});
