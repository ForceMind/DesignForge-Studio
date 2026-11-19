import test from "node:test";
import assert from "node:assert/strict";
import {
  breakpointIntervals,
  breakpointOverviewMarkup,
} from "../src/breakpoint-overview.mjs";
import { activeBreakpoint } from "../src/responsive.mjs";
const node = {
  responsive: [1024, 390, 600].map((maxWidth) => ({ maxWidth, changes: {} })),
};
test("breakpoint intervals partition supported preview widths with the same cascade boundaries as the renderer", () => {
  const ranges = breakpointIntervals(node),
    before = structuredClone(node);
  assert.deepEqual(ranges, [
    { min: 280, max: 390, scope: 390 },
    { min: 390, max: 600, scope: 600 },
    { min: 600, max: 1024, scope: 1024 },
    { min: 1024, max: 2400, scope: null },
  ]);
  for (const width of [280, 390, 390.01, 600, 600.1, 1024, 1025, 2400]) {
    const range = ranges.find(
      (r, i) => width <= r.max && (i === 0 ? width >= r.min : width > r.min),
    );
    assert.equal(range.scope, activeBreakpoint(node, width));
  }
  assert.deepEqual(node, before);
});
test("empty, exact-edge and fractional breakpoints retain representable point ranges and omit unreachable base", () => {
  assert.deepEqual(breakpointIntervals({}), [
    { min: 280, max: 2400, scope: null },
  ]);
  const edge = {
    responsive: [280, 600.5, 2400].map((maxWidth) => ({
      maxWidth,
      changes: {},
    })),
  };
  assert.deepEqual(breakpointIntervals(edge), [
    { min: 280, max: 280, scope: 280 },
    { min: 280, max: 600.5, scope: 600.5 },
    { min: 600.5, max: 2400, scope: 2400 },
  ]);
  assert.equal(
    breakpointIntervals({
      responsive: [
        { maxWidth: 270 },
        { maxWidth: 2500 },
        { maxWidth: "<script>" },
        { maxWidth: NaN },
        { maxWidth: 600 },
        { maxWidth: 600 },
      ],
    }).length,
    2,
  );
});
test("overview distinguishes preview from explicit edit scope and base samples escape every breakpoint", () => {
  const markup = breakpointOverviewMarkup(node, {
    width: 500,
    scope: null,
    baseWidth: 390,
  });
  assert.match(
    markup,
    /data-range-scope="600"[^>]*aria-pressed="false"[^>]*class="is-preview"/,
  );
  assert.match(
    markup,
    /data-range-scope="" data-range-width="1025" aria-pressed="true"/,
  );
  assert.match(markup, /仅预览宽度/);
  const edge = breakpointOverviewMarkup(
    { responsive: [{ maxWidth: 2400, changes: {} }] },
    { width: 2400 },
  );
  assert.doesNotMatch(edge, /data-range-scope=""/);
});
test("overview markup cannot interpolate project strings or nonfinite CSS and bounds its rendered controls", () => {
  const bad = {
    name: "<script>alert(1)</script>",
    responsive: [{ maxWidth: '" onmouseover="alert(1)' }],
  };
  const markup = breakpointOverviewMarkup(bad, {
    width: Infinity,
    baseWidth: NaN,
  });
  assert.doesNotMatch(markup, /script|onmouseover|NaN|Infinity/);
  assert.equal((markup.match(/data-range-scope=/g) || []).length, 1);
  const many = {
    responsive: Array.from({ length: 100 }, (_, i) => ({
      maxWidth: 300 + i,
      changes: {},
    })),
  };
  assert.ok(
    (breakpointOverviewMarkup(many).match(/data-range-scope=/g) || []).length <=
      9,
  );
});
