import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile),
  cli = new URL("../tools/forge.mjs", import.meta.url).pathname;
test("CLI apply refuses overwriting original, existing files and symlink aliases", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "designforge-cli-"));
  try {
    const original = await fs.readFile(
        new URL("../examples/Orbit.project.json", import.meta.url),
        "utf8",
      ),
      src = path.join(dir, "source.json"),
      patch = path.join(dir, "patch.json");
    await fs.writeFile(src, original);
    await fs.copyFile(
      new URL("../examples/Rename-revenue.patch.json", import.meta.url),
      patch,
    );
    await assert.rejects(
      () => exec(process.execPath, [cli, "apply", src, patch, "--out", src]),
      /EEXIST/,
    );
    assert.equal(await fs.readFile(src, "utf8"), original);
    const alias = path.join(dir, "alias.json");
    await fs.symlink(src, alias);
    await assert.rejects(
      () => exec(process.execPath, [cli, "apply", src, patch, "--out", alias]),
      /EEXIST/,
    );
    const dest = path.join(dir, "revised.json");
    await exec(process.execPath, [cli, "apply", src, patch, "--out", dest]);
    await exec(process.execPath, [cli, "validate", dest]);
    assert.equal(await fs.readFile(src, "utf8"), original);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("CLI rejects project/patch byte budgets before creating outputs and preserves sources", async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "designforge-cli-budget-"),
  );
  try {
    const src = path.join(dir, "source.json"),
      bigProject = path.join(dir, "big-project.json"),
      bigPatch = path.join(dir, "big-patch.json"),
      dest = path.join(dir, "revised.json"),
      exportDir = path.join(dir, "exported");
    const original = await fs.readFile(
      new URL("../examples/Orbit.project.json", import.meta.url),
    );
    await fs.writeFile(src, original);
    await fs.writeFile(bigProject, "{");
    await fs.truncate(bigProject, 8 * 1024 * 1024 + 1);
    await fs.writeFile(bigPatch, "{");
    await fs.truncate(bigPatch, 1024 * 1024 + 1);
    await assert.rejects(
      () => exec(process.execPath, [cli, "validate", bigProject]),
      /Project budget exceeded \(8 MB maximum\)/,
    );
    await assert.rejects(
      () => exec(process.execPath, [cli, "export", bigProject, exportDir]),
      /Project budget exceeded/,
    );
    await assert.rejects(() => fs.stat(exportDir), { code: "ENOENT" });
    await assert.rejects(
      () =>
        exec(process.execPath, [cli, "apply", src, bigPatch, "--out", dest]),
      /Patch budget exceeded \(1 MB maximum\)/,
    );
    await assert.rejects(() => fs.stat(dest), { code: "ENOENT" });
    assert.deepEqual(await fs.readFile(src), original);
    assert.equal((await fs.stat(bigProject)).size, 8 * 1024 * 1024 + 1);
    assert.equal(
      (await fs.readFile(bigProject)).subarray(0, 1).toString(),
      "{",
    );
    assert.equal((await fs.stat(bigPatch)).size, 1024 * 1024 + 1);
    assert.equal((await fs.readFile(bigPatch)).subarray(0, 1).toString(), "{");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("CLI init exclusively creates a new file and refuses replacing existing bytes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "designforge-cli-init-"));
  try {
    const file = path.join(dir, "project.json"),
      original = Buffer.from("user project bytes\n");
    await fs.writeFile(file, original);
    await assert.rejects(
      () => exec(process.execPath, [cli, "init", file]),
      /EEXIST/,
    );
    assert.deepEqual(await fs.readFile(file), original);
    const fresh = path.join(dir, "nested", "fresh.json");
    await exec(process.execPath, [cli, "init", fresh]);
    await exec(process.execPath, [cli, "validate", fresh]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
