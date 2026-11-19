import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  setDesignToken,
  resetThemeToken,
  deleteDesignToken,
  tokenRowsMarkup,
} from "../src/token-editor.mjs";
import { validateProject, effectiveTokens } from "../src/core.mjs";
const base = JSON.parse(
  fs.readFileSync(new URL("../examples/Studio.project.json", import.meta.url)),
);
const project = () => structuredClone(base);
test("base Token editing retains raw aliases, parses numbers and preserves unrelated objects", () => {
  const p = project(),
    boards = p.boards,
    components = p.components,
    beforeAccent = p.tokens.accent;
  setDesignToken(p, "primary", "$accent");
  setDesignToken(p, "spacing", " 24 ");
  setDesignToken(p, "newColor", "#abcdef");
  assert.equal(p.tokens.primary, "$accent");
  assert.equal(p.tokens.spacing, 24);
  assert.equal(p.tokens.newColor, "#abcdef");
  assert.equal(p.tokens.accent, beforeAccent);
  assert.equal(p.boards, boards);
  assert.equal(p.components, components);
  assert.deepEqual(validateProject(p), []);
});
test("active-theme edits and new theme-only keys do not write through to the base or siblings", () => {
  const p = project();
  p.themes = { dark: {}, light: { accent: "#112233" } };
  p.activeTheme = "dark";
  const beforeTokens = structuredClone(p.tokens),
    beforeLight = structuredClone(p.themes.light);
  setDesignToken(p, "accent", "#654321");
  setDesignToken(p, "themeSpacing", "32");
  setDesignToken(p, "themeAlias", "$themeSpacing");
  assert.deepEqual(p.tokens, beforeTokens);
  assert.deepEqual(p.themes.light, beforeLight);
  assert.deepEqual(p.themes.dark, {
    accent: "#654321",
    themeSpacing: 32,
    themeAlias: "$themeSpacing",
  });
  assert.equal(effectiveTokens(p).themeAlias, "$themeSpacing");
  assert.deepEqual(validateProject(p), []);
});
test("invalid values, reserved names, missing aliases and cycles reject atomically", () => {
  const p = project();
  for (const [key, value] of [
    ["__proto__", 16],
    ["constructor", 16],
    ["prototype", 16],
    ["bad-name", 16],
    ["primary", "red;position:fixed"],
    ["primary", "$spacing"],
    ["spacing", -1],
    ["spacing", 3201],
    ["spacing", Infinity],
    ["spacing", {}],
    ["fontFamily", "url(https://example.com)"],
    ["fontFamily", "Unknown Font"],
    ["radius", 101],
    ["newToken", "$missingAlias"],
    ["primary", "$primary"],
  ]) {
    const before = structuredClone(p);
    assert.throws(
      () => setDesignToken(p, key, value),
      `${key}:${String(value)}`,
    );
    assert.deepEqual(p, before);
  }
  setDesignToken(p, "firstAlias", "$spacing");
  setDesignToken(p, "secondAlias", "$firstAlias");
  const before = structuredClone(p);
  assert.throws(() => setDesignToken(p, "firstAlias", "$secondAlias"));
  assert.deepEqual(p, before);
});
test("theme reset restores inheritance and refuses to break dependent theme-only aliases", () => {
  const p = project();
  p.themes = {
    dark: { spacing: 20, local: 30, dependent: "$local" },
    light: { spacing: 28 },
  };
  p.activeTheme = "dark";
  const beforeTokens = structuredClone(p.tokens),
    beforeLight = structuredClone(p.themes.light);
  resetThemeToken(p, "spacing");
  assert.equal(Object.hasOwn(p.themes.dark, "spacing"), false);
  assert.equal(effectiveTokens(p).spacing, p.tokens.spacing);
  assert.deepEqual(p.tokens, beforeTokens);
  assert.deepEqual(p.themes.light, beforeLight);
  const before = structuredClone(p);
  assert.throws(() => resetThemeToken(p, "local"));
  assert.deepEqual(p, before);
  assert.throws(() => resetThemeToken(p, "missing"));
  delete p.activeTheme;
  assert.throws(() => resetThemeToken(p, "spacing"));
});
test("only unused custom base Tokens can be deleted; every node and theme reference remains valid", () => {
  const p = project();
  setDesignToken(p, "unused", 16);
  deleteDesignToken(p, "unused");
  assert.equal(Object.hasOwn(p.tokens, "unused"), false);
  for (const key of ["primary", "radius", "fontFamily"])
    assert.throws(() => deleteDesignToken(p, key));
  setDesignToken(p, "sharedColor", "#123456");
  p.boards[0].nodes[0].style.fill = "$sharedColor";
  let before = structuredClone(p);
  assert.throws(() => deleteDesignToken(p, "sharedColor"));
  assert.deepEqual(p, before);
  setDesignToken(p, "themeBase", 16);
  p.themes.dark.themeAlias = "$themeBase";
  before = structuredClone(p);
  assert.throws(() => deleteDesignToken(p, "themeBase"));
  assert.deepEqual(p, before);
  p.activeTheme = "dark";
  assert.throws(() => deleteDesignToken(p, "themeBase"));
});
test("base and effective-theme Token maps enforce the 200-key limit", () => {
  const p = project();
  p.themes = {};
  delete p.activeTheme;
  let count = 0;
  while (Object.keys(p.tokens).length < 200) p.tokens[`extra${count++}`] = 1;
  assert.deepEqual(validateProject(p), []);
  let before = structuredClone(p);
  assert.throws(() => setDesignToken(p, "overflow", 1));
  assert.deepEqual(p, before);
  p.themes.dark = {};
  p.activeTheme = "dark";
  before = structuredClone(p);
  assert.throws(() => setDesignToken(p, "themeOverflow", 1));
  assert.deepEqual(p, before);
  setDesignToken(p, "spacing", 48);
  assert.equal(p.themes.dark.spacing, 48);
  assert.equal(Object.keys(p.tokens).length, 200);
});
test("Token markup exposes custom base/theme union, raw color aliases and scoped restore controls", () => {
  const p = project();
  p.themes.dark.themeOnly = 42;
  p.themes.dark.themeAlias = "$themeOnly";
  p.activeTheme = "dark";
  const html = tokenRowsMarkup(p);
  assert.ok(html.includes('data-design-token="themeOnly"'));
  assert.ok(html.includes('data-design-token="spacing"'));
  assert.ok(html.includes('data-design-token="themeAlias" value="$themeOnly"'));
  assert.ok(html.includes('data-token-reset="themeOnly"'));
  assert.ok(!html.includes("data-token-delete="));
  assert.ok(!html.includes('data-design-token="radius"'));
  assert.ok(!html.includes('data-design-token="fontFamily"'));
  delete p.activeTheme;
  const baseHtml = tokenRowsMarkup(p);
  assert.ok(baseHtml.includes('data-design-token="primary" value="$accent"'));
  assert.ok(baseHtml.includes('data-token-delete="spacing"'));
  assert.ok(!baseHtml.includes('data-design-token="themeOnly"'));
  assert.ok(!baseHtml.includes('data-token-delete="primary"'));
});
test("invalid active themes cannot redirect writes and untrusted display values stay escaped", () => {
  const p = project();
  p.activeTheme = "missing";
  let before = structuredClone(p);
  assert.throws(() => setDesignToken(p, "spacing", 24));
  assert.deepEqual(p, before);
  delete p.activeTheme;
  p.tokens.displayOnly = '<img src=x onerror="alert(1)">';
  const html = tokenRowsMarkup(p);
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(!html.includes("<img "));
});
