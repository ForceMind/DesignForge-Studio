import { clone, hashProject, validateProject } from "./core.mjs";
import { CONTAINERS, flattenNodes, locateNode, isNodeLocked } from "./tree.mjs";

export const HISTORY_LIMIT = 35;
export const HISTORY_CHAR_BUDGET = 12 * 1024 * 1024;
const sizes = new WeakMap();
const own = (o, key) => o != null && Object.hasOwn(o, key);
const object = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
const same = (a, b) => {
  if (Object.is(a, b)) return true;
  if (
    !a ||
    !b ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => own(b, key) && same(a[key], b[key]))
  );
};
const state = (o, key) =>
  own(o, key) ? { exists: true, value: o[key] } : { exists: false };
const fields = [
  "name",
  "x",
  "y",
  "w",
  "h",
  "style",
  "layout",
  "sizing",
  "constraints",
  "responsive",
  "hidden",
  "variantId",
  "overrides",
  "assetId",
  "icon",
  "locked",
];
const nested = new Set([
  "style",
  "layout",
  "sizing",
  "constraints",
  "overrides",
]);
const geometry = new Set(["x", "y", "w", "h", "sizing", "constraints"]);
const boardOf = (p, id) => p.boards.find((b) => b.id === id);
const commentsFor = (p, boardId, ids) =>
  p.comments.filter((c) => c.boardId === boardId && ids.has(c.nodeId));
const idsOf = (nodes) => new Set(flattenNodes(nodes).map((e) => e.node.id));
const location = (e) =>
  e
    ? {
        parentId: e.parent?.id ?? null,
        previousId: e.siblings[e.siblings.indexOf(e.node) - 1]?.id ?? null,
        nextId: e.siblings[e.siblings.indexOf(e.node) + 1]?.id ?? null,
      }
    : null;

/** Bound the existing snapshot history, always keeping the newest snapshot. */
export function retainHistory(
  snapshots,
  { maxEntries = HISTORY_LIMIT, maxChars = HISTORY_CHAR_BUDGET } = {},
) {
  if (
    !Number.isInteger(maxEntries) ||
    maxEntries < 1 ||
    !Number.isFinite(maxChars) ||
    maxChars < 1
  )
    throw Error("Invalid history budget");
  let total = 0;
  const result = [];
  for (
    let i = snapshots.length - 1;
    i >= 0 && result.length < maxEntries;
    i--
  ) {
    const snapshot = snapshots[i];
    if (!sizes.has(snapshot))
      sizes.set(snapshot, JSON.stringify(snapshot).length);
    const size = sizes.get(snapshot);
    if (result.length && total + size > maxChars) break;
    total += size;
    result.unshift(snapshot);
  }
  return result;
}
function continuousHistory(snapshots, index, projectId) {
  const end = Math.min(index, snapshots.length - 1);
  let start = end;
  while (start > 0 && snapshots[start - 1].id === projectId) start--;
  return snapshots
    .slice(start, end + 1)
    .map((project, i) => ({ project, index: start + i }));
}
/** Recent current and removed layers, limited to the current project's active history branch. */
export function historyNodeChoices(
  snapshots,
  index,
  boardId,
  projectId,
  limit = 500,
) {
  const found = new Map();
  for (const { project } of continuousHistory(
    snapshots,
    index,
    projectId,
  ).reverse()) {
    const board = boardOf(project, boardId);
    for (const { node } of flattenNodes(board?.nodes || [])) {
      if (!found.has(node.id))
        found.set(node.id, {
          id: node.id,
          name:
            typeof node.name === "string" ? node.name : node.text || node.type,
        });
      if (found.size >= limit) return [...found.values()];
    }
  }
  return [...found.values()];
}
function structuralState(p, boardId, entry, ids) {
  return entry
    ? {
        node: entry.node,
        location: location(entry),
        comments: commentsFor(p, boardId, ids),
      }
    : null;
}
function textState(node) {
  return Object.fromEntries(
    ["text", "textRuns"]
      .filter((key) => own(node, key))
      .map((key) => [key, node[key]]),
  );
}
function placementState(entry) {
  return {
    location: location(entry),
    geometry: Object.fromEntries(
      [...geometry].map((key) => [key, state(entry.node, key)]),
    ),
  };
}
/** Compute semantic groups. Text + runs and variant + overrides remain atomic. */
export function nodeRevisionChanges(before, after, boardId, nodeId) {
  if (before.id !== after.id)
    throw Error("History belongs to different projects");
  const a = locateNode(boardOf(before, boardId) || { nodes: [] }, nodeId),
    b = locateNode(boardOf(after, boardId) || { nodes: [] }, nodeId),
    changes = [];
  if (!a && !b) return changes;
  const add = (key, kind, oldValue, newValue, path) => {
    if (!same(oldValue, newValue))
      changes.push({
        key,
        kind,
        before: clone(oldValue),
        after: clone(newValue),
        ...(path ? { path } : {}),
      });
    if (changes.length > 256)
      throw Error("Node history exceeds 256 changed fields");
  };
  if (
    !a ||
    !b ||
    a.node.type !== b.node.type ||
    a.node.componentId !== b.node.componentId
  ) {
    const ids = idsOf([a?.node, b?.node].filter(Boolean));
    add(
      "$node",
      "node",
      structuralState(before, boardId, a, ids),
      structuralState(after, boardId, b, ids),
    );
    return changes;
  }
  const parentChanged = a.parent?.id !== b.parent?.id;
  if (parentChanged)
    add("$placement", "placement", placementState(a), placementState(b));
  add("text + textRuns", "text", textState(a.node), textState(b.node));
  const variantChanged = a.node.variantId !== b.node.variantId;
  if (variantChanged)
    add(
      "variantId + overrides",
      "variant",
      {
        variantId: state(a.node, "variantId"),
        overrides: state(a.node, "overrides"),
      },
      {
        variantId: state(b.node, "variantId"),
        overrides: state(b.node, "overrides"),
      },
    );
  function walk(old, next, path) {
    if (same(old, next)) return;
    if (
      (object(old.value) || !old.exists) &&
      (object(next.value) || !next.exists) &&
      (object(old.value) || object(next.value))
    ) {
      for (const key of new Set([
        ...Object.keys(old.value || {}),
        ...Object.keys(next.value || {}),
      ]))
        walk(state(old.value, key), state(next.value, key), [...path, key]);
    } else add(path.join("."), "field", old, next, path);
  }
  for (const key of fields) {
    if (
      (parentChanged && geometry.has(key)) ||
      (variantChanged && ["variantId", "overrides"].includes(key))
    )
      continue;
    if (nested.has(key)) walk(state(a.node, key), state(b.node, key), [key]);
    else add(key, "field", state(a.node, key), state(b.node, key), [key]);
  }
  const oldChildren = a.node.children || [],
    newChildren = b.node.children || [],
    oldIds = oldChildren.map((n) => n.id),
    newIds = newChildren.map((n) => n.id);
  if (!same(oldIds, newIds)) {
    if (same([...oldIds].sort(), [...newIds].sort()))
      add("$childrenOrder", "order", oldIds, newIds);
    else {
      const ids = idsOf([...oldChildren, ...newChildren]);
      add(
        "$children",
        "children",
        {
          children: state(a.node, "children"),
          comments: commentsFor(before, boardId, ids),
        },
        {
          children: state(b.node, "children"),
          comments: commentsFor(after, boardId, ids),
        },
      );
    }
  }
  return changes;
}
export function nodeRevisionTimeline(
  snapshots,
  index,
  boardId,
  nodeId,
  projectId,
) {
  const frames = continuousHistory(snapshots, index, projectId),
    result = [];
  for (let i = 1; i < frames.length; i++) {
    try {
      const changes = nodeRevisionChanges(
        frames[i - 1].project,
        frames[i].project,
        boardId,
        nodeId,
      );
      if (changes.length)
        result.unshift({
          index: frames[i].index,
          time: frames[i].project.updatedAt,
          fields: changes.map((c) => c.key),
          count: changes.length,
        });
    } catch (error) {
      result.unshift({
        index: frames[i].index,
        fields: [],
        count: 0,
        error: error.message,
      });
    }
  }
  return result;
}
function readField(node, path) {
  let object = node;
  for (const key of path.slice(0, -1)) {
    if (!own(object, key)) return { exists: false };
    object = object[key];
  }
  return state(object, path.at(-1));
}
function setState(object, key, value) {
  if (value.exists)
    Object.defineProperty(object, key, {
      value: clone(value.value),
      writable: true,
      configurable: true,
      enumerable: true,
    });
  else delete object[key];
}
function restoreField(node, original, path, value) {
  let current = node,
    old = original;
  const parents = [];
  for (const key of path.slice(0, -1)) {
    if (!own(current, key) || !object(current[key]))
      Object.defineProperty(current, key, {
        value: {},
        writable: true,
        configurable: true,
        enumerable: true,
      });
    parents.push({ object: current, key, existed: own(old, key) });
    current = current[key];
    old = own(old, key) ? old[key] : null;
  }
  setState(current, path.at(-1), value);
  for (const parent of parents.reverse())
    if (!parent.existed && Object.keys(parent.object[parent.key]).length === 0)
      delete parent.object[parent.key];
}
function nodeStateAt(current, boardId, entry, change) {
  if (change.kind === "node") {
    const ids = idsOf(
      [change.before?.node, change.after?.node].filter(Boolean),
    );
    return structuralState(current, boardId, entry, ids);
  }
  if (!entry) return null;
  if (change.kind === "field") return readField(entry.node, change.path);
  if (change.kind === "text") return textState(entry.node);
  if (change.kind === "variant")
    return {
      variantId: state(entry.node, "variantId"),
      overrides: state(entry.node, "overrides"),
    };
  if (change.kind === "placement") return placementState(entry);
  if (change.kind === "order")
    return (entry.node.children || []).map((n) => n.id);
  const ids = idsOf([
    ...(change.before.children.value || []),
    ...(change.after.children.value || []),
  ]);
  return {
    children: state(entry.node, "children"),
    comments: commentsFor(current, boardId, ids),
  };
}
function insertionIndex(list, desired) {
  if (desired.nextId && list.some((n) => n.id === desired.nextId))
    return list.findIndex((n) => n.id === desired.nextId);
  if (desired.previousId && list.some((n) => n.id === desired.previousId))
    return list.findIndex((n) => n.id === desired.previousId) + 1;
  if (!list.length || (!desired.nextId && !desired.previousId))
    return list.length;
  throw Error("原相邻图层已不存在，不能安全恢复顺序");
}
function targetList(board, parentId) {
  if (!parentId) return board.nodes;
  const parent = locateNode(board, parentId)?.node;
  if (!parent || !CONTAINERS.has(parent.type)) throw Error("原父容器不存在");
  if (isNodeLocked(board, parentId)) throw Error("原父容器已锁定");
  return (parent.children ||= []);
}
function restoreComments(current, boardId, change, before, after) {
  const ids =
    change.kind === "node"
      ? idsOf([change.before?.node, change.after?.node].filter(Boolean))
      : idsOf([
          ...(change.before.children.value || []),
          ...(change.after.children.value || []),
        ]);
  const removedIds = new Set(after.map((c) => c.id));
  current.comments = current.comments.filter(
    (c) =>
      !(c.boardId === boardId && ids.has(c.nodeId) && removedIds.has(c.id)),
  );
  for (const comment of before) {
    const existing = current.comments.find((c) => c.id === comment.id);
    if (existing && !same(existing, comment))
      throw Error("批注 ID 已被其他内容使用");
    if (!existing) current.comments.push(clone(comment));
  }
}
function applyChange(current, beforeProject, boardId, nodeId, change) {
  const board = boardOf(current, boardId),
    entry = locateNode(board, nodeId),
    node = entry?.node,
    original = locateNode(
      boardOf(beforeProject, boardId) || { nodes: [] },
      nodeId,
    )?.node;
  if (change.kind === "node") {
    if (entry) entry.siblings.splice(entry.siblings.indexOf(node), 1);
    if (change.before) {
      const list = targetList(board, change.before.location.parentId);
      list.splice(
        insertionIndex(list, change.before.location),
        0,
        clone(change.before.node),
      );
    }
    restoreComments(
      current,
      boardId,
      change,
      change.before?.comments || [],
      change.after?.comments || [],
    );
  } else if (change.kind === "field")
    restoreField(node, original, change.path, change.before);
  else if (change.kind === "text") {
    delete node.text;
    delete node.textRuns;
    Object.assign(node, clone(change.before));
  } else if (change.kind === "variant") {
    setState(node, "variantId", change.before.variantId);
    setState(node, "overrides", change.before.overrides);
  } else if (change.kind === "placement") {
    entry.siblings.splice(entry.siblings.indexOf(node), 1);
    const originalEntry = locateNode(boardOf(beforeProject, boardId), nodeId),
      desired = location(originalEntry),
      list = targetList(board, desired.parentId);
    list.splice(insertionIndex(list, desired), 0, node);
    for (const key of geometry)
      setState(node, key, change.before.geometry[key]);
  } else if (change.kind === "order") {
    const byId = new Map(node.children.map((n) => [n.id, n]));
    node.children = change.before.map((id) => byId.get(id));
  } else {
    setState(node, "children", change.before.children);
    restoreComments(
      current,
      boardId,
      change,
      change.before.comments,
      change.after.comments,
    );
  }
}
function assertValid(p) {
  const issues = validateProject(p);
  if (issues.length)
    throw Error(
      issues
        .slice(0, 2)
        .map((i) => `${i.path}: ${i.reason}`)
        .join("; "),
    );
}
/** Revert selected, unchanged fields of one historical step. Every result is revalidated. */
export function planNodeRevisionRevert(
  current,
  before,
  after,
  { boardId, nodeId, keys } = {},
) {
  for (const p of [current, before, after]) assertValid(p);
  if (!current.id || current.id !== before.id || before.id !== after.id)
    throw Error("History belongs to different projects");
  const board = boardOf(current, boardId);
  if (!board) throw Error("画板已不存在");
  const entry = locateNode(board, nodeId),
    originalEntry = locateNode(
      boardOf(after, boardId) || { nodes: [] },
      nodeId,
    );
  const changes = nodeRevisionChanges(before, after, boardId, nodeId).map(
    (change) => {
      const actual = nodeStateAt(current, boardId, entry, change);
      const comparable = (value) =>
        change.kind === "node" && value
          ? { ...value, location: { parentId: value.location.parentId } }
          : value;
      let status = same(comparable(actual), comparable(change.before))
          ? "already"
          : same(comparable(actual), comparable(change.after))
            ? "ready"
            : "conflict",
        reason = "";
      if (entry && isNodeLocked(board, nodeId)) {
        status = "blocked";
        reason = "图层或祖先已锁定，请先显式解锁";
      }
      if (
        ["node", "children", "order"].includes(change.kind) &&
        entry &&
        flattenNodes([entry.node]).some((e) => e.node.locked)
      ) {
        status = "blocked";
        reason = "结构包含锁定后代";
      }
      if (
        change.kind === "field" &&
        geometry.has(change.path[0]) &&
        entry?.parent?.id !== originalEntry?.parent?.id
      ) {
        status = "conflict";
        reason = "父容器已改变，保留当前坐标空间";
      }
      if (status === "conflict" && !reason)
        reason = "此字段有后续修改，保留当前内容";
      return { ...change, current: clone(actual), status, reason };
    },
  );
  if (
    keys !== undefined &&
    (!Array.isArray(keys) ||
      keys.some((key) => !changes.some((c) => c.key === key)) ||
      new Set(keys).size !== keys.length)
  )
    throw Error("Unknown history fields");
  const selected =
    keys === undefined
      ? changes.filter((c) => c.status === "ready").map((c) => c.key)
      : keys;
  if (
    selected.some(
      (key) => changes.find((c) => c.key === key).status !== "ready",
    )
  )
    throw Error("冲突或锁定字段不能直接恢复");
  let project = null,
    error = null;
  if (selected.length) {
    try {
      project = clone(current);
      for (const change of changes.filter((c) => selected.includes(c.key)))
        applyChange(project, before, boardId, nodeId, change);
      assertValid(project);
    } catch (cause) {
      project = null;
      error = cause.message;
    }
  }
  return {
    baseHash: hashProject(current),
    boardId,
    nodeId,
    changes,
    selected,
    project,
    error,
  };
}
