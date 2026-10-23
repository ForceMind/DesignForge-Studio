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
export function groupNodes(board, ids, groupId) {
  const entries = ids.map((id) => locateNode(board, id));
  if (!entries.length || entries.some((e) => !e))
    throw Error("Select layers first");
  const siblings = entries[0].siblings;
  if (
    entries.some(
      (e) => e.siblings !== siblings || isNodeLocked(board, e.node.id),
    )
  )
    throw Error("Group requires unlocked sibling layers");
  if (
    entries[0].parent?.layout?.mode &&
    entries[0].parent.layout.mode !== "absolute"
  )
    throw Error("Group absolute-layout layers first");
  const ordered = siblings.filter((n) => ids.includes(n.id));
  const x = Math.min(...ordered.map((n) => n.x)),
    y = Math.min(...ordered.map((n) => n.y));
  const w = Math.max(...ordered.map((n) => n.x + n.w)) - x,
    h = Math.max(...ordered.map((n) => n.y + n.h)) - y;
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
  for (const n of ordered) {
    siblings.splice(siblings.indexOf(n), 1);
    n.x -= x;
    n.y -= y;
  }
  siblings.splice(index, 0, group);
  return group;
}
export function ungroupNode(board, id) {
  const e = locateNode(board, id);
  if (
    !e ||
    !CONTAINERS.has(e.node.type) ||
    (e.node.layout?.mode && e.node.layout.mode !== "absolute")
  )
    throw Error("Ungroup requires an absolute container");
  if (isNodeLocked(board, id)) throw Error("Locked layer");
  const children = e.node.children || [];
  for (const n of children) {
    n.x += e.node.x;
    n.y += e.node.y;
  }
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
