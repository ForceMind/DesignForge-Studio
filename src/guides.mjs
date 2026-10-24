/** Editor-only board coordinates. No DOM, CSS or executable content in guides. */
const fields = new Set(["id", "axis", "position", "hidden", "locked"]);
export function validateGuides(guides) {
  if (guides === undefined) return [];
  if (!Array.isArray(guides) || guides.length > 100)
    return ["Expected up to 100 guides"];
  const ids = new Set(),
    errors = [];
  for (const g of guides) {
    if (
      !g ||
      typeof g !== "object" ||
      Array.isArray(g) ||
      Object.keys(g).some((k) => !fields.has(k)) ||
      typeof g.id !== "string" ||
      !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(g.id) ||
      ["constructor", "prototype", "__proto__"].includes(g.id) ||
      ids.has(g.id) ||
      !["x", "y"].includes(g.axis) ||
      !Number.isFinite(g.position) ||
      g.position < 0 ||
      g.position > 10000 ||
      ["hidden", "locked"].some(
        (k) => g[k] !== undefined && typeof g[k] !== "boolean",
      )
    )
      errors.push("Invalid or duplicate guide");
    ids.add(g?.id);
  }
  return errors;
}
export function addGuide(board, guide) {
  const next = [...(board.guides || []), { ...guide }];
  if (validateGuides(next).length)
    throw Error("Invalid guide or guide limit reached");
  board.guides = next;
}
export function updateGuide(board, id, changes) {
  const g = board.guides?.find((g) => g.id === id);
  if (!g) throw Error("Unknown guide");
  if (Object.keys(changes).some((k) => !fields.has(k) || k === "id"))
    throw Error("Unsupported guide field");
  if (
    g.locked &&
    !(Object.keys(changes).length === 1 && changes.locked === false)
  )
    throw Error("Locked guide");
  const next = board.guides.map((g) =>
    g.id === id ? { ...g, ...changes } : g,
  );
  if (validateGuides(next).length) throw Error("Invalid guide");
  board.guides = next;
}
export function removeGuide(board, id) {
  const g = board.guides?.find((g) => g.id === id);
  if (!g) throw Error("Unknown guide");
  if (g.locked) throw Error("Locked guide");
  board.guides = board.guides.filter((g) => g.id !== id);
}
/** Convert board-local targets to the immediate parent's padding-box origin. */
export function guideTargets(guides, parentOffset) {
  const targets = { x: [], y: [] };
  for (const g of guides || [])
    if (!g.hidden) targets[g.axis].push(g.position - parentOffset[g.axis]);
  return targets;
}
/** Adaptive 1/2/5 major intervals with five minor subdivisions. */
export function rulerTicks(origin, zoom, length) {
  if (
    ![origin, zoom, length].every(Number.isFinite) ||
    zoom <= 0 ||
    length <= 0
  )
    return [];
  const desired = 60 / zoom,
    power = 10 ** Math.floor(Math.log10(desired));
  const major = [1, 2, 5, 10].map((n) => n * power).find((n) => n >= desired);
  const step = major / 5,
    start = Math.ceil((20 - origin) / zoom / step);
  const end = Math.floor((length - origin) / zoom / step),
    ticks = [];
  for (let i = start; i <= end && ticks.length < 1000; i++)
    ticks.push({
      pixel: origin + i * step * zoom,
      value: Math.round(i * step * 100) / 100,
      major: i % 5 === 0,
    });
  return ticks;
}
