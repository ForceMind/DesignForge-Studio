/** Original, minimal ZIP (STORE) writer for exporting small static projects offline. */
const encoder = new TextEncoder();
function crc32(bytes) {
  let n = 0xffffffff;
  for (const b of bytes) {
    n ^= b;
    for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  }
  return (n ^ 0xffffffff) >>> 0;
}
function le16(n) {
  return [n & 255, (n >>> 8) & 255];
}
function le32(n) {
  return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
}
export function zipFiles(entries) {
  const local = [],
    central = [];
  let offset = 0,
    count = 0;
  for (const [name, raw] of entries) {
    if (!name || name.includes("..") || name.startsWith("/"))
      throw Error("Unsafe archive entry");
    const fn = encoder.encode(name),
      body = typeof raw === "string" ? encoder.encode(raw) : raw;
    const crc = crc32(body);
    const size = body.length;
    const header = Uint8Array.from([
      ...le32(0x04034b50),
      ...le16(20),
      ...le16(0x800),
      ...le16(0),
      ...le16(0),
      ...le16(0),
      ...le32(crc),
      ...le32(size),
      ...le32(size),
      ...le16(fn.length),
      ...le16(0),
      ...fn,
    ]);
    local.push(header, body);
    const dir = Uint8Array.from([
      ...le32(0x02014b50),
      ...le16(20),
      ...le16(20),
      ...le16(0x800),
      ...le16(0),
      ...le16(0),
      ...le16(0),
      ...le32(crc),
      ...le32(size),
      ...le32(size),
      ...le16(fn.length),
      ...le16(0),
      ...le16(0),
      ...le16(0),
      ...le16(0),
      ...le32(0),
      ...le32(offset),
      ...fn,
    ]);
    central.push(dir);
    offset += header.length + body.length;
    count++;
  }
  const centralBytes = central.reduce((n, b) => n + b.length, 0);
  const end = Uint8Array.from([
    ...le32(0x06054b50),
    ...le16(0),
    ...le16(0),
    ...le16(count),
    ...le16(count),
    ...le32(centralBytes),
    ...le32(offset),
    ...le16(0),
  ]);
  return new Blob([...local, ...central, end], { type: "application/zip" });
}
