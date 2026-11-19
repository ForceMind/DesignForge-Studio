/** Browser measurements remain outside the portable project model. */
export function nodeElement(world, boardId, nodeId) {
  return world.querySelector(
    `[data-artboard="${boardId}"] [data-node-id="${nodeId}"]`,
  );
}
export function measureNode(world, boardId, nodeId, zoom) {
  const element = nodeElement(world, boardId, nodeId);
  if (!element) return null;
  const parent = element.parentElement,
    r = element.getBoundingClientRect(),
    p = parent.getBoundingClientRect(),
    s = getComputedStyle(parent);
  const left = parseFloat(s.borderLeftWidth) || 0,
    top = parseFloat(s.borderTopWidth) || 0,
    right = parseFloat(s.borderRightWidth) || 0,
    bottom = parseFloat(s.borderBottomWidth) || 0;
  return {
    element,
    parent,
    box: {
      x: (r.left - p.left) / zoom - left,
      y: (r.top - p.top) / zoom - top,
      w: r.width / zoom,
      h: r.height / zoom,
    },
    parentSize: {
      w: p.width / zoom - left - right,
      h: p.height / zoom - top - bottom,
    },
  };
}
export function paintResize(
  element,
  box,
  { flow = false, width = true, height = true } = {},
) {
  if (!flow) {
    element.style.setProperty("left", box.x + "px", "important");
    element.style.setProperty("top", box.y + "px", "important");
    element.style.setProperty("right", "auto", "important");
    element.style.setProperty("bottom", "auto", "important");
  }
  if (width) element.style.setProperty("width", box.w + "px", "important");
  if (height) element.style.setProperty("height", box.h + "px", "important");
  // A resized fill item must no longer absorb the remaining flex space.
  const p = getComputedStyle(element.parentElement);
  if (
    p.display === "flex" &&
    (p.flexDirection.startsWith("row") ? width : height)
  ) {
    element.style.setProperty("flex-grow", "0", "important");
    element.style.setProperty("flex-basis", "auto", "important");
  }
}
