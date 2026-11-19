/** Shared breakpoint cascade for the renderer and scoped inspector edits. */
const nested = new Set(["style", "layout", "sizing"]);
export const RESPONSIVE_FIELDS = new Set([
  "w",
  "h",
  "layout",
  "sizing",
  "style",
  "hidden",
]);
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export function mergeNodeChanges(node, changes) {
  const next = { ...node, ...changes };
  for (const key of nested)
    if (object(changes[key])) next[key] = { ...node[key], ...changes[key] };
  return next;
}
export function effectiveNode(node, width) {
  return [...(node.responsive || [])]
    .filter(
      (r) => object(r) && Number.isFinite(r.maxWidth) && object(r.changes),
    )
    .sort((a, b) => b.maxWidth - a.maxWidth)
    .filter((r) => width <= r.maxWidth)
    .reduce((current, r) => mergeNodeChanges(current, r.changes), node);
}
export function activeBreakpoint(node, width) {
  return (
    (node.responsive || [])
      .filter((r) => r && width <= r.maxWidth)
      .sort((a, b) => a.maxWidth - b.maxWidth)[0]?.maxWidth ?? null
  );
}
export function setScopedChanges(node, changes, maxWidth = null) {
  if (maxWidth === null) {
    Object.assign(node, mergeNodeChanges(node, changes));
    return;
  }
  if (!Number.isFinite(maxWidth) || maxWidth < 280 || maxWidth > 2400)
    throw Error("Breakpoint width must be 280–2400");
  if (
    !object(changes) ||
    Object.keys(changes).some((k) => !RESPONSIVE_FIELDS.has(k))
  )
    throw Error("Field cannot be changed at a breakpoint");
  node.responsive ||= [];
  let rule = node.responsive.find((r) => r.maxWidth === maxWidth);
  if (!rule) {
    rule = { maxWidth, changes: {} };
    node.responsive.push(rule);
  }
  rule.changes = mergeNodeChanges(rule.changes, structuredClone(changes));
}
export function resetScopedField(node, maxWidth, path) {
  const [key, child, ...rest] = path.split(".");
  if (
    !RESPONSIVE_FIELDS.has(key) ||
    rest.length ||
    (child &&
      (!nested.has(key) ||
        ["__proto__", "constructor", "prototype"].includes(child)))
  )
    throw Error("Invalid override field");
  const rule = node.responsive?.find((r) => r.maxWidth === maxWidth);
  if (!rule) return;
  if (child) {
    if (object(rule.changes[key])) {
      delete rule.changes[key][child];
      if (!Object.keys(rule.changes[key]).length) delete rule.changes[key];
    }
  } else delete rule.changes[key];
}
