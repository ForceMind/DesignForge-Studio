# DesignForge Studio · 形界设计工作台

> **v0.1 / M0 验证版**。原创的本地优先、多画板设计编辑器，附带跨模型 Agent Skill、局部修改 Patch 协议与独立 CLI。

DesignForge 是对 BaoCut / baoyu-design 公开功能机制的独立工程实现，**没有复制 BaoCut 或 Claude Design 源码**。不是宝玉或 Anthropic 的官方产品；项目名暂定。

## 立即运行

安装 **Node.js 20+**，解压工程后执行：

```bash
npm start
```

浏览器打开 **http://127.0.0.1:4173/**。服务仅监听本机 `127.0.0.1`，无需 `npm install`、无需模型 API Key、没有云端依赖。

## 已交付功能

- 自由画布：缩放、平移、多画板；3 块内置演示画板，共 170 个可选择节点。
- 元素编辑：鼠标拖动、属性面板、颜色、文字、字号、位置和尺寸；新增图形/文本/按钮/图标；图层复制、排序、删除。
- Design Tokens：全局颜色、圆角与字体配置，节点可引用 `$primary`、`$ink` 等变量。
- 本地持久化、撤销/重做、项目 JSON 导入/导出、独立 HTML 页面和 ZIP 导出。
- 画板与节点批注：定位、解决、删除，可交接 AI 修订。
- 静态设计审计：文字大小、触控目标、元素越界、显式背景的对比度。
- Agent 交接：精准元素 ID、快照哈希、白名单局部 Patch、Diff 预览、**用户审批后**应用。
- CLI `init / validate / audit / export / apply`，基础安全与协议单元测试。

### 快捷键

`V` 选择，`H` / `Space` 平移，`Ctrl/Cmd + 滚轮` 缩放，`Ctrl/Cmd + Z` 撤销，`Ctrl/Cmd + Shift + Z` 重做，`Ctrl/Cmd + D` 复制，`Delete` 删除，方向键微移（按住 Shift 为 10px），双击文字编辑。

## 交给 AI 修改

1. 在编辑器选择画板 / 图层，切到右侧 **Agent** 并写设计要求。
2. 点击「复制 Agent 指令」，交给 Codex / Claude Code 等具有文件工具的模型，并提供项目 JSON。
3. 模型输出 `designforge.patch` 格式 JSON，必须带当前 `baseHash`。
4. 在编辑器「导入 + 审核补丁」，确认修改范围后应用；或用 CLI 验证并保存为新文件。

```bash
node tools/forge.mjs validate examples/Orbit.project.json
node tools/forge.mjs audit examples/Orbit.project.json
node tools/forge.mjs export examples/Orbit.project.json ./output
node tools/forge.mjs apply examples/Orbit.project.json change.patch.json --out revised.project.json
```

Agent Skill 位于 `skills/designforge/SKILL.md`，可将目录复制到支持 `SKILL.md` 的 Agent 配置位置（例如项目 `.agents/skills/designforge/`）。具体协议见 [docs/PATCH_PROTOCOL.md](docs/PATCH_PROTOCOL.md)。

## 工程结构

```text
index.html                    中文设计工作台
src/app.css, src/app.mjs      原创画布 UI 和编辑交互
src/core.mjs                 AST / 静态 HTML 渲染 / 校验 / 审计 / Patch / Diff
src/zip.mjs                  零依赖 ZIP 输出
examples/Orbit.project.json  三画板设计样例
tools/forge.mjs              项目 CLI
tools/serve.mjs              只监听本机的开发服务器
skills/designforge/SKILL.md  Agent Skill
tests/core.test.mjs          自动单元测试
docs/                        研究、架构、补丁协议、路线图
```

## 当前不包含什么

这是**可运行的第一版，而非已全面超过竞品的完成品**：暂不支持 AI 内建模型调用、富 HTML 编辑、Auto Layout、嵌套组件、设计系统版本同步、图片素材、Figma/现有代码导入、视频、PDF/PPTX、实时协作和精细的响应式代码导出。浏览器真实视觉回归测试也尚未完成（当前执行环境的 Chromium 管理策略限制打开测试页面）。

## 安全与数据归属

项目默认存于当前浏览器 `localStorage`；清理浏览器数据会丢失未手动导出的项目，建议定期保存 JSON。不会把内容上传云端。项目输入限制颜色、字体和节点类型，静态 HTML 逃逸用户文本；不执行导入的任意 JS。`baseHash` 是冲突检测，不是安全签名。要让外部模型修改商业设计稿，应自行决定可发送的数据范围。

版权：DesignForge 原创源码 MIT（`LICENSE`）。研究不意味着获得 BaoCut 受限 Community License 代码的再发布权；第三方许可和源链接见 [研究报告](docs/RESEARCH.md)。
