# DesignForge Studio — Work 会话接管资料

更新日期：2026-10-23，工程状态：v0.1 / M0 验证版。

## 仓库与现状

- GitHub：<https://github.com/ForceMind/DesignForge-Studio>
- 默认分支：`main`。仓库为 Public；M0 源码采用 `LICENSE` 所列 MIT 许可。
- `npm start`：本地设计工作台（监听 `127.0.0.1:4173`，不自动部署）。
- `npm test`：16 项基础单元测试，在提交基线前全部通过。
- `npm run validate`：示例包含 3 块画板、170 个元素，静态结构通过。
- `npm run audit`：示例的静态审计发现数为 0（**不代表浏览器视觉和交互已验收**）。
- `npm run export`：离线导出示例 HTML、JSON 与审计结果，输出目录 `output/` 已被 `.gitignore` 排除。

## 优先阅读顺序

1. `README.md`：运行、功能、已知限制。
2. `docs/RESEARCH.md`：BaoCut/baoyu-design 研究与许可边界。
3. `docs/ARCHITECTURE.md`：AST、渲染、交互与本地持久化。
4. `docs/PATCH_PROTOCOL.md`：Agent 局部补丁的约束与审阅机制。
5. `docs/ROADMAP.md`：各阶段目标与验收。
6. `skills/designforge/SKILL.md`：Agent 改稿操作规范。

## 下一阶段目标（M1）

让 DesignForge 从可编辑的静态画板升级为工程可用的**组件树 + Auto Layout + 约束/断点 + 可靠的视觉验证**。优先推进：

1. React/Vue 等主流 UI 组件来源的层级结构；容器节点、嵌套布局、Auto Layout；清晰的迁移策略与向后兼容。
2. 设计系统的 Token alias、字体、组件/变体、共享组件实例，不丢失现有 JSON。
3. 元素选择与图层/属性面板双向映射，局部编辑、撤销重做、保存后回读，覆盖交互测试。
4. 真实浏览器的跨尺寸截图与视觉 QA、文字截断与碰撞、触控区域、色彩对比检查；审计不得虚构通过结果。
5. AI 修改生成严格受限的补丁，必须可预览差异、有基线哈希校验、默认人工确认；保留非目标节点。
6. 新增代表性 App、Web、游戏 HUD 示例，用自动测试与截图证明确有改进。

## 工作原则

- 任务要求实际改代码、跑测试、提交 GitHub。先读取**仓库当前状态**，以当前代码与 CI 为准，不把本文当作未来版本的实际进度。
- 新功能走开发分支及 PR，尽量保持 `main` 可运行。修 bug 不大拆稳定模块；先测试再改。
- 设计和用户文件不上传给未授权的外部模型；默认本地优先，用户数据属用户。
- BaoCut 使用受限的 Community License；只借鉴公开功能思路，不复制它的 Runtime、CSS、商标、逆向源码。`baoyu-design` 与 BaoCut 许可不同，引用第三方文件时应标记来源并保留许可。
- 不在 ChatGPT 平台自行部署网站，不在用户本机/macOS 操作，不擅自购买、订阅、发布版本。部署到用户服务器或 Cloudflare Pages 必须由用户明确要求。
- 不能把“代码已提交”说成“浏览器视觉已验收”。每次汇报必须区分实际验证、已知缺口与计划。
