/** Snap a free-positioned selection anchor to sibling edges/centers, then an 8px grid. */
export function snapPosition(
  node,
  x,
  y,
  siblings,
  parent,
  threshold = 4,
  grid = 8,
) {
  const others = siblings.filter((n) => n.id !== node.id && !n.hidden);
  const targetsX = [
    0,
    parent.w / 2,
    parent.w,
    ...others.flatMap((n) => [n.x, n.x + n.w / 2, n.x + n.w]),
  ];
  const targetsY = [
    0,
    parent.h / 2,
    parent.h,
    ...others.flatMap((n) => [n.y, n.y + n.h / 2, n.y + n.h]),
  ];
  function axis(value, size, targets) {
    let best = null;
    for (const target of targets)
      for (const offset of [0, size / 2, size]) {
        const distance = target - (value + offset);
        if (
          Math.abs(distance) <= threshold &&
          (!best || Math.abs(distance) < Math.abs(best.distance))
        )
          best = { distance, target };
      }
    return best
      ? { value: value + best.distance, guide: best.target }
      : { value: Math.round(value / grid) * grid, guide: null };
  }
  const sx = axis(x, node.w, targetsX),
    sy = axis(y, node.h, targetsY);
  return { x: sx.value, y: sy.value, guideX: sx.guide, guideY: sy.guide };
}
