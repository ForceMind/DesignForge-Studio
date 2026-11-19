import {
  clone,
  validateProject,
  validId,
  effectiveTokens,
  resolveToken,
  escapeHtml,
} from "./core.mjs";
import { flattenNodes, locateNode, isNodeLocked } from "./tree.mjs";

/** Declared instances only; projected source IDs never become editable node IDs. */
export function componentUsages(project, componentId, variantId) {
  return project.boards.flatMap((board) =>
    flattenNodes(board.nodes)
      .filter(
        ({ node }) =>
          node.type === "instance" &&
          node.componentId === componentId &&
          (variantId === undefined || node.variantId === variantId),
      )
      .map(({ node }) => ({
        boardId: board.id,
        nodeId: node.id,
        variantId: node.variantId,
      })),
  );
}
function checked(project) {
  const issues = validateProject(project);
  if (issues.length)
    throw Error(
      issues
        .slice(0, 2)
        .map((i) => `${i.path}: ${i.reason}`)
        .join("; "),
    );
  return project;
}
function displayName(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw Error("名称须为1–200个字符");
  return value.trim();
}
function targetId(id, existing) {
  if (!validId(id) || existing.some((v) => v.id === id))
    throw Error("新ID不合法或已存在");
  return id;
}
const hasLockedSources = (variant) =>
  flattenNodes([variant.root]).some(({ node }) => node.locked);

/** Atomic local authoring operations. This is not an extension of the Agent Patch protocol. */
export function changeComponentLibrary(project, command) {
  checked(project);
  if (
    !command ||
    ![
      "rename-component",
      "duplicate-component",
      "remove-component",
      "rename-variant",
      "duplicate-variant",
      "remove-variant",
      "copy-source",
      "set-source",
    ].includes(command.kind)
  )
    throw Error("未知组件操作");
  const next = clone(project),
    component = next.components?.find((c) => c.id === command.componentId);
  if (!component) throw Error("组件已不存在");
  const variant = component.variants.find((v) => v.id === command.variantId);
  const needsVariant = [
    "rename-variant",
    "duplicate-variant",
    "remove-variant",
    "copy-source",
    "set-source",
  ].includes(command.kind);
  if (needsVariant && !variant) throw Error("变体已不存在");
  switch (command.kind) {
    case "rename-component":
      component.name = displayName(command.name);
      break;
    case "rename-variant":
      variant.name = displayName(command.name);
      break;
    case "duplicate-component":
      next.components.push({
        ...clone(component),
        id: targetId(command.targetId, next.components),
        name: displayName(command.name),
      });
      break;
    case "duplicate-variant":
      component.variants.push({
        ...clone(variant),
        id: targetId(command.targetId, component.variants),
        name: displayName(command.name),
      });
      break;
    case "remove-component":
      if (componentUsages(next, component.id).length)
        throw Error("组件仍被实例引用，请先切换变体或解除关联");
      if (component.variants.some(hasLockedSources))
        throw Error("组件包含锁定源图层，请先解锁源图层");
      next.components = next.components.filter((c) => c.id !== component.id);
      break;
    case "remove-variant":
      if (component.variants.length === 1) throw Error("至少保留一个变体");
      if (componentUsages(next, component.id, variant.id).length)
        throw Error("变体仍被实例引用，请先切换变体或解除关联");
      if (hasLockedSources(variant))
        throw Error("变体包含锁定源图层，请先解锁源图层");
      component.variants = component.variants.filter(
        (v) => v.id !== variant.id,
      );
      break;
    case "copy-source": {
      targetId(command.targetId, next.boards);
      const root = clone(variant.root),
        tokens = effectiveTokens(next);
      root.x = 0;
      root.y = 0;
      next.boards.push({
        id: command.targetId,
        name: `${component.name} / ${variant.name || variant.id} · 源副本`,
        x: Math.max(0, ...next.boards.map((b) => b.x + b.w)) + 120,
        y: 60,
        w: Math.max(280, Math.min(2400, root.w)),
        h: Math.max(280, Math.min(3200, root.h)),
        bg: resolveToken(tokens.surface, tokens),
        nodes: [root],
      });
      break;
    }
    case "set-source": {
      const board = next.boards.find((b) => b.id === command.boardId),
        node = board && locateNode(board, command.nodeId)?.node;
      if (!node || node.type === "instance")
        throw Error("请选中源图层，实例需先解除关联");
      if (command.requireIdentity && node.id !== variant.root.id)
        throw Error("请选中该变体源副本的根图层");
      if (isNodeLocked(board, node.id)) throw Error("源容器或其父级已锁定");
      variant.root = clone(node);
      // Validation rejects dangling overrides, missing assets, nesting and scene amplification.
      break;
    }
  }
  return checked(next);
}

export function componentLibraryMarkup(
  project,
  { sourceReady = false, sourceId = null, openComponents = new Set() } = {},
) {
  const esc = escapeHtml,
    usage = new Map();
  for (const board of project.boards)
    for (const { node } of flattenNodes(board.nodes)) {
      if (node.type !== "instance") continue;
      if (!usage.has(node.componentId)) usage.set(node.componentId, new Map());
      const counts = usage.get(node.componentId);
      counts.set(node.variantId, (counts.get(node.variantId) || 0) + 1);
    }
  return (
    (project.components || [])
      .map((component) => {
        const counts = usage.get(component.id) || new Map(),
          total = [...counts.values()].reduce((a, b) => a + b, 0);
        const button = (kind, label, variantId, reason = "") =>
          `<button class="btn-small" data-component-action="${kind}" data-component-id="${esc(component.id)}" ${variantId === undefined ? "" : `data-variant="${esc(variantId)}"`} ${reason ? `disabled title="${esc(reason)}"` : ""}>${label}</button>`;
        return `<div class="library-card" data-component-card="${esc(component.id)}"><b>◇ ${esc(component.name)}</b>${component.variants.map((v) => `<button class="btn-small" data-insert-component="${esc(component.id)}" data-variant="${esc(v.id)}">＋ ${esc(v.name || v.id)}</button>`).join("")}<details class="component-manager" data-component-manager="${esc(component.id)}" ${openComponents.has(component.id) ? "open" : ""}><summary>管理组件 · ${total} 个实例</summary><div class="button-row">${button("rename-component", "重命名")}${button("duplicate-component", "复制组件")}${button("remove-component", "删除组件", undefined, total ? "仍有实例引用" : component.variants.some(hasLockedSources) ? "包含锁定源图层" : "")}</div><p class="property-help">源副本是普通画板，随工程保存和导出。编辑完成后选中源图层，更新对应变体；副本可按需删除。已有实例的自定义内容继续保留。</p>${component.variants
          .map((v) => {
            const count = counts.get(v.id) || 0;
            const reason =
              component.variants.length === 1
                ? "至少保留一个变体"
                : count
                  ? "仍有实例引用"
                  : hasLockedSources(v)
                    ? "包含锁定源图层"
                    : "";
            return `<section class="component-variant" data-component-variant="${esc(v.id)}"><div><strong>${esc(v.name || v.id)}</strong><small>${count} 个实例</small></div><div class="component-variant-actions">${button("rename-variant", "重命名", v.id)}${button("duplicate-variant", "复制变体", v.id)}${button("copy-source", "创建源副本", v.id)}<button class="btn-small" data-update-variant="${esc(component.id)}" data-variant="${esc(v.id)}" ${sourceReady && sourceId === v.root.id ? "" : 'disabled title="先选中该变体源副本的根图层"'}>更新此变体</button>${button("remove-variant", "删除变体", v.id, reason)}</div></section>`;
          })
          .join(
            "",
          )}</details><button class="btn-small" data-update-component="${esc(component.id)}">用当前容器更新变体</button></div>`;
      })
      .join("") ||
    '<p class="property-help">选择容器并创建组件，即可插入关联实例。</p>'
  );
}
