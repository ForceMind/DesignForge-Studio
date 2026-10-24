/** Read-only, measured browser QA. Findings are evidence, not WCAG certification. */
const round = (value) => Math.round(value * 100) / 100;
const finiteRect = (r) => r && [r.x, r.y, r.w, r.h].every(Number.isFinite);
const right = (r) => r.x + r.w;
const bottom = (r) => r.y + r.h;
const outside = (r, b, tolerance = 1) =>
  r.x < b.x - tolerance ||
  r.y < b.y - tolerance ||
  right(r) > right(b) + tolerance ||
  bottom(r) > bottom(b) + tolerance;
const contains = (a, b) =>
  b.x >= a.x - 1 &&
  b.y >= a.y - 1 &&
  right(b) <= right(a) + 1 &&
  bottom(b) <= bottom(a) + 1;
const evidenceRect = (r) =>
  Object.fromEntries(["x", "y", "w", "h"].map((k) => [k, round(r[k])]));
const limit = (value, fallback, max) =>
  Number.isFinite(value)
    ? Math.max(1, Math.min(max, Math.floor(value)))
    : fallback;

/** Portable geometry analysis; all coordinates must already use board CSS pixels. */
export function auditGeometry(
  records,
  bounds,
  { boardId = null, maxFindings = 200, maxComparisons = 20000 } = {},
) {
  if (!Array.isArray(records) || !finiteRect(bounds))
    throw Error("Expected finite measured board geometry");
  maxFindings = limit(maxFindings, 200, 1000);
  maxComparisons = limit(maxComparisons, 20000, 100000);
  const findings = [],
    groups = new Map();
  let truncated = false,
    comparisons = 0;
  const append = (record, code, message, extra = {}) => {
    if (findings.length >= maxFindings) {
      truncated = true;
      return;
    }
    findings.push({
      severity: "warning",
      code,
      boardId,
      nodeId: record?.nodeId || null,
      message,
      ...(record
        ? {
            rect: evidenceRect(record.rect),
            ...(record.sourceId ? { sourceId: record.sourceId } : {}),
          }
        : {}),
      ...extra,
    });
  };
  const visible = records.filter(
    (r) => !r.hidden && finiteRect(r.rect) && r.rect.w > 0 && r.rect.h > 0,
  );
  for (const record of visible) {
    const parent = finiteRect(record.parentRect) ? record.parentRect : bounds;
    if (outside(record.rect, parent))
      append(
        record,
        "RENDER_OVERFLOW",
        "Measured layer extends outside its immediate parent.",
        { evidence: { scope: "parent", bounds: evidenceRect(parent) } },
      );
    else if (outside(record.rect, bounds))
      append(
        record,
        "RENDER_OVERFLOW",
        "Measured layer extends outside the artboard.",
        { evidence: { scope: "board", bounds: evidenceRect(bounds) } },
      );
    if (record.textClipped)
      append(
        record,
        "TEXT_CLIP",
        "Measured text is clipped by this layer or an overflow-clipping ancestor.",
        { evidence: record.textEvidence || {} },
      );
    else if (record.textOverflow)
      append(
        record,
        "TEXT_OVERFLOW",
        "Measured text extends beyond its own box; it may overlap nearby content.",
        { evidence: record.textEvidence || {} },
      );
    if (
      record.interactive &&
      (record.rect.w < 44 - 0.1 || record.rect.h < 44 - 0.1)
    )
      append(
        record,
        "TOUCH_TARGET",
        "Measured interactive box is smaller than 44×44 CSS px (a design heuristic).",
      );
    if (!record.decorative && !record.container) {
      const group = groups.get(record.parentKey) || [];
      group.push(record);
      groups.set(record.parentKey, group);
    }
  }
  outer: for (const group of groups.values()) {
    // A sweep along X avoids crossing every unrelated sibling pair.
    const sorted = [...group].sort((a, b) => a.rect.x - b.rect.x);
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i],
          b = sorted[j];
        if (b.rect.x >= right(a.rect) - 1) break;
        if (++comparisons > maxComparisons) {
          truncated = true;
          break outer;
        }
        if (contains(a.rect, b.rect) || contains(b.rect, a.rect)) continue;
        const w =
          Math.min(right(a.rect), right(b.rect)) - Math.max(a.rect.x, b.rect.x);
        const h =
          Math.min(bottom(a.rect), bottom(b.rect)) -
          Math.max(a.rect.y, b.rect.y);
        if (w > 1 && h > 1 && w * h > 4)
          append(
            a,
            "COLLISION",
            "Measured sibling boxes overlap; this may be intentional. Review the design.",
            {
              relatedNodeId: b.nodeId || null,
              ...(b.sourceId ? { relatedSourceId: b.sourceId } : {}),
              evidence: {
                overlap: {
                  x: round(Math.max(a.rect.x, b.rect.x)),
                  y: round(Math.max(a.rect.y, b.rect.y)),
                  w: round(w),
                  h: round(h),
                },
                overlapArea: round(w * h),
              },
            },
          );
        if (findings.length >= maxFindings) {
          truncated = true;
          break outer;
        }
      }
  }
  if (truncated) {
    if (findings.length >= maxFindings) findings.pop();
    append(
      null,
      "AUDIT_LIMIT",
      "Audit result or comparison budget reached; this report is incomplete.",
      { evidence: { maxFindings, maxComparisons, comparisons } },
    );
  }
  return findings;
}

/**
 * Inspect a rendered .df-board synchronously. Call after fonts/images/layout settle.
 * scale is the editor world's uniform zoom; exported pages use the default 1.
 * No DOM writes, script execution, network requests or project mutations occur.
 */
export function auditRenderedBoard(
  mainElement,
  { scale = 1, maxFindings = 200, maxNodes = 2000 } = {},
) {
  if (
    !mainElement ||
    mainElement.nodeType !== 1 ||
    !mainElement.matches(".df-board")
  )
    throw Error("Expected a rendered .df-board element");
  if (!Number.isFinite(scale) || scale <= 0)
    throw Error("Expected a positive finite scale");
  maxNodes = limit(maxNodes, 2000, 5000);
  maxFindings = limit(maxFindings, 200, 1000);
  const doc = mainElement.ownerDocument,
    view = doc.defaultView;
  const board = mainElement.getBoundingClientRect(),
    boardId =
      mainElement.dataset.boardId ||
      mainElement.closest("[data-artboard]")?.dataset.artboard ||
      null;
  const styles = new Map(),
    boxes = new Map();
  const style = (el) => {
    if (!styles.has(el)) styles.set(el, view.getComputedStyle(el));
    return styles.get(el);
  };
  const box = (el) => {
    if (!boxes.has(el)) {
      const r = el.getBoundingClientRect();
      boxes.set(el, {
        x: (r.left - board.left) / scale,
        y: (r.top - board.top) / scale,
        w: r.width / scale,
        h: r.height / scale,
      });
    }
    return boxes.get(el);
  };
  const paddingBox = (el) => {
    const b = box(el),
      s = style(el),
      l = parseFloat(s.borderLeftWidth) || 0,
      t = parseFloat(s.borderTopWidth) || 0,
      r = parseFloat(s.borderRightWidth) || 0,
      d = parseFloat(s.borderBottomWidth) || 0;
    return {
      x: b.x + l,
      y: b.y + t,
      w: Math.max(0, b.w - l - r),
      h: Math.max(0, b.h - t - d),
    };
  };
  const contentBox = (el) => {
    const b = paddingBox(el),
      s = style(el),
      l = parseFloat(s.paddingLeft) || 0,
      t = parseFloat(s.paddingTop) || 0,
      r = parseFloat(s.paddingRight) || 0,
      d = parseFloat(s.paddingBottom) || 0;
    return {
      x: b.x + l,
      y: b.y + t,
      w: Math.max(0, b.w - l - r),
      h: Math.max(0, b.h - t - d),
    };
  };
  const hidden = (el) => {
    const visibility = style(el).visibility;
    if (visibility === "hidden" || visibility === "collapse") return true;
    for (let current = el; current; current = current.parentElement) {
      const s = style(current);
      if (s.display === "none" || Number(s.opacity) === 0) return true;
      if (current === mainElement) break;
    }
    return false;
  };
  const clipping = (el) => {
    const clips = [];
    for (let current = el; current; current = current.parentElement) {
      const s = style(current),
        x = s.overflowX !== "visible",
        y = s.overflowY !== "visible";
      if (x || y) clips.push({ rect: paddingBox(current), x, y });
      if (current === mainElement) break;
    }
    return clips;
  };
  const glyphRect = (r) => ({
    x: (r.left - board.left) / scale,
    y: (r.top - board.top) / scale,
    w: r.width / scale,
    h: r.height / scale,
  });
  let limitedText = false;
  function textMetrics(el) {
    const own = contentBox(el),
      clips = clipping(el),
      glyphs = [];
    const isInput = el.matches("input,textarea");
    if (isInput) {
      const text = el.value || el.getAttribute("placeholder") || "";
      if (text) {
        const s = style(el),
          ctx = doc.createElement("canvas").getContext("2d");
        if (ctx) {
          ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
          if ("letterSpacing" in ctx)
            ctx.letterSpacing = (parseFloat(s.letterSpacing) || 0) + "px";
          const width = ctx.measureText(text).width;
          if (width > own.w + 1)
            return {
              textClipped: true,
              textOverflow: true,
              textEvidence: {
                scope: "native-input",
                measuredTextWidth: round(width),
                availableWidth: round(own.w),
                method: "canvas-font-metrics",
              },
            };
        }
      }
      return {};
    }
    const walker = doc.createTreeWalker(el, view.NodeFilter.SHOW_TEXT);
    let text,
      count = 0;
    while ((text = walker.nextNode())) {
      if (!text.textContent.trim() || hidden(text.parentElement)) continue;
      if (++count > 256) {
        limitedText = true;
        break;
      }
      const range = doc.createRange();
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0) glyphs.push(glyphRect(rect));
        if (glyphs.length >= 512) {
          limitedText = true;
          break;
        }
      }
      if (glyphs.length >= 512) break;
    }
    const textOverflow =
      el.scrollWidth > el.clientWidth + 1 ||
      el.scrollHeight > el.clientHeight + 1 ||
      glyphs.some((r) => outside(r, own));
    const textClipped = glyphs.some((r) =>
      clips.some(
        (c) =>
          (c.x && (r.x < c.rect.x - 1 || right(r) > right(c.rect) + 1)) ||
          (c.y && (r.y < c.rect.y - 1 || bottom(r) > bottom(c.rect) + 1)),
      ),
    );
    return {
      textOverflow,
      textClipped,
      ...(textOverflow || textClipped
        ? {
            textEvidence: {
              scope: textClipped ? "clip-chain" : "text-box",
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              measuredGlyphRects: glyphs.length,
            },
          }
        : {}),
    };
  }
  const all = mainElement.querySelectorAll(".df-node"),
    nodes = [],
    records = [];
  for (let i = 0; i < Math.min(all.length, maxNodes); i++) nodes.push(all[i]);
  const indexes = new Map(nodes.map((el, i) => [el, i]));
  for (const el of nodes) {
    if (hidden(el)) continue;
    const rect = box(el);
    if (rect.w <= 0 || rect.h <= 0) continue;
    const parent =
      el.parentElement?.closest(".df-node,.df-board") || mainElement;
    const owner = el.closest("[data-node-id]"),
      sourceId = el.dataset.sourceId;
    const record = {
      nodeId: owner?.dataset.nodeId || null,
      ...(sourceId ? { sourceId } : {}),
      rect,
      parentRect: paddingBox(parent),
      parentKey: indexes.get(parent) ?? "board",
      container:
        el.matches(".df-frame,.df-group,.df-component,.df-instance") ||
        [...el.children].some((c) => c.matches(".df-node")),
      decorative:
        el.matches(".df-icon,.df-line") ||
        el.getAttribute("aria-hidden") === "true",
      interactive: el.matches(
        "button,input,select,textarea,a[href],[role=button]",
      ),
    };
    if (el.matches(".df-text,.df-button,.df-pill,.df-input"))
      Object.assign(record, textMetrics(el));
    records.push(record);
  }
  const findings = auditGeometry(
    records,
    { x: 0, y: 0, w: board.width / scale, h: board.height / scale },
    { boardId, maxFindings },
  );
  if (
    (all.length > maxNodes || limitedText) &&
    !findings.some((f) => f.code === "AUDIT_LIMIT")
  ) {
    if (findings.length >= maxFindings) findings.pop();
    findings.push({
      severity: "warning",
      code: "AUDIT_LIMIT",
      boardId,
      nodeId: null,
      message:
        "DOM/text measurement budget reached; this report is incomplete.",
      evidence: { maxNodes, totalNodes: all.length, limitedText },
    });
  }
  return findings;
}
