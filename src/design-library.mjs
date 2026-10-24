import { clone, validateProject, isObject } from "./core.mjs";

export const LIBRARY_FORMAT = "designforge.library";
export const LIBRARY_VERSION = 1;
const MAX_BYTES = 2 * 1024 * 1024;
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const topFields = new Set([
  "format",
  "version",
  "name",
  "tokens",
  "themes",
  "components",
  "assets",
]);
const nodeFields = new Set([
  "id",
  "type",
  "name",
  "x",
  "y",
  "w",
  "h",
  "text",
  "style",
  "locked",
  "hidden",
  "icon",
  "children",
  "layout",
  "sizing",
  "constraints",
  "responsive",
  "assetId",
  "textRuns",
]);
function assertFields(value, allowed, path) {
  if (!isObject(value) || Object.keys(value).some((k) => !allowed.has(k)))
    throw Error(`${path}: unknown or invalid fields`);
}
function assertJson(
  value,
  path = "library",
  depth = 0,
  seen = new Set(),
  budget = { bytes: 0, nodes: 0 },
) {
  if (depth > 50) throw Error(`${path}: data nesting limit exceeded`);
  budget.nodes++;
  budget.bytes +=
    typeof value === "string" ? new TextEncoder().encode(value).length : 4;
  if (budget.bytes > MAX_BYTES || budget.nodes > 100000)
    throw Error("Library exceeds 2 MB or item limit");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (
    !value ||
    typeof value !== "object" ||
    seen.has(value) ||
    (!Array.isArray(value) &&
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
  )
    throw Error(`${path}: pure JSON data required`);
  if (Object.getOwnPropertySymbols(value).length)
    throw Error(`${path}: symbols are not JSON data`);
  if (
    Array.isArray(value) &&
    (value.length > 50000 || Object.keys(value).length !== value.length)
  )
    throw Error(`${path}: invalid or oversized array`);
  seen.add(value);
  for (const [k, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if (Array.isArray(value) && k === "length") continue;
    if (forbidden.has(k)) throw Error(`${path}: unsafe key`);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value"))
      throw Error(`${path}: accessors/non-enumerable fields are not JSON data`);
    budget.bytes += new TextEncoder().encode(k).length + 3;
    assertJson(descriptor.value, `${path}.${k}`, depth + 1, seen, budget);
  }
  seen.delete(value);
}
function assertNodeFields(node, path) {
  assertFields(node, nodeFields, path);
  if (node.children !== undefined) {
    if (!Array.isArray(node.children))
      throw Error(`${path}.children: array required`);
    for (const [i, n] of node.children.entries())
      assertNodeFields(n, `${path}.children[${i}]`);
  }
  if (node.responsive !== undefined) {
    if (!Array.isArray(node.responsive))
      throw Error(`${path}.responsive: array required`);
    for (const r of node.responsive)
      assertFields(r, new Set(["maxWidth", "changes"]), `${path}.responsive`);
  }
}
function validateOrThrow(project, label) {
  const issues = validateProject(project);
  if (issues.length)
    throw Error(
      `${label}: ${issues
        .slice(0, 3)
        .map((i) => i.path + ": " + i.reason)
        .join("; ")}`,
    );
}
function checkedBundle(bundle) {
  assertJson(bundle);
  if (new TextEncoder().encode(JSON.stringify(bundle)).length > MAX_BYTES)
    throw Error("Library exceeds 2 MB");
  assertFields(bundle, topFields, "library");
  if (bundle.format !== LIBRARY_FORMAT || bundle.version !== LIBRARY_VERSION)
    throw Error("Unsupported library format/version");
  if (
    typeof bundle.name !== "string" ||
    !bundle.name.trim() ||
    bundle.name.length > 200
  )
    throw Error("Library name required (up to 200 characters)");
  if (
    !isObject(bundle.tokens) ||
    !isObject(bundle.themes) ||
    !Array.isArray(bundle.components) ||
    !Array.isArray(bundle.assets)
  )
    throw Error("Library tokens/themes/components/assets required");
  for (const [i, c] of bundle.components.entries()) {
    assertFields(c, new Set(["id", "name", "variants"]), `components[${i}]`);
    if (!Array.isArray(c.variants))
      throw Error("Component variants array required");
    for (const [j, v] of c.variants.entries()) {
      assertFields(
        v,
        new Set(["id", "name", "root"]),
        `components[${i}].variants[${j}]`,
      );
      assertNodeFields(v.root, `components[${i}].variants[${j}].root`);
    }
  }
  for (const asset of bundle.assets)
    assertFields(
      asset,
      new Set(["id", "name", "type", "mime", "data"]),
      "assets",
    );
  validateOrThrow(
    {
      format: "designforge.project",
      version: 1,
      id: "libraryValidation",
      title: bundle.name,
      tokens: bundle.tokens,
      themes: bundle.themes,
      components: bundle.components,
      assets: bundle.assets,
      boards: [
        {
          id: "libraryBoard",
          name: "Library validation",
          x: 0,
          y: 0,
          w: 280,
          h: 280,
          bg: "#FFFFFF",
          nodes: [],
        },
      ],
      comments: [],
    },
    "Invalid library",
  );
  return clone(bundle);
}
function stable(value) {
  return JSON.stringify(value, (_, v) =>
    isObject(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}
function prefixedBundle(bundle, prefix) {
  if (!prefix) return bundle;
  if (!/^[a-zA-Z][a-zA-Z0-9]{0,15}$/.test(prefix) || forbidden.has(prefix))
    throw Error("Prefix requires 1–16 letters/digits, starting with a letter");
  const tokenNames = new Set([
    ...Object.keys(bundle.tokens),
    ...Object.values(bundle.themes).flatMap((t) => Object.keys(t)),
  ]);
  const tokenMap = new Map(
    [...tokenNames].map((k) => [k, prefix + k[0].toUpperCase() + k.slice(1)]),
  );
  const assetMap = new Map(
    bundle.assets.map((a) => [a.id, "asset" + prefix + "-" + a.id]),
  );
  const componentMap = new Map(
    bundle.components.map((c) => [c.id, prefix + "-" + c.id]),
  );
  const themeMap = new Map(
    Object.keys(bundle.themes).map((k) => [k, prefix + "-" + k]),
  );
  if (new Set(tokenMap.values()).size !== tokenMap.size)
    throw Error("Prefix causes token name collisions");
  const reference = (value) => {
    if (typeof value !== "string") return value;
    if (value.startsWith("$") && tokenMap.has(value.slice(1)))
      return "$" + tokenMap.get(value.slice(1));
    if (value.startsWith("asset:") && assetMap.has(value.slice(6)))
      return "asset:" + assetMap.get(value.slice(6));
    return value;
  };
  const tokens = (map) =>
    Object.fromEntries(
      Object.entries(map).map(([k, v]) => [tokenMap.get(k), reference(v)]),
    );
  function fields(map) {
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, reference(v)]),
    );
  }
  function node(n) {
    const result = { ...n };
    if (n.style) result.style = fields(n.style);
    if (
      ["text", "button", "pill", "input"].includes(n.type) &&
      n.style?.fontFamily === undefined
    )
      result.style = {
        ...result.style,
        fontFamily: "$" + tokenMap.get("fontFamily"),
      };
    if (n.layout) result.layout = fields(n.layout);
    if (n.assetId) result.assetId = assetMap.get(n.assetId) || n.assetId;
    if (n.componentId)
      result.componentId = componentMap.get(n.componentId) || n.componentId;
    if (n.children) result.children = n.children.map(node);
    if (n.textRuns)
      result.textRuns = n.textRuns.map((run) => ({
        ...run,
        ...(run.style ? { style: fields(run.style) } : {}),
      }));
    if (n.responsive)
      result.responsive = n.responsive.map((r) => ({
        ...r,
        changes: {
          ...r.changes,
          ...(r.changes.style ? { style: fields(r.changes.style) } : {}),
          ...(r.changes.layout ? { layout: fields(r.changes.layout) } : {}),
        },
      }));
    if (n.overrides)
      result.overrides = Object.fromEntries(
        Object.entries(n.overrides).map(([id, o]) => [
          id,
          { ...o, ...(o.style ? { style: fields(o.style) } : {}) },
        ]),
      );
    return result;
  }
  return {
    ...bundle,
    tokens: tokens(bundle.tokens),
    themes: Object.fromEntries(
      Object.entries(bundle.themes).map(([id, t]) => [
        themeMap.get(id),
        tokens(t),
      ]),
    ),
    assets: bundle.assets.map((a) => ({ ...a, id: assetMap.get(a.id) })),
    components: bundle.components.map((c) => ({
      ...c,
      id: componentMap.get(c.id),
      variants: c.variants.map((v) => ({ ...v, root: node(v.root) })),
    })),
  };
}
function mergeMap(target, incoming, label, counts) {
  for (const [key, value] of Object.entries(incoming)) {
    if (Object.hasOwn(target, key)) {
      if (stable(target[key]) !== stable(value))
        throw Error(`${label} conflict: ${key}`);
      counts.reused++;
    } else {
      target[key] = clone(value);
      counts.added++;
    }
  }
}
function mergeList(target, incoming, label, counts) {
  const byId = new Map(target.map((item) => [item.id, item]));
  for (const value of incoming) {
    const previous = byId.get(value.id);
    if (previous) {
      if (stable(previous) !== stable(value))
        throw Error(`${label} conflict: ${value.id}`);
      counts.reused++;
    } else {
      const copy = clone(value);
      target.push(copy);
      byId.set(copy.id, copy);
      counts.added++;
    }
  }
}
function prepareImport(project, bundle, { prefix = "" } = {}) {
  if (typeof prefix !== "string") throw Error("Prefix must be a string");
  validateOrThrow(project, "Current project invalid");
  const safe = checkedBundle(bundle),
    incoming = prefixedBundle(safe, prefix),
    next = clone(project);
  const summary = {
    name: safe.name,
    prefix,
    tokens: { added: 0, reused: 0 },
    themes: { added: 0, reused: 0 },
    components: { added: 0, reused: 0 },
    assets: { added: 0, reused: 0 },
  };
  next.themes ||= {};
  next.components ||= [];
  next.assets ||= [];
  mergeMap(next.tokens, incoming.tokens, "Token", summary.tokens);
  mergeMap(next.themes, incoming.themes, "Theme", summary.themes);
  mergeList(
    next.components,
    incoming.components,
    "Component",
    summary.components,
  );
  mergeList(next.assets, incoming.assets, "Asset", summary.assets);
  validateOrThrow(next, "Imported library invalid");
  return { project: next, summary };
}
export function exportDesignLibrary(project, { name = project.title } = {}) {
  validateOrThrow(project, "Current project invalid");
  return checkedBundle({
    format: LIBRARY_FORMAT,
    version: LIBRARY_VERSION,
    name,
    tokens: clone(project.tokens),
    themes: clone(project.themes || {}),
    components: clone(project.components || []),
    assets: clone(project.assets || []),
  });
}
export function importDesignLibrary(project, bundle, options = {}) {
  return prepareImport(project, bundle, options).project;
}
export function summarizeDesignLibraryImport(project, bundle, options = {}) {
  return prepareImport(project, bundle, options).summary;
}
