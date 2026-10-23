/** Portable local-only assets. No arbitrary URL or executable SVG support. */
const svgTags = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "title",
  "desc",
]);
const svgAttrs = new Set([
  "xmlns",
  "viewBox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "opacity",
  "transform",
  "id",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "clip-path",
  "preserveAspectRatio",
]);
export function assertSafeSvg(source) {
  if (
    typeof source !== "string" ||
    source.length > 200000 ||
    /[&]|<!|<\?/.test(source)
  )
    throw Error(
      "SVG entities, declarations and processing instructions are not supported",
    );
  const tags = source.match(/<[^>]*>/g) || [];
  if (
    !tags.length ||
    !/^\s*<svg[\s>]/.test(source) ||
    source.replace(/<[^>]*>/g, "").trim()
  )
    throw Error("SVG must contain vector elements only");
  const stack = [];
  for (const tag of tags) {
    const m = /^<(\/?)([a-zA-Z]+)([\s\S]*?)(\/?)>$/.exec(tag);
    if (!m || !svgTags.has(m[2])) throw Error("Unsupported SVG element");
    if (m[1]) {
      if (m[3].trim() || m[4] || stack.pop() !== m[2])
        throw Error("Invalid SVG nesting");
      continue;
    }
    let rest = m[3];
    const seen = new Set();
    while (rest.trim()) {
      const a =
        /^\s+([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(rest);
      if (!a || !svgAttrs.has(a[1]) || seen.has(a[1]))
        throw Error("Unsupported SVG attribute");
      const value = a[2] ?? a[3];
      seen.add(a[1]);
      if (
        /[<>]|javascript:|data:|https?:|url\(/i.test(value) &&
        !(a[1] === "xmlns" && value === "http://www.w3.org/2000/svg") &&
        !/^url\(#[a-zA-Z][\w-]*\)$/.test(value)
      )
        throw Error("SVG external references are not supported");
      rest = rest.slice(a[0].length);
    }
    if (!m[4]) stack.push(m[2]);
  }
  if (stack.length) throw Error("Unclosed SVG elements");
  return source;
}
export function validateAssets(assets = []) {
  const issues = [];
  const fail = (reason) => issues.push(reason);
  if (!Array.isArray(assets) || assets.length > 32)
    return ["Expected up to 32 assets"];
  let size = 0;
  const ids = new Set();
  for (const asset of assets) {
    if (
      !asset ||
      !/^asset[a-zA-Z0-9_-]{1,64}$/.test(asset.id) ||
      ids.has(asset.id)
    ) {
      fail("Invalid or duplicate asset ID");
      continue;
    }
    ids.add(asset.id);
    if (typeof asset.name !== "string" || asset.name.length > 200) {
      fail("Invalid asset name");
      continue;
    }
    const allowed =
      asset.type === "font"
        ? ["font/woff2", "font/woff", "font/ttf"]
        : asset.type === "image"
          ? [
              "image/png",
              "image/jpeg",
              "image/webp",
              "image/gif",
              "image/svg+xml",
            ]
          : [];
    if (
      !allowed.includes(asset.mime) ||
      typeof asset.data !== "string" ||
      asset.data.length > 524288
    ) {
      fail("Unsupported asset or size exceeds 512 KB");
      continue;
    }
    size += asset.data.length;
    const prefix = `data:${asset.mime};base64,`,
      data = asset.data.slice(prefix.length);
    if (
      !asset.data.startsWith(prefix) ||
      !data ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        data,
      )
    ) {
      fail("Asset must be a local base64 data URL");
      continue;
    }
    const raw = atob(data),
      magic = raw.slice(0, 4);
    if (asset.mime === "image/svg+xml")
      try {
        assertSafeSvg(
          new TextDecoder().decode(
            Uint8Array.from(raw, (c) => c.charCodeAt(0)),
          ),
        );
      } catch (e) {
        fail(e.message);
      }
    if (
      (asset.mime === "image/png" && raw.slice(0, 8) !== "\x89PNG\r\n\x1a\n") ||
      (asset.mime === "image/jpeg" && raw.slice(0, 3) !== "\xff\xd8\xff") ||
      (asset.mime === "image/gif" && !/^GIF8[79]a/.test(raw)) ||
      (asset.mime === "image/webp" &&
        (magic !== "RIFF" || raw.slice(8, 12) !== "WEBP")) ||
      (asset.mime === "font/woff2" && magic !== "wOF2") ||
      (asset.mime === "font/woff" && magic !== "wOFF") ||
      (asset.mime === "font/ttf" && magic !== "\x00\x01\x00\x00")
    )
      fail("Asset MIME signature does not match");
  }
  if (size > 1048576) fail("Combined assets exceed 1 MB");
  return issues;
}
