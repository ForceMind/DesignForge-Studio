import { locateNode, isNodeLocked } from "./tree.mjs";

/** Pick a visible sibling edge from measured viewport boxes, including wrapped rows. */
export function flowDropTarget(
  items,
  point,
  { mode = "flex", direction = "column" } = {},
) {
  if (
    !Array.isArray(items) ||
    items.length > 500 ||
    ![point?.x, point?.y].every(Number.isFinite)
  )
    return null;
  const horizontal = mode === "grid" || direction === "row";
  let nearest = null,
    distance = Infinity;
  for (const item of items) {
    const r = item.rect;
    if (
      !r ||
      ![r.x, r.y, r.w, r.h].every(Number.isFinite) ||
      r.w <= 0 ||
      r.h <= 0
    )
      continue;
    const dx = Math.max(r.x - point.x, 0, point.x - r.x - r.w),
      dy = Math.max(r.y - point.y, 0, point.y - r.y - r.h),
      d = dx * dx + dy * dy;
    if (d < distance) {
      distance = d;
      nearest = item;
    }
  }
  if (!nearest) return null;
  const r = nearest.rect,
    after = horizontal ? point.x >= r.x + r.w / 2 : point.y >= r.y + r.h / 2;
  return {
    anchorId: nearest.id,
    placement: after ? "after" : "before",
    marker: horizontal
      ? { x: r.x + (after ? r.w : 0), y: r.y, w: 0, h: r.h }
      : { x: r.x, y: r.y + (after ? r.h : 0), w: r.w, h: 0 },
  };
}

/** Change only a same-parent order; return false for an unchanged sequence. */
export function reorderSibling(board, nodeId, anchorId, placement) {
  if (!["before", "after"].includes(placement))
    throw Error("Invalid reorder placement");
  const source = locateNode(board, nodeId),
    anchor = locateNode(board, anchorId);
  if (!source || !anchor) throw Error("Unknown reorder layer");
  if (source.siblings !== anchor.siblings)
    throw Error("Reorder requires the same parent");
  if (isNodeLocked(board, nodeId)) throw Error("Locked layer");
  const list = source.siblings,
    from = list.indexOf(source.node),
    at = list.indexOf(anchor.node);
  if (source.node === anchor.node) return false;
  const to = at + (placement === "after" ? 1 : 0) - (from < at ? 1 : 0);
  if (from === to) return false;
  list.splice(from, 1);
  list.splice(to, 0, source.node);
  return true;
}
