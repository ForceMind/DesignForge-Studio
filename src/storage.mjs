import { validateProject, hashProject } from "./core.mjs";
export const PROJECT_KEY = "designforge.project.v1";
export const BACKUP_KEY = "designforge.backups.v1";
export const RECOVERY_KEY = "designforge.rejected.v1";
export function readBackups(storage) {
  try {
    const items = JSON.parse(storage.getItem(BACKUP_KEY) || "[]");
    return Array.isArray(items)
      ? items
          .filter((e) => e?.project && validateProject(e.project).length === 0)
          .slice(-8)
      : [];
  } catch {
    return [];
  }
}
export function loadProject(storage) {
  try {
    const p = JSON.parse(storage.getItem(PROJECT_KEY));
    if (validateProject(p).length === 0)
      return { project: p, recovered: false };
  } catch {}
  const backups = readBackups(storage);
  return backups.length
    ? { project: backups.at(-1).project, recovered: true }
    : null;
}
export function saveProject(storage, project) {
  if (validateProject(project).length)
    throw Error("Invalid project cannot be saved");
  const previous = storage.getItem(PROJECT_KEY),
    backups = readBackups(storage);
  if (previous) {
    let parsed = null;
    try {
      parsed = JSON.parse(previous);
    } catch {}
    if (parsed && !validateProject(parsed).length) {
      if (
        hashProject(parsed) !== hashProject(project) &&
        backups.at(-1)?.hash !== hashProject(parsed)
      )
        backups.push({
          hash: hashProject(parsed),
          savedAt: new Date().toISOString(),
          project: parsed,
        });
    } else {
      // A stricter future reader or damaged JSON must not erase the original bytes.
      // Do not catch quota errors here: if preservation fails, leave current untouched.
      storage.setItem(RECOVERY_KEY, previous);
    }
  }
  // Preserve the current project if backup storage is full. Never clear data to make room.
  while (backups.length && JSON.stringify(backups).length > 750000)
    backups.shift();
  storage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(-8)));
  storage.setItem(PROJECT_KEY, JSON.stringify(project));
}
