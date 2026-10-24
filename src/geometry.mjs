/** Snap a free-positioned selection anchor to sibling edges/centers, then an 8px grid. */
export function snapPosition(
  node,
  x,
  y,
  siblings,
  parent,
  threshold = 4,
  grid = 8,
  guides = { x: [], y: [] },
) {
  const others = siblings.filter((n) => n.id !== node.id && !n.hidden);
  const targetsX = [
    ...guides.x,
    0,
    parent.w / 2,
    parent.w,
    ...others.flatMap((n) => [n.x, n.x + n.w / 2, n.x + n.w]),
  ];
  const targetsY = [
    ...guides.y,
    0,
    parent.h / 2,
    parent.h,
    ...others.flatMap((n) => [n.y, n.y + n.h / 2, n.y + n.h]),
  ];
  function axis(value, size, targets) {
    let best = null;
    for (const target of targets)
      for (const offset of [0, size / 2, size]) {
        const distance = target - (value + offset);
        if (
          Math.abs(distance) <= threshold &&
          (!best || Math.abs(distance) < Math.abs(best.distance))
        )
          best = { distance, target };
      }
    return best
      ? { value: value + best.distance, guide: best.target }
      : { value: Math.round(value / grid) * grid, guide: null };
  }
  const sx = axis(x, node.w, targetsX),
    sy = axis(y, node.h, targetsY);
  return { x: sx.value, y: sy.value, guideX: sx.guide, guideY: sy.guide };
}
/** Translate actual geometry back into the unchanged design constraint space. */
export function positionChanges(node, position, parentDesign, parentActual) {
  const changes = {};
  for (const [axis, pos, size, reference] of [
    ["horizontal", "x", "w", "referenceW"],
    ["vertical", "y", "h", "referenceH"],
  ]) {
    const baseline = node.constraints?.[reference] || parentDesign[size],
      actual = parentActual[size],
      rule = node.constraints?.[axis] || "start";
    let value = position[pos];
    if (rule === "end") value += baseline - actual;
    if (rule === "center") value += (baseline - actual) / 2;
    if (rule === "scale") value *= baseline / actual;
    changes[pos] = Math.round(value * 100) / 100;
  }
  return changes;
}
/** Resize about the opposite edge (Alt: center, Shift+corner: preserve ratio). */
export function resizeBox(
  start,
  handle,
  dx,
  dy,
  { center = false, ratio = false, grid = 1 } = {},
) {
  if (!["n", "ne", "e", "se", "s", "sw", "w", "nw"].includes(handle))
    throw Error("Invalid resize handle");
  const horizontal = /[ew]/.test(handle),
    vertical = /[ns]/.test(handle),
    factor = center ? 2 : 1;
  let w = horizontal
    ? start.w + dx * (handle.includes("w") ? -1 : 1) * factor
    : start.w;
  let h = vertical
    ? start.h + dy * (handle.includes("n") ? -1 : 1) * factor
    : start.h;
  w = Math.max(1, Math.min(2400, Math.round(w / grid) * grid));
  h = Math.max(1, Math.min(3200, Math.round(h / grid) * grid));
  if (ratio && horizontal && vertical) {
    const scale =
      Math.abs(w - start.w) / start.w >= Math.abs(h - start.h) / start.h
        ? w / start.w
        : h / start.h;
    const bounded = Math.max(
      1 / start.w,
      1 / start.h,
      Math.min(scale, 2400 / start.w, 3200 / start.h),
    );
    w = start.w * bounded;
    h = start.h * bounded;
  }
  return {
    x:
      start.x +
      (horizontal
        ? center
          ? (start.w - w) / 2
          : handle.includes("w")
            ? start.w - w
            : 0
        : 0),
    y:
      start.y +
      (vertical
        ? center
          ? (start.h - h) / 2
          : handle.includes("n")
            ? start.h - h
            : 0
        : 0),
    w,
    h,
  };
}
/** Invert CSS constraints so resizing in a preview retains the original constraint. */
export function geometryChanges(
  node,
  box,
  parentDesign,
  parentActual,
  { width = true, height = true, position = true, flow = false } = {},
) {
  const changes = {},
    sizing = {};
  for (const [axis, pos, size, extent, enabled] of [
    ["horizontal", "x", "w", "w", width],
    ["vertical", "y", "h", "h", height],
  ]) {
    if (!enabled) continue;
    const baseline =
      node.constraints?.[axis === "horizontal" ? "referenceW" : "referenceH"] ||
      parentDesign[extent];
    const actual = parentActual[extent],
      rule = flow ? "start" : node.constraints?.[axis] || "start";
    let value = box[size],
      start = box[pos];
    if (rule === "stretch") value += baseline - actual;
    if (rule === "scale") {
      value *= baseline / actual;
      start *= baseline / actual;
    }
    if (rule === "end") start += baseline - actual;
    if (rule === "center") start += (baseline - actual) / 2;
    changes[size] = Math.round(value * 100) / 100;
    sizing[size] = "fixed";
    if (position && !flow) changes[pos] = Math.round(start * 100) / 100;
  }
  changes.sizing = sizing;
  return changes;
}
export function boxFromPoints(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}
/** Fully enclosed layers; an enclosed parent subsumes its children. */
export function selectionInBox(entries, box, existing = []) {
  const byId = new Map(entries.map((e) => [e.id, e])),
    ids = new Set(existing.filter((id) => byId.has(id)));
  for (const e of entries) {
    const r = e.rect;
    if (e.locked || e.hidden || r.w <= 0 || r.h <= 0) continue;
    if (
      r.x >= box.x - 0.5 &&
      r.y >= box.y - 0.5 &&
      r.x + r.w <= box.x + box.w + 0.5 &&
      r.y + r.h <= box.y + box.h + 0.5
    )
      ids.add(e.id);
  }
  return [...ids].filter((id) => {
    let parent = byId.get(id)?.parentId;
    const seen = new Set();
    while (parent && !seen.has(parent)) {
      if (ids.has(parent)) return false;
      seen.add(parent);
      parent = byId.get(parent)?.parentId;
    }
    return true;
  });
}

/** Equal gaps between actual sibling boxes, preserving the two outer anchors. */
export function distributeBoxes(entries, axis) {
  if (!["x", "y"].includes(axis) || entries.length < 3)
    throw Error("Select at least three boxes and a valid axis");
  const size = axis === "x" ? "w" : "h";
  if (
    new Set(entries.map((e) => e.id)).size !== entries.length ||
    entries.some(
      (e) =>
        !Number.isFinite(e[axis]) || !Number.isFinite(e[size]) || e[size] <= 0,
    )
  )
    throw Error("Invalid distribution geometry");
  const sorted = [...entries].sort((a, b) => a[axis] - b[axis]);
  const first = sorted[0],
    last = sorted.at(-1);
  const gap =
    (last[axis] +
      last[size] -
      first[axis] -
      sorted.reduce((sum, e) => sum + e[size], 0)) /
    (sorted.length - 1);
  let cursor = first[axis];
  return sorted.map((e, i) => {
    const position =
      i === sorted.length - 1 ? last[axis] : Math.round(cursor * 100) / 100;
    cursor += e[size] + gap;
    return { id: e.id, [axis]: position };
  });
}

export function boundsOfBoxes(entries) {
  if (
    !entries.length ||
    entries.some(
      (e) =>
        ![e.x, e.y, e.w, e.h].every(Number.isFinite) || e.w <= 0 || e.h <= 0,
    )
  )
    throw Error("Invalid selection geometry");
  const x = Math.min(...entries.map((e) => e.x)),
    y = Math.min(...entries.map((e) => e.y));
  return {
    x,
    y,
    w: Math.max(...entries.map((e) => e.x + e.w)) - x,
    h: Math.max(...entries.map((e) => e.y + e.h)) - y,
  };
}
/** Resize layer boxes and their gaps; typography/descendants retain their own layout rules. */
export function resizeSelectionBoxes(entries, handle, dx, dy, options = {}) {
  if (
    entries.length < 2 ||
    new Set(entries.map((e) => e.id)).size !== entries.length
  )
    throw Error("Select at least two unique layers");
  const bounds = boundsOfBoxes(entries);
  if (bounds.w > 2400 || bounds.h > 3200)
    throw Error("Selection exceeds resize bounds");
  const target = resizeBox(bounds, handle, dx, dy, options);
  let sx = target.w / bounds.w,
    sy = target.h / bounds.h;
  const minX = Math.max(...entries.map((e) => 1 / e.w)),
    minY = Math.max(...entries.map((e) => 1 / e.h));
  const maxX = Math.min(...entries.map((e) => 2400 / e.w)),
    maxY = Math.min(...entries.map((e) => 3200 / e.h));
  if (options.ratio && /[ew]/.test(handle) && /[ns]/.test(handle)) {
    sx = sy = Math.max(minX, minY, Math.min(sx, maxX, maxY));
  } else {
    sx = Math.max(minX, Math.min(sx, maxX));
    sy = Math.max(minY, Math.min(sy, maxY));
  }
  const w = bounds.w * sx,
    h = bounds.h * sy;
  const x =
    bounds.x +
    (/[ew]/.test(handle)
      ? options.center
        ? (bounds.w - w) / 2
        : handle.includes("w")
          ? bounds.w - w
          : 0
      : 0);
  const y =
    bounds.y +
    (/[ns]/.test(handle)
      ? options.center
        ? (bounds.h - h) / 2
        : handle.includes("n")
          ? bounds.h - h
          : 0
      : 0);
  return {
    bounds: { x, y, w, h },
    boxes: entries.map((e) => ({
      id: e.id,
      x: x + (e.x - bounds.x) * sx,
      y: y + (e.y - bounds.y) * sy,
      w: e.w * sx,
      h: e.h * sy,
    })),
  };
}
