/** Portable, inert rich text. Ranges use textarea-compatible UTF-16 offsets. */
export const RICH_TEXT_TYPES = new Set(["text", "button", "pill"]);
export const TEXT_STYLE_KEYS = new Set([
  "color",
  "fontSize",
  "fontWeight",
  "italic",
  "underline",
  "strike",
]);
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const color = (value) =>
  typeof value === "string" &&
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
    value,
  );
const token = (value) =>
  typeof value === "string" &&
  /^\$[a-zA-Z][a-zA-Z0-9]*$/.test(value) &&
  !["$constructor", "$prototype", "$__proto__"].includes(value);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function validUnicode(text) {
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code >= 0xd800 && code <= 0xdfff) return false;
  }
  return true;
}
function styleErrors(style, resolve = null, removals = false) {
  if (!object(style)) return ["Expected text style object"];
  const errors = [];
  for (const [key, raw] of Object.entries(style)) {
    if (!TEXT_STYLE_KEYS.has(key)) {
      errors.push("Unsupported text style field: " + key);
      continue;
    }
    if (removals && raw === null) continue;
    const value = resolve ? resolve(raw) : raw;
    if (["italic", "underline", "strike"].includes(key)) {
      if (typeof raw !== "boolean") errors.push(key + " must be boolean");
    } else if (key === "color") {
      if (!color(value) && !(resolve === null && token(raw)))
        errors.push("color must be hex or a color token");
    } else {
      const [min, max] = key === "fontSize" ? [8, 180] : [100, 900];
      if (
        !(Number.isFinite(value) && value >= min && value <= max) &&
        !(resolve === null && token(raw))
      )
        errors.push(key + " is out of range");
    }
  }
  return errors;
}
/** Core passes a token resolver for each palette; helpers may validate references structurally. */
export function validateTextRuns(node, resolve = null) {
  if (node.textRuns === undefined) return [];
  const errors = [];
  if (!RICH_TEXT_TYPES.has(node.type))
    errors.push("Rich text is supported only by text, button and pill");
  if (!Array.isArray(node.textRuns) || node.textRuns.length > 256)
    return [...errors, "Expected up to 256 text runs"];
  let joined = "";
  for (const run of node.textRuns) {
    if (
      !object(run) ||
      Object.keys(run).some((k) => !["text", "style"].includes(k)) ||
      typeof run.text !== "string" ||
      !run.text.length ||
      run.text.length > 10000 ||
      !validUnicode(run.text)
    ) {
      errors.push("Invalid text run");
      continue;
    }
    joined += run.text;
    if (run.style !== undefined)
      errors.push(...styleErrors(run.style, resolve));
  }
  if (joined !== node.text || joined.length > 10000)
    errors.push(
      "Run text must exactly match node.text (up to 10000 characters)",
    );
  return errors;
}
function canonicalStyle(style) {
  return Object.fromEntries(
    Object.entries(style || {}).sort(([a], [b]) => a.localeCompare(b)),
  );
}
function normalize(runs) {
  const merged = [];
  for (const run of runs) {
    if (!run.text.length) continue;
    const style = canonicalStyle(run.style),
      last = merged.at(-1);
    if (last && JSON.stringify(last.style || {}) === JSON.stringify(style))
      last.text += run.text;
    else
      merged.push(
        Object.keys(style).length
          ? { text: run.text, style }
          : { text: run.text },
      );
  }
  return merged;
}
function completeRange(text, start, end) {
  if (
    ![start, end].every(Number.isInteger) ||
    start < 0 ||
    start >= end ||
    end > text.length
  )
    throw Error("Select a nonempty text range");
  const boundaries = [0];
  if (typeof Intl.Segmenter === "function") {
    for (const s of new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    }).segment(text))
      boundaries.push(s.index + s.segment.length);
  } else {
    let offset = 0;
    for (const char of text) {
      offset += char.length;
      boundaries.push(offset);
    }
  }
  return {
    start: boundaries.findLast((n) => n <= start),
    end: boundaries.find((n) => n >= end),
  };
}
/** Clone the node, style a complete Unicode range, merge adjacent equal styles. null removes a property. */
export function applyTextStyle(node, start, end, style) {
  if (
    !RICH_TEXT_TYPES.has(node.type) ||
    typeof node.text !== "string" ||
    node.text.length > 10000 ||
    !validUnicode(node.text)
  )
    throw Error("Select a supported text layer");
  const errors = [...validateTextRuns(node), ...styleErrors(style, null, true)];
  if (errors.length) throw Error(errors[0]);
  ({ start, end } = completeRange(node.text, start, end));
  const runs = node.textRuns || (node.text ? [{ text: node.text }] : []),
    pieces = [];
  let offset = 0;
  for (const run of runs) {
    const stop = offset + run.text.length,
      points = [
        offset,
        Math.max(offset, Math.min(stop, start)),
        Math.max(offset, Math.min(stop, end)),
        stop,
      ].filter((n, i, a) => i === 0 || n !== a[i - 1]);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1],
        nextStyle = { ...run.style };
      if (a >= start && b <= end)
        for (const [key, value] of Object.entries(style)) {
          if (value === null) delete nextStyle[key];
          else nextStyle[key] = value;
        }
      pieces.push({
        text: run.text.slice(a - offset, b - offset),
        style: nextStyle,
      });
    }
    offset = stop;
  }
  const next = structuredClone(node);
  next.textRuns = normalize(pieces);
  if (validateTextRuns(next).length)
    throw Error("Rich text range exceeds supported limits");
  return next;
}
function graphemes(text) {
  if (typeof Intl.Segmenter === "function")
    return [
      ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
        text,
      ),
    ].map(({ segment, index }) => ({ segment, index }));
  let index = 0;
  return [...text].map((segment) => {
    const entry = { segment, index };
    index += segment.length;
    return entry;
  });
}
function sliceRuns(runs, start, end) {
  const result = [];
  let offset = 0;
  for (const run of runs) {
    const stop = offset + run.text.length,
      a = Math.max(start, offset),
      b = Math.min(end, stop);
    if (a < b)
      result.push({
        text: run.text.slice(a - offset, b - offset),
        style: { ...run.style },
      });
    offset = stop;
  }
  return result;
}
function styleAt(runs, index) {
  let offset = 0;
  for (const run of runs) {
    if (index >= offset && index < offset + run.text.length)
      return { ...run.style };
    offset += run.text.length;
  }
  return {};
}
/** One middle replacement, preserving unchanged grapheme prefixes/suffixes and their run styles. */
export function replaceTextPreservingRuns(node, text) {
  const next = replacePlainText(node, text);
  if (node.textRuns === undefined) return next;
  if (validateTextRuns(node).length || !validUnicode(text))
    throw Error("Invalid rich text replacement");
  if (text === node.text) return structuredClone(node);
  const oldParts = graphemes(node.text),
    newParts = graphemes(text);
  let prefix = 0,
    suffix = 0;
  while (
    prefix < oldParts.length &&
    prefix < newParts.length &&
    oldParts[prefix].segment === newParts[prefix].segment
  )
    prefix++;
  while (
    suffix < oldParts.length - prefix &&
    suffix < newParts.length - prefix &&
    oldParts.at(-1 - suffix).segment === newParts.at(-1 - suffix).segment
  )
    suffix++;
  const oldStart = oldParts[prefix]?.index ?? node.text.length,
    newStart = newParts[prefix]?.index ?? text.length,
    oldEnd = suffix
      ? oldParts[oldParts.length - suffix].index
      : node.text.length,
    newEnd = suffix ? newParts[newParts.length - suffix].index : text.length;
  const inherited = styleAt(
    node.textRuns,
    oldStart < oldEnd ? oldStart : oldStart > 0 ? oldStart - 1 : oldEnd,
  );
  next.textRuns = normalize([
    ...sliceRuns(node.textRuns, 0, oldStart),
    { text: text.slice(newStart, newEnd), style: inherited },
    ...sliceRuns(node.textRuns, oldEnd, node.text.length),
  ]);
  const errors = validateTextRuns(next);
  if (errors.length) throw Error(errors[0]);
  return next;
}
/** Plain text editing is explicit: discard run styling, preserve all unrelated node fields. */
export function replacePlainText(node, text) {
  if (typeof text !== "string" || text.length > 10000)
    throw Error("Expected text up to 10000 characters");
  const next = structuredClone(node);
  next.text = text;
  delete next.textRuns;
  return next;
}
/** Invalid rich text renders escaped plain text; CSS comes only from validated bounded fields. */
export function renderRichText(node, resolve = (value) => value) {
  if (!node.textRuns || validateTextRuns(node, resolve).length)
    return escape(node.text);
  const content = node.textRuns
    .map((run) => {
      const s = run.style || {},
        css = [];
      if (s.color !== undefined) css.push("color:" + resolve(s.color));
      if (s.fontSize !== undefined)
        css.push("font-size:" + resolve(s.fontSize) + "px");
      if (s.fontWeight !== undefined)
        css.push("font-weight:" + resolve(s.fontWeight));
      if (s.italic !== undefined)
        css.push("font-style:" + (s.italic ? "italic" : "normal"));
      if (s.underline !== undefined || s.strike !== undefined)
        css.push(
          "text-decoration-line:" +
            ([s.underline ? "underline" : "", s.strike ? "line-through" : ""]
              .filter(Boolean)
              .join(" ") || "none"),
        );
      return `<span data-text-run style="${escape(css.join(";"))}">${escape(run.text)}</span>`;
    })
    .join("");
  // A button/pill is a flex container. Keep all runs in one inline formatting context.
  return ["button", "pill"].includes(node.type)
    ? `<span class="df-rich-content" style="white-space:pre-wrap;max-width:100%;min-width:0">${content}</span>`
    : content;
}
