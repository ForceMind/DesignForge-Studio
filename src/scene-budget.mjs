import {
  interactionIssues,
  stateUnits,
  mergeInteractionStates,
} from "./interaction-states.mjs";
/** Resource limits apply to projected DOM work, not only the small persisted AST. */
export const SCENE_LIMITS = Object.freeze({
  boardUnits: 5000,
  projectUnits: 20000,
  textCharacters: 2000000,
  depth: 20,
  visitedNodes: 100000,
});
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const validId = (value) =>
  typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(value);
const emptyCost = () => ({ units: 0, textCharacters: 0 });
class BudgetFailure extends Error {
  constructor(reason, { field, nodeId } = {}) {
    super("Scene resource budget: " + reason);
    this.field = field;
    this.nodeId = nodeId;
  }
}
const fail = (reason, detail) => {
  throw new BudgetFailure(reason, detail);
};
const diagnosticPath = (base, error) =>
  base +
  (error.nodeId ? `[${JSON.stringify(error.nodeId)}]` : "") +
  (error.field ? "." + error.field : "");
const add = (a, b) => ({
  units: a.units + b.units,
  textCharacters: a.textCharacters + b.textCharacters,
});
function context(project, hasProject) {
  const components = new Map(),
    summaries = new Map();
  const stats = { visitedNodes: 0, componentSummaries: 0 };
  if (
    project?.components !== undefined &&
    (!Array.isArray(project.components) || project.components.length > 100)
  )
    fail("malformed or excessive component definitions");
  for (const component of project?.components || []) {
    if (
      !object(component) ||
      !validId(component.id) ||
      components.has(component.id) ||
      !Array.isArray(component.variants) ||
      component.variants.length > 20
    )
      fail("malformed or duplicate component definition");
    const variants = new Map();
    for (const variant of component.variants) {
      if (!object(variant) || !validId(variant.id) || variants.has(variant.id))
        fail("malformed or duplicate component variant");
      variants.set(variant.id, variant);
    }
    components.set(component.id, variants);
  }
  const check = (cost) => {
    if (cost.units > SCENE_LIMITS.boardUnits)
      fail(
        `projected board exceeds ${SCENE_LIMITS.boardUnits} render units (nodes and rich-text spans)`,
      );
    if (cost.textCharacters > SCENE_LIMITS.textCharacters)
      fail(`projected text exceeds ${SCENE_LIMITS.textCharacters} characters`);
    return cost;
  };
  function ownCost(node) {
    const issues = interactionIssues(node);
    if (issues.length)
      fail(issues[0].reason, { field: issues[0].field, nodeId: node.id });
    const interactionUnits = stateUnits(node.states);
    let characters = typeof node.text === "string" ? node.text.length : 0,
      runUnits = 0;
    if (node.textRuns !== undefined) {
      if (!Array.isArray(node.textRuns))
        fail("malformed rich-text runs", {
          field: "textRuns",
          nodeId: node.id,
        });
      runUnits = node.textRuns.length;
      if (["button", "pill"].includes(node.type) && runUnits) runUnits++;
      if (runUnits > SCENE_LIMITS.boardUnits)
        fail("rich-text span count exceeds render-unit limit", {
          field: "textRuns",
          nodeId: node.id,
        });
      let runCharacters = 0;
      for (const run of node.textRuns) {
        if (!object(run) || typeof run.text !== "string")
          fail("malformed rich-text run", {
            field: "textRuns",
            nodeId: node.id,
          });
        runCharacters += run.text.length;
        if (runCharacters > SCENE_LIMITS.textCharacters)
          fail(
            `projected text exceeds ${SCENE_LIMITS.textCharacters} characters`,
          );
      }
      // Invalid mismatched runs cannot hide a large payload behind a short fallback string.
      characters = Math.max(characters, runCharacters);
    }
    return check({
      units: 1 + runUnits + interactionUnits,
      textCharacters: characters,
      runUnits,
      interactionUnits,
    });
  }
  function summaryFor(componentId, variantId) {
    if (!validId(componentId) || !validId(variantId))
      fail("malformed component reference");
    const key = JSON.stringify([componentId, variantId]);
    if (summaries.has(key)) return summaries.get(key);
    const variant = components.get(componentId)?.get(variantId);
    if (!variant) fail("unknown component or variant");
    const sources = new Map(),
      active = new Set();
    const cost = walk(variant.root, 0, active, true, sources);
    const summary = {
      ...cost,
      sources,
      rootId: variant.root.id,
      rootType: variant.root.type,
      rootStates: variant.root.states,
    };
    summaries.set(key, summary);
    stats.componentSummaries++;
    return summary;
  }
  function walk(node, depth, active, definition = false, sources = null) {
    if (++stats.visitedNodes > SCENE_LIMITS.visitedNodes)
      fail("bounded traversal limit exceeded");
    if (depth > SCENE_LIMITS.depth)
      fail(`node depth exceeds ${SCENE_LIMITS.depth}`);
    if (!object(node) || active.has(node))
      fail("malformed or cyclic node tree");
    if (!validId(node.id)) fail("malformed node ID");
    active.add(node);
    try {
      if (definition && node.type === "instance")
        fail("Component definitions cannot contain instances");
      if (node.type === "instance" && hasProject) {
        if (node.textRuns !== undefined)
          fail("rich-text runs on an instance are unsupported", {
            field: "textRuns",
            nodeId: node.id,
          });
        const summary = summaryFor(node.componentId, node.variantId),
          root = summary.sources.get(summary.rootId);
        const issues = interactionIssues(node, summary.rootType);
        if (issues.length)
          fail(issues[0].reason, { field: issues[0].field, nodeId: node.id });
        let cost = {
          units:
            summary.units -
            root.interactionUnits +
            stateUnits(mergeInteractionStates(summary.rootStates, node.states)),
          textCharacters: summary.textCharacters,
        };
        if (node.overrides !== undefined) {
          if (!object(node.overrides)) fail("malformed instance override map");
          const ids = Object.keys(node.overrides);
          if (ids.length > 500) fail("excessive instance override count");
          for (const id of ids) {
            const source = summary.sources.get(id),
              change = node.overrides[id];
            if (!source || !object(change))
              fail("malformed instance override reference");
            if (change.text !== undefined) {
              if (typeof change.text !== "string")
                fail("malformed instance override text");
              if (id !== summary.rootId) {
                cost.textCharacters +=
                  change.text.length - source.textCharacters;
                cost.units -= source.runUnits;
              }
            }
          }
        }
        return check(cost);
      }
      const own = ownCost(node);
      if (sources) {
        if (sources.has(node.id)) fail("duplicate component source ID");
        sources.set(node.id, own);
      }
      let cost = { units: own.units, textCharacters: own.textCharacters };
      if (node.children !== undefined) {
        if (!Array.isArray(node.children)) fail("malformed children array");
        for (const child of node.children)
          cost = check(
            add(cost, walk(child, depth + 1, active, definition, sources)),
          );
      }
      return cost;
    } finally {
      active.delete(node);
    }
  }
  return {
    stats,
    board(board) {
      if (!object(board) || !Array.isArray(board.nodes))
        fail("malformed board nodes");
      let cost = emptyCost();
      const active = new Set();
      for (const node of board.nodes)
        cost = check(add(cost, walk(node, 0, active)));
      return cost;
    },
  };
}
/** Return bounded diagnostics; malformed definitions never throw through validation. */
export function measureSceneBudget(project) {
  const result = {
    boards: [],
    totals: emptyCost(),
    issues: [],
    stats: { visitedNodes: 0, componentSummaries: 0 },
  };
  let ctx;
  try {
    if (
      !object(project) ||
      !Array.isArray(project.boards) ||
      project.boards.length > 24
    )
      fail("malformed or excessive boards");
    ctx = context(project, true);
    result.stats = ctx.stats;
  } catch (error) {
    result.issues.push({
      path: diagnosticPath("scene", error),
      reason: error.message,
    });
    return result;
  }
  for (const [i, board] of project.boards.entries()) {
    try {
      const cost = ctx.board(board);
      result.boards.push({ boardId: board.id, ...cost });
      result.totals = add(result.totals, cost);
      if (result.totals.units > SCENE_LIMITS.projectUnits)
        fail(
          `project exceeds ${SCENE_LIMITS.projectUnits} projected render units`,
        );
      if (result.totals.textCharacters > SCENE_LIMITS.textCharacters)
        fail(
          `project exceeds ${SCENE_LIMITS.textCharacters} projected text characters`,
        );
    } catch (error) {
      result.issues.push({
        path: diagnosticPath(`boards[${i}].scene`, error),
        reason: error.message,
      });
      // Stop at the first budget failure; do not walk the rest of a hostile scene.
      break;
    }
  }
  return result;
}
export const sceneBudgetIssues = (project) =>
  measureSceneBudget(project).issues;
/** Direct rendering checks this board only; no full-project validation or expansion. */
export function assertBoardSceneBudget(board, project = null) {
  return context(project, project !== null).board(board);
}
