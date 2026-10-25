export const INTERACTION_STATES = Object.freeze([
  "hover",
  "active",
  "focus",
  "error",
  "disabled",
  "loading",
]);
export const STATE_STYLE_FIELDS = Object.freeze([
  "fill",
  "color",
  "stroke",
  "opacity",
]);
export const INTERACTION_FLAGS = Object.freeze([
  "disabled",
  "loading",
  "invalid",
]);
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export function interactionIssues(node, type = node.type) {
  const issues = [];
  for (const flag of INTERACTION_FLAGS) {
    if (node[flag] === undefined) continue;
    if (typeof node[flag] !== "boolean")
      issues.push({ field: flag, reason: "Expected boolean" });
    if (
      !["button", "input"].includes(type) ||
      (flag === "loading" && type !== "button") ||
      (flag === "invalid" && type !== "input")
    )
      issues.push({
        field: flag,
        reason: "Unsupported interaction flag for element type",
      });
  }
  if (node.states === undefined) return issues;
  if (!["button", "input"].includes(type))
    issues.push({
      field: "states",
      reason: "Interaction states require a button or input",
    });
  if (
    !object(node.states) ||
    Object.keys(node.states).length > INTERACTION_STATES.length
  )
    return [
      ...issues,
      { field: "states", reason: "Expected a bounded interaction state map" },
    ];
  for (const [key, value] of Object.entries(node.states)) {
    if (
      !INTERACTION_STATES.includes(key) ||
      !object(value) ||
      Object.keys(value).some((k) => k !== "style") ||
      !object(value.style) ||
      Object.keys(value.style).some((k) => !STATE_STYLE_FIELDS.includes(k))
    )
      issues.push({
        field: "states",
        reason: "Unsupported interaction state or style field",
      });
  }
  return issues;
}
export function stateUnits(states) {
  return states
    ? Object.values(states).reduce(
        (sum, state) => sum + 1 + Object.keys(state.style).length,
        0,
      )
    : 0;
}
export function mergeInteractionStates(base, changes) {
  if (base === undefined && changes === undefined) return undefined;
  const result = {};
  for (const state of INTERACTION_STATES)
    if (Object.hasOwn(base || {}, state) || Object.hasOwn(changes || {}, state))
      result[state] = {
        style: { ...base?.[state]?.style, ...changes?.[state]?.style },
      };
  return result;
}
const pseudo = {
  hover: ":hover:not(:disabled):not([aria-busy=true])",
  active: ":active:not(:disabled):not([aria-busy=true])",
  focus: ":focus-visible",
  error: "[aria-invalid=true]",
  disabled: ":disabled",
  loading: "[aria-busy=true]",
};
/** Resolve only data fields; selectors and CSS property names never come from project text. */
export function interactionRules(node, selector, { color, opacity }) {
  const rules = [];
  for (const state of INTERACTION_STATES) {
    const style = node.states?.[state]?.style;
    if (!style) continue;
    const declarations = STATE_STYLE_FIELDS.filter((field) =>
      Object.hasOwn(style, field),
    )
      .map(
        (field) =>
          `${{ fill: "background", color: "color", stroke: "border-color", opacity: "opacity" }[field]}:${field === "opacity" ? opacity(style[field]) : color(style[field])}!important`,
      )
      .join(";");
    if (declarations)
      rules.push(
        `${selector}:not([data-df-state])${pseudo[state]},${selector}[data-df-state="${state}"]{${declarations}}`,
      );
  }
  return rules.join("");
}
export const interactionCss = `.df-node[data-df-interactive]{transition:background-color 160ms cubic-bezier(.32,.72,0,1),color 160ms cubic-bezier(.32,.72,0,1),border-color 160ms cubic-bezier(.32,.72,0,1),opacity 160ms cubic-bezier(.32,.72,0,1)}.df-node[data-df-interactive]:not([data-df-state]):focus-visible,.df-node[data-df-interactive][data-df-state=focus]{outline:2px solid var(--df-focus-ring,#6958e8);outline-offset:3px}.df-button[data-df-interactive]:not([data-df-state])[aria-busy=true]::before,.df-button[data-df-interactive][data-df-state=loading]::before{content:"";width:12px;height:12px;flex:none;border:2px solid currentColor;border-left-color:transparent;border-radius:50%;margin-right:8px;animation:df-busy-spin .8s linear infinite}.df-node[data-df-interactive]:disabled{cursor:not-allowed}@keyframes df-busy-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.df-node[data-df-interactive]{transition:none}.df-button[data-df-interactive]::before{animation:none!important}}`;
