#!/usr/bin/env node
import { flattenNodes } from "../src/tree.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  newProject,
  clone,
  validateProject,
  auditProject,
  standaloneHtml,
  exportIndexHtml,
  applyPatch,
  hashProject,
} from "../src/core.mjs";
const [cmd, src, arg3, arg4, arg5] = process.argv.slice(2);
const help = () => {
  console.log(`DesignForge CLI · project protocol v1
  node tools/forge.mjs validate <project.json>
  node tools/forge.mjs audit <project.json>
  node tools/forge.mjs export <project.json> <output-dir>
  node tools/forge.mjs apply <project.json> <patch.json> --out <revised.json>
  node tools/forge.mjs init <output.json>

Patches contain format=designforge.patch, version=1, baseHash=<current hash>, ops=[...].`);
};
const PROJECT_BUDGET = 8 * 1024 * 1024;
const PATCH_BUDGET = 1024 * 1024;
async function loadJSON(file, limit, label) {
  const handle = await fs.open(file, "r");
  const overBudget = () =>
    Error(`${label} budget exceeded (${limit / 1024 / 1024} MB maximum)`);
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw Error(`${label} must be a regular JSON file`);
    if (info.size > limit) throw overBudget();
    // A fixed upper bound still applies if the file grows after the size check.
    const buffer = Buffer.allocUnsafe(limit + 1);
    let length = 0;
    while (length <= limit) {
      const { bytesRead } = await handle.read(
        buffer,
        length,
        Math.min(65536, limit + 1 - length),
        null,
      );
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > limit) throw overBudget();
    return JSON.parse(buffer.subarray(0, length).toString("utf8"));
  } finally {
    await handle.close();
  }
}
async function main() {
  if (!cmd || cmd === "help" || cmd === "--help") {
    help();
    return;
  }
  if (!src) throw Error("Missing file path");
  if (cmd === "init") {
    const p = newProject("My Design Project");
    p.boards = [
      {
        id: "board1",
        name: "Desktop",
        x: 0,
        y: 60,
        w: 1280,
        h: 800,
        bg: "#FFFFFF",
        nodes: [],
      },
    ];
    await fs.mkdir(path.dirname(path.resolve(src)), { recursive: true });
    await fs.writeFile(src, JSON.stringify(p, null, 2) + "\n", { flag: "wx" });
    console.log("Created:", path.resolve(src));
    return;
  }
  const project = await loadJSON(src, PROJECT_BUDGET, "Project");
  const issues = validateProject(project);
  if (issues.length) {
    console.error("Project validation FAILED:");
    issues.forEach((i) => console.error(`  ${i.path}: ${i.reason}`));
    process.exitCode = 1;
    return;
  }
  if (cmd === "validate") {
    console.log(
      `VALID • ${project.title} • ${project.boards.length} boards • ${project.boards.reduce((n, b) => n + flattenNodes(b.nodes).length, 0)} nodes • hash ${hashProject(project)}`,
    );
    return;
  }
  if (cmd === "audit") {
    const findings = auditProject(project);
    console.log(
      JSON.stringify(
        { project: project.title, hash: hashProject(project), findings },
        null,
        2,
      ),
    );
    return;
  }
  if (cmd === "export") {
    if (!arg3) throw Error("export requires output directory");
    const dir = path.resolve(arg3);
    await fs.mkdir(dir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(dir, "index.html"), exportIndexHtml(project)),
      fs.writeFile(
        path.join(dir, "designforge.project.json"),
        JSON.stringify(project, null, 2) + "\n",
      ),
      fs.writeFile(
        path.join(dir, "audit.json"),
        JSON.stringify(auditProject(project), null, 2),
      ),
      ...project.boards.map((b, i) =>
        fs.writeFile(
          path.join(dir, `board-${i + 1}.html`),
          standaloneHtml(b, project),
        ),
      ),
    ]);
    console.log(
      `EXPORTED ${project.boards.length} standalone artboards into ${dir}`,
    );
    return;
  }
  if (cmd === "apply") {
    if (!arg3) throw Error("apply requires patch file");
    if (arg4 !== "--out" || !arg5)
      throw Error(
        "apply must specify --out <new-file.json>; original not overwritten",
      );
    const patch = await loadJSON(arg3, PATCH_BUDGET, "Patch");
    const revised = applyPatch(project, patch);
    await fs.mkdir(path.dirname(path.resolve(arg5)), { recursive: true });
    await fs.writeFile(arg5, JSON.stringify(revised, null, 2) + "\n", {
      flag: "wx",
    });
    console.log(
      `PATCH APPLIED • ${patch.ops.length} ops • original ${hashProject(project)} → ${hashProject(revised)} • ${arg5}`,
    );
    return;
  }
  throw Error("Unknown command: " + cmd);
}
main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
});
