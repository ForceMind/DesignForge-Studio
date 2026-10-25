import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateProject, applyPatch, hashProject } from "../src/core.mjs";
const base = JSON.parse(
  fs.readFileSync(
    new URL("../examples/Orbit.project.json", import.meta.url),
    "utf8",
  ),
);
test("runtime selector/source/reference fields cannot be smuggled through public project nodes or boards", () => {
  for (const field of ["$sourceId", "$referenceSize", "$selector"])
    for (const owner of ["node", "board"]) {
      const p = structuredClone(base),
        target = owner === "node" ? p.boards[0].nodes[0] : p.boards[0];
      target[field] = field === "$referenceSize" ? { w: 1, h: 1 } : "forged";
      const before = JSON.stringify(p);
      assert.ok(
        validateProject(p).some(
          (i) => i.path.endsWith(field) && i.reason.includes("Reserved"),
        ),
      );
      assert.equal(JSON.stringify(p), before);
    }
});
test("a forged add-node rejects preceding legitimate changes atomically and preserves custom non-runtime metadata", () => {
  const p = structuredClone(base),
    b = p.boards[0],
    original = hashProject(p);
  const node = {
    id: "forged",
    type: "rect",
    x: 10,
    y: 10,
    w: 80,
    h: 80,
    text: "",
    style: {},
    $sourceId: "hiddenCanvasNode",
  };
  assert.throws(
    () =>
      applyPatch(p, {
        format: "designforge.patch",
        version: 1,
        baseHash: original,
        ops: [
          {
            kind: "set-node",
            boardId: b.id,
            nodeId: b.nodes[0].id,
            changes: { name: "Legitimate rename" },
          },
          { kind: "add-node", boardId: b.id, node },
        ],
      }),
    /Reserved/,
  );
  assert.equal(hashProject(p), original);
  b.nodes[0].customMetadata = { note: "Preserve this extension" };
  assert.deepEqual(validateProject(p), []);
  assert.equal(b.nodes[0].customMetadata.note, "Preserve this extension");
});
test("malformed variant display names reject before they reach component selectors", () => {
  const p = structuredClone(base);
  p.components = [
    {
      id: "card",
      name: "Card",
      variants: [
        {
          id: "base",
          name: { toString: "not callable" },
          root: {
            id: "root",
            type: "component",
            x: 0,
            y: 0,
            w: 100,
            h: 100,
            text: "",
            style: {},
            children: [],
          },
        },
      ],
    },
  ];
  assert.ok(validateProject(p).some((i) => i.path.endsWith(".name")));
  p.components[0].variants[0].name = "Safe name";
  assert.deepEqual(validateProject(p), []);
  p.components[0].variants[0].root.$sourceId = "forged";
  assert.ok(validateProject(p).some((i) => i.path.endsWith("$sourceId")));
});
