/** Additive v1 tree extension. Coordinates are relative to the immediate parent. */
export const CONTAINERS = new Set(["frame", "group", "component"]);
export function flattenNodes(nodes = [], parent = null, depth = 0) {
  if (!Array.isArray(nodes) || depth > 20) return [];
  return nodes
    .filter((node) => node && typeof node === "object")
    .flatMap((node) => [
      { node, parent, siblings: nodes, depth },
      ...flattenNodes(node.children || [], node, depth + 1),
    ]);
}
export function locateNode(board, id) {
  return (
    flattenNodes(board.nodes).find((entry) => entry.node.id === id) || null
  );
}
export function findNode(board, id) {
  return locateNode(board, id)?.node || null;
}
export function isNodeLocked(board, id, ancestorsOnly = false) {
  let e = locateNode(board, id);
  if (ancestorsOnly) e = e?.parent ? locateNode(board, e.parent.id) : null;
  while (e) {
    if (e.node.locked) return true;
    e = e.parent ? locateNode(board, e.parent.id) : null;
  }
  return false;
}
export function subtreeIds(node) {
  return flattenNodes([node]).map((e) => e.node.id);
}
export function copySubtree(node, idFactory) {
  const copy = structuredClone(node);
  for (const { node: n } of flattenNodes([copy])) n.id = idFactory();
  return copy;
}
export function moveNode(board, nodeId, parentId = null, index) {
  const entry = locateNode(board, nodeId);
  if (!entry) throw Error("Unknown node " + nodeId);
  const parent = parentId ? findNode(board, parentId) : null;
  if (parentId && (!parent || !CONTAINERS.has(parent.type)))
    throw Error("Target must be a container");
  if (parent && subtreeIds(entry.node).includes(parent.id))
    throw Error("Cannot move into own descendant");
  if (isNodeLocked(board, nodeId) || (parent && isNodeLocked(board, parent.id)))
    throw Error("Locked layer");
  const target = parent ? (parent.children ||= []) : board.nodes;
  if (
    index !== undefined &&
    (!Number.isInteger(index) || index < 0 || index > target.length)
  )
    throw Error("Invalid insertion index");
  entry.siblings.splice(entry.siblings.indexOf(entry.node), 1);
  target.splice(Math.min(index ?? target.length, target.length), 0, entry.node);
}
const roundGeometry = (value) => Math.round(value * 100) / 100;
function checkedSize(size) {
  if (!size || ![size.w, size.h].every((v) => Number.isFinite(v) && v > 0))
    throw Error("Actual parent size required");
  return size;
}
function borderInset(node) {
  if (!node.style?.stroke || node.style.stroke === "none") return 0;
  const width = node.style.strokeWidth ?? 1;
  if (!Number.isFinite(width))
    throw Error("Use measured geometry for token-based borders");
  return Math.max(0, Math.min(20, width));
}
function declaredInnerSize(parent) {
  const border = borderInset(parent);
  return checkedSize({ w: parent.w - border * 2, h: parent.h - border * 2 });
}
function stableRoot(node) {
  if (node.responsive?.length)
    throw Error("Group geometry cannot preserve responsive root overrides");
  if (
    [node.sizing?.w, node.sizing?.h].some((value) => value && value !== "fixed")
  )
    throw Error("Group geometry requires fixed-size root layers");
  if (node.hidden) throw Error("Group geometry requires visible root layers");
}
/** Resolve the limited fixed-size absolute model when no browser boxes are supplied. */
function absoluteBox(node, reference, actual) {
  stableRoot(node);
  const box = { x: node.x, y: node.y, w: node.w, h: node.h };
  for (const [axis, pos, size, ref] of [
    ["horizontal", "x", "w", "referenceW"],
    ["vertical", "y", "h", "referenceH"],
  ]) {
    const baseline = node.constraints?.[ref] || reference[size],
      rule = node.constraints?.[axis] || "start";
    if (rule === "end") box[pos] += actual[size] - baseline;
    if (rule === "center") box[pos] += (actual[size] - baseline) / 2;
    if (rule === "stretch") box[size] += actual[size] - baseline;
    if (rule === "scale") {
      box[pos] *= actual[size] / baseline;
      box[size] *= actual[size] / baseline;
    }
  }
  return box;
}
function checkedBox(box) {
  if (
    !box ||
    ![box.x, box.y, box.w, box.h].every(Number.isFinite) ||
    box.w <= 0 ||
    box.h <= 0 ||
    box.w > 2400 ||
    box.h > 3200
  )
    throw Error("Invalid or unsupported actual group geometry");
  return box;
}
function providedBoxes(boxes, ids) {
  if (
    !Array.isArray(boxes) ||
    boxes.length !== ids.length ||
    new Set(boxes.map((b) => b?.id)).size !== ids.length
  )
    throw Error("Expected one actual box per selected layer");
  const byId = new Map(boxes.map((box) => [box.id, checkedBox(box)]));
  if (ids.some((id) => !byId.has(id)))
    throw Error("Actual geometry IDs do not match selected layers");
  return byId;
}
/** Keep the original rules while rebasing them to a new absolute parent. */
function rebaseGeometry(node, box, reference, actual) {
  const next = { x: box.x, y: box.y, w: box.w, h: box.h };
  const constraints = node.constraints ? { ...node.constraints } : null;
  for (const [axis, pos, size, ref] of [
    ["horizontal", "x", "w", "referenceW"],
    ["vertical", "y", "h", "referenceH"],
  ]) {
    const rule = constraints?.[axis] || "start",
      baseline = reference[size];
    if (constraints && (constraints[axis] || Object.hasOwn(constraints, ref)))
      constraints[ref] = baseline;
    if (rule === "end") next[pos] += baseline - actual[size];
    if (rule === "center") next[pos] += (baseline - actual[size]) / 2;
    if (rule === "stretch") next[size] += baseline - actual[size];
    if (rule === "scale") {
      next[pos] *= baseline / actual[size];
      next[size] *= baseline / actual[size];
    }
    next[pos] = roundGeometry(next[pos]);
    next[size] = roundGeometry(next[size]);
  }
  checkedBox(next);
  if (constraints) next.constraints = constraints;
  return next;
}
export function groupNodes(board, ids, groupId, options = {}) {
  const entries = ids.map((id) => locateNode(board, id));
  if (
    !entries.length ||
    entries.some((e) => !e) ||
    new Set(ids).size !== ids.length
  )
    throw Error("Select layers first");
  if (
    typeof groupId !== "string" ||
    !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(groupId) ||
    findNode(board, groupId)
  )
    throw Error("Invalid or duplicate group ID");
  const siblings = entries[0].siblings,
    parent = entries[0].parent || board;
  if (
    entries.some(
      (e) => e.siblings !== siblings || isNodeLocked(board, e.node.id),
    )
  )
    throw Error("Group requires unlocked sibling layers");
  if (parent.layout?.mode && parent.layout.mode !== "absolute")
    throw Error("Group absolute-layout layers first");
  for (const entry of entries) stableRoot(entry.node);
  if (options.parentSize) checkedSize(options.parentSize);
  if (!options.boxes && parent.responsive?.length)
    throw Error("Use measured geometry for a responsive parent");
  const ordered = siblings.filter((n) => ids.includes(n.id));
  const boxes = options.boxes
    ? providedBoxes(options.boxes, ids)
    : new Map(
        ordered.map((n) => [
          n.id,
          checkedBox(
            absoluteBox(
              n,
              parent,
              options.parentSize || declaredInnerSize(parent),
            ),
          ),
        ]),
      );
  const x = Math.min(...ordered.map((n) => boxes.get(n.id).x)),
    y = Math.min(...ordered.map((n) => boxes.get(n.id).y));
  const w =
      Math.max(...ordered.map((n) => boxes.get(n.id).x + boxes.get(n.id).w)) -
      x,
    h =
      Math.max(...ordered.map((n) => boxes.get(n.id).y + boxes.get(n.id).h)) -
      y;
  checkedBox({ x, y, w, h });
  const prepared = ordered.map((n) => {
    const box = boxes.get(n.id);
    return rebaseGeometry(
      n,
      { x: box.x - x, y: box.y - y, w: box.w, h: box.h },
      { w, h },
      { w, h },
    );
  });
  const group = {
    id: groupId,
    name: "Group",
    type: "group",
    x,
    y,
    w,
    h,
    text: "",
    style: {},
    children: ordered,
    layout: { mode: "absolute" },
  };
  const index = siblings.indexOf(ordered[0]);
  ordered.forEach((n, i) => {
    Object.assign(n, prepared[i]);
    siblings.splice(siblings.indexOf(n), 1);
  });
  siblings.splice(index, 0, group);
  return group;
}
/** options.boxes are child rectangles measured in the destination parent's coordinates. */
export function ungroupNode(board, id, options = {}) {
  const e = locateNode(board, id);
  if (
    !e ||
    !CONTAINERS.has(e.node.type) ||
    (e.node.layout?.mode && e.node.layout.mode !== "absolute")
  )
    throw Error("Ungroup requires an absolute container");
  if (isNodeLocked(board, id)) throw Error("Locked layer");
  stableRoot(e.node);
  const children = e.node.children || [],
    parent = e.parent || board;
  if (parent.layout?.mode && parent.layout.mode !== "absolute")
    throw Error("Ungroup into an absolute parent first");
  for (const n of children) {
    stableRoot(n);
    if (n.locked) throw Error("Locked layer");
  }
  if (!options.boxes && parent.responsive?.length)
    throw Error("Use measured geometry for a responsive parent");
  const actualParent = options.parentSize
    ? checkedSize(options.parentSize)
    : declaredInnerSize(parent);
  let boxes;
  if (options.boxes)
    boxes = providedBoxes(
      options.boxes,
      children.map((n) => n.id),
    );
  else {
    const containerBox = checkedBox(absoluteBox(e.node, parent, actualParent)),
      border = borderInset(e.node);
    const inner = checkedSize({
      w: containerBox.w - border * 2,
      h: containerBox.h - border * 2,
    });
    boxes = new Map(
      children.map((n) => {
        const box = absoluteBox(n, e.node, inner);
        return [
          n.id,
          checkedBox({
            ...box,
            x: containerBox.x + border + box.x,
            y: containerBox.y + border + box.y,
          }),
        ];
      }),
    );
  }
  const prepared = children.map((n) =>
    rebaseGeometry(n, boxes.get(n.id), parent, actualParent),
  );
  children.forEach((n, i) => Object.assign(n, prepared[i]));
  e.siblings.splice(e.siblings.indexOf(e.node), 1, ...children);
  return children.map((n) => n.id);
}
export function alignNodes(board, ids, axis) {
  const entries = ids.map((id) => locateNode(board, id));
  if (
    entries.length < 2 ||
    entries.some(
      (e) =>
        !e ||
        e.siblings !== entries[0].siblings ||
        isNodeLocked(board, e.node.id),
    )
  )
    throw Error("Align requires two unlocked sibling layers");
  if (
    entries[0].parent?.layout?.mode &&
    entries[0].parent.layout.mode !== "absolute"
  )
    throw Error("Auto Layout controls these positions");
  for (const { node, parent } of entries) {
    if (
      node.responsive?.length ||
      parent?.responsive?.length ||
      [node.sizing?.w, node.sizing?.h].some(
        (value) => value && value !== "fixed",
      ) ||
      [node.constraints?.horizontal, node.constraints?.vertical].some(
        (rule) => rule && rule !== "start",
      )
    )
      throw Error(
        "Use measured geometry to align responsive or constrained layers",
      );
  }
  const ns = entries.map((e) => e.node),
    minX = Math.min(...ns.map((n) => n.x)),
    maxX = Math.max(...ns.map((n) => n.x + n.w)),
    minY = Math.min(...ns.map((n) => n.y)),
    maxY = Math.max(...ns.map((n) => n.y + n.h));
  for (const n of ns) {
    if (axis === "left") n.x = minX;
    else if (axis === "right") n.x = maxX - n.w;
    else if (axis === "center") n.x = (minX + maxX - n.w) / 2;
    else if (axis === "top") n.y = minY;
    else if (axis === "bottom") n.y = maxY - n.h;
    else if (axis === "middle") n.y = (minY + maxY - n.h) / 2;
    else throw Error("Unknown alignment");
  }
}
