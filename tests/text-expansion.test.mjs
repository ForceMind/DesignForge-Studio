import test from "node:test";
import assert from "node:assert/strict";
import { expandTextByGraphemes } from "../src/browser-audit.mjs";
test("text expansion appends complete emoji, flags and combining graphemes while preserving original text", () => {
  const text = "A👩‍💻🇨🇳éZ";
  const segment = (value) =>
    [
      ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
        value,
      ),
    ].map((p) => p.segment);
  const original = segment(text),
    expanded = expandTextByGraphemes(text, 1.3);
  assert.equal(expanded, text + "A👩‍💻");
  assert.deepEqual(segment(expanded), [...original, "A", "👩‍💻"]);
  assert.equal(expandTextByGraphemes("👩‍💻", 1.3), "👩‍💻👩‍💻");
  assert.equal(expandTextByGraphemes(text, 1), text);
  assert.equal(expandTextByGraphemes(text, 2), text + text);
  assert.equal(expandTextByGraphemes("", 1.3), "");
});
test("text expansion rejects invalid factors, broken Unicode and oversized text before rendering", () => {
  for (const factor of [NaN, Infinity, 0.99, 2.01, "1.3"])
    assert.throws(() => expandTextByGraphemes("safe", factor), /factor/);
  assert.throws(() => expandTextByGraphemes("\uD83D", 1.3), /Unicode/);
  assert.throws(() => expandTextByGraphemes("a".repeat(200001), 1.3), /budget/);
});
