import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PROJECT_KEY,
  BACKUP_KEY,
  saveProject,
  loadProject,
  readBackups,
} from "../src/storage.mjs";
const project = () =>
  JSON.parse(
    fs.readFileSync(
      new URL("../examples/Studio.project.json", import.meta.url),
    ),
  );
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) || null, setItem: (k, v) => m.set(k, v) };
};
test("save, reopen and restore damaged current file from last valid backup", () => {
  const s = memory(),
    p = project();
  saveProject(s, p);
  p.title = "Second";
  saveProject(s, p);
  assert.equal(loadProject(s).project.title, "Second");
  s.setItem(PROJECT_KEY, "{broken");
  const recovered = loadProject(s);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.project.title, "Studio — Responsive workspace");
});
test("backup ring is bounded, deduplicated and invalid input never overwrites current", () => {
  const s = memory(),
    p = project();
  for (let i = 0; i < 12; i++) {
    p.title = "Revision " + i;
    saveProject(s, p);
  }
  saveProject(s, p);
  assert.equal(readBackups(s).length, 8);
  const before = s.getItem(PROJECT_KEY);
  p.boards = [];
  assert.throws(() => saveProject(s, p), /Invalid/);
  assert.equal(s.getItem(PROJECT_KEY), before);
});
test("quota errors preserve stored current project and surface to caller", () => {
  const s = memory(),
    p = project();
  saveProject(s, p);
  const before = s.getItem(PROJECT_KEY);
  s.setItem = () => {
    throw Error("QuotaExceeded");
  };
  p.title = "Changed";
  assert.throws(() => saveProject(s, p), /Quota/);
  assert.equal(s.getItem(PROJECT_KEY), before);
});
test("malformed backups are ignored, current valid project still loads", () => {
  const s = memory(),
    p = project();
  saveProject(s, p);
  s.setItem(BACKUP_KEY, "null");
  assert.deepEqual(readBackups(s), []);
  assert.equal(loadProject(s).recovered, false);
});
