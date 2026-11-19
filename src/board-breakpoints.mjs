import { materializeInstance } from "./core.mjs";
import { assertBoardSceneBudget } from "./scene-budget.mjs";

const own = (o, key) => Object.hasOwn(o, key);
const shortName = (n) =>
  [...(typeof n.name === "string" ? n.name : n.id)].slice(0, 45).join("");
const pathsOf = (changes) =>
  Object.entries(changes || {}).flatMap(([key, value]) =>
    ["style", "layout", "sizing"].includes(key) &&
    value &&
    typeof value === "object"
      ? Object.keys(value).map((child) => key + "." + child)
      : [key],
  );

/** Collect exactly the scopes used by the shared renderer, including instance projections. */
export function collectBoardBreakpoints(board, project) {
  assertBoardSceneBudget(board, project);
  const scopes = new Map();
  function record(node, owner, sourceId, editable) {
    for (const rule of node.responsive || []) {
      if (!scopes.has(rule.maxWidth))
        scopes.set(rule.maxWidth, { maxWidth: rule.maxWidth, entries: [] });
      scopes.get(rule.maxWidth).entries.push({
        ownerId: owner.id,
        sourceId,
        editable,
        label: sourceId
          ? shortName(owner) + " / " + shortName(node)
          : shortName(owner),
        fields: pathsOf(rule.changes),
      });
    }
  }
  function projected(node, owner, rootId, root = false) {
    const editable = root && own(owner, "responsive");
    record(
      node,
      owner,
      editable ? null : root ? rootId : node.$sourceId,
      editable,
    );
    for (const child of node.children || []) projected(child, owner, rootId);
  }
  function visit(node) {
    if (node.type === "instance") {
      const rootId = project.components
        ?.find((c) => c.id === node.componentId)
        ?.variants.find((v) => v.id === node.variantId)?.root.id;
      projected(materializeInstance(node, project), node, rootId, true);
    } else {
      record(node, node, null, true);
      for (const child of node.children || []) visit(child);
    }
  }
  for (const node of board.nodes) visit(node);
  return [...scopes.values()]
    .sort((a, b) => b.maxWidth - a.maxWidth)
    .map((scope) => ({
      ...scope,
      ownerCount: new Set(scope.entries.map((e) => e.ownerId)).size,
      fieldCount: scope.entries.reduce((sum, e) => sum + e.fields.length, 0),
    }));
}
export function filterBoardBreakpoints(scopes, query) {
  const text = String(query || "")
    .trim()
    .slice(0, 100)
    .toLocaleLowerCase();
  if (!text) return scopes;
  return scopes
    .map((scope) => {
      const entries = String(scope.maxWidth).includes(text)
        ? scope.entries
        : scope.entries.filter((e) =>
            [e.label, e.ownerId, e.sourceId || "", ...e.fields].some((value) =>
              value.toLocaleLowerCase().includes(text),
            ),
          );
      return {
        ...scope,
        entries,
        ownerCount: new Set(entries.map((e) => e.ownerId)).size,
        fieldCount: entries.reduce((sum, e) => sum + e.fields.length, 0),
      };
    })
    .filter((scope) => scope.entries.length);
}
