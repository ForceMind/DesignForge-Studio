import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  changeComponentLibrary as change,
  componentUsages,
} from "../src/component-library.mjs";
import {
  materializeInstance,
  validateProject,
  standaloneHtml,
} from "../src/core.mjs";
import {
  exportDesignLibrary,
  importDesignLibrary,
} from "../src/design-library.mjs";
const fixture = JSON.parse(
  fs.readFileSync(new URL("../examples/Studio.project.json", import.meta.url)),
);
function project() {
  const p = structuredClone(fixture);
  const node = (id, type, text = "") => ({
    id,
    name: id,
    type,
    x: 0,
    y: 0,
    w: 200,
    h: 50,
    text,
    style: {},
  });
  p.components = [
    {
      id: "control",
      name: "Control",
      variants: [
        {
          id: "base",
          name: "Base",
          root: {
            ...node("sourceRoot", "frame"),
            w: 300,
            h: 140,
            children: [
              node("sourceTitle", "text", "Inherited title"),
              {
                ...node("sourceSubtitle", "text", "Inherited subtitle"),
                y: 60,
              },
            ],
          },
        },
      ],
    },
  ];
  p.boards = [
    {
      id: "work",
      name: "Work",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          ...node("instance", "instance"),
          w: 300,
          h: 140,
          componentId: "control",
          variantId: "base",
          overrides: { sourceTitle: { text: "Manual content" } },
        },
      ],
    },
  ];
  p.comments = [];
  assert.deepEqual(validateProject(p), []);
  return p;
}
const command = (kind, extra = {}) => ({
  kind,
  componentId: "control",
  variantId: "base",
  ...extra,
});
test("component and variant renaming keeps IDs, instances and manual names unchanged", () => {
  const p = project(),
    before = structuredClone(p);
  const next = change(
    change(p, command("rename-component", { name: " Renamed control " })),
    command("rename-variant", { name: "Regular" }),
  );
  assert.equal(next.components[0].name, "Renamed control");
  assert.equal(next.components[0].variants[0].name, "Regular");
  assert.deepEqual(next.boards, before.boards);
  assert.deepEqual(p, before);
});
test("duplicating a variant preserves source IDs, rich content and references without sharing mutable nodes", () => {
  const p = project();
  const next = change(
    p,
    command("duplicate-variant", { targetId: "secondary", name: "Secondary" }),
  );
  assert.deepEqual(
    next.components[0].variants[1].root,
    p.components[0].variants[0].root,
  );
  next.components[0].variants[1].root.children[0].text = "Only this variant";
  assert.equal(
    next.components[0].variants[0].root.children[0].text,
    "Inherited title",
  );
  assert.deepEqual(p.boards, next.boards);
  assert.equal(componentUsages(next, "control", "secondary").length, 0);
});
test("duplicate components retain variant/source identity in their own namespace and export as a valid local library", () => {
  const p = change(
    project(),
    command("duplicate-component", {
      targetId: "anotherControl",
      name: "Another",
    }),
  );
  assert.deepEqual(p.components[1].variants, p.components[0].variants);
  const bundle = exportDesignLibrary(p, "Variant collection");
  const target = project();
  target.components = [];
  target.boards[0].nodes = [];
  assert.deepEqual(
    importDesignLibrary(target, bundle).components,
    p.components,
  );
});
test("usage checks find nested and locked instances on every board and reject referenced deletion atomically", () => {
  const p = project(),
    original = p.boards[0].nodes[0];
  p.boards.push({
    ...structuredClone(p.boards[0]),
    id: "another",
    nodes: [
      {
        id: "container",
        name: "Parent",
        type: "frame",
        x: 0,
        y: 0,
        w: 400,
        h: 300,
        text: "",
        style: {},
        locked: true,
        children: [structuredClone(original)],
      },
    ],
  });
  const before = structuredClone(p),
    withExtra = change(
      p,
      command("duplicate-variant", { targetId: "extra", name: "Extra" }),
    );
  assert.equal(componentUsages(p, "control", "base").length, 2);
  assert.throws(
    () => change(withExtra, command("remove-variant")),
    /仍被实例引用/,
  );
  assert.throws(() => change(p, command("remove-component")), /仍被实例引用/);
  assert.deepEqual(p, before);
});
test("unused deletion preserves at least one variant and refuses locked sources", () => {
  const p = change(
    project(),
    command("duplicate-variant", { targetId: "extra", name: "Extra" }),
  );
  p.components[0].variants[1].root.children[0].locked = true;
  assert.throws(
    () => change(p, command("remove-variant", { variantId: "extra" })),
    /锁定/,
  );
  delete p.components[0].variants[1].root.children[0].locked;
  const next = change(p, command("remove-variant", { variantId: "extra" }));
  assert.equal(next.components[0].variants.length, 1);
  assert.throws(() => change(next, command("remove-variant")), /至少保留/);
  next.boards[0].nodes = [];
  assert.deepEqual(change(next, command("remove-component")).components, []);
});
test("source board editing preserves source IDs so updating the exact variant retains instance overrides", () => {
  const original = project(),
    copied = change(
      original,
      command("copy-source", { targetId: "sourceWork" }),
    );
  const root = copied.boards[1].nodes[0];
  assert.equal(root.id, "sourceRoot");
  root.children[1].text = "New source subtitle";
  const next = change(
    copied,
    command("set-source", { boardId: "sourceWork", nodeId: root.id }),
  );
  const resolved = materializeInstance(next.boards[0].nodes[0], next);
  assert.equal(resolved.children[0].text, "Manual content");
  assert.equal(resolved.children[1].text, "New source subtitle");
  assert.deepEqual(next.boards[0], original.boards[0]);
  assert.equal(
    original.components[0].variants[0].root.children[1].text,
    "Inherited subtitle",
  );
});
test("source updates that would orphan overrides, add nested instances or exceed the board budget are rejected without removing content", () => {
  const p = change(
    project(),
    command("copy-source", { targetId: "sourceWork" }),
  );
  p.boards[1].nodes[0].children.shift();
  const before = structuredClone(p);
  assert.throws(
    () =>
      change(
        p,
        command("set-source", { boardId: "sourceWork", nodeId: "sourceRoot" }),
      ),
    /override/i,
  );
  assert.deepEqual(p, before);
  const valid = change(
    project(),
    command("copy-source", { targetId: "sourceWork" }),
  );
  valid.boards[1].nodes[0].children.push({
    ...structuredClone(valid.boards[0].nodes[0]),
    id: "nested",
  });
  assert.throws(
    () =>
      change(
        valid,
        command("set-source", { boardId: "sourceWork", nodeId: "sourceRoot" }),
      ),
    /cannot contain instances/,
  );
  const full = project();
  full.boards = Array.from({ length: 24 }, (_, i) => ({
    ...structuredClone(full.boards[0]),
    id: `board${i}`,
  }));
  assert.throws(
    () => change(full, command("copy-source", { targetId: "tooMany" })),
    /1–24/,
  );
  assert.equal(full.boards.length, 24);
});
test("invalid names, duplicate IDs and missing definitions never change the caller's project", () => {
  const p = project(),
    before = structuredClone(p);
  for (const name of ["", " ", null, "a".repeat(201)])
    assert.throws(() => change(p, command("rename-variant", { name })), /名称/);
  for (const targetId of ["base", "<script>", "1bad"])
    assert.throws(
      () => change(p, command("duplicate-variant", { targetId, name: "Copy" })),
      /ID/,
    );
  assert.throws(
    () =>
      change(
        p,
        command("rename-variant", { variantId: "absent", name: "Name" }),
      ),
    /变体已不存在/,
  );
  assert.deepEqual(p, before);
});
test("bound source updates reject an unrelated selected descendant and leave both definitions and instances intact", () => {
  const p = change(
      project(),
      command("copy-source", { targetId: "sourceWork" }),
    ),
    before = structuredClone(p);
  assert.throws(
    () =>
      change(
        p,
        command("set-source", {
          boardId: "sourceWork",
          nodeId: "sourceSubtitle",
          requireIdentity: true,
        }),
      ),
    /根图层/,
  );
  assert.deepEqual(p, before);
});
test("valid leaf component roots can be copied, edited and updated without forcing a container conversion", () => {
  const p = project(),
    root = p.components[0].variants[0].root;
  delete root.children;
  root.type = "button";
  root.text = "Continue";
  p.boards[0].nodes[0].overrides = {};
  const copy = change(p, command("copy-source", { targetId: "buttonSource" }));
  copy.boards[1].nodes[0].text = "Proceed";
  const next = change(
    copy,
    command("set-source", {
      boardId: "buttonSource",
      nodeId: "sourceRoot",
      requireIdentity: true,
    }),
  );
  assert.equal(next.components[0].variants[0].root.type, "button");
  assert.equal(next.components[0].variants[0].root.text, "Proceed");
  assert.equal(p.components[0].variants[0].root.text, "Continue");
  assert.match(standaloneHtml(next.boards[0], next), />Proceed<\/button>/);
});
