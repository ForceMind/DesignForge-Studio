# BaoCut / baoyu-design 技术研究及 DesignForge 差异路线

研究日期：2026-10-23；对象为公开仓库的可见源码、Skill 文档与 README，不代表对其线上产品的穷尽测试。本文区分“源码已验证事实”“合理工程推断”“本项目规划”。

## 1. 研究对象

1. `JimLiu/baoyu-design`：独立 Agent Skill：<https://github.com/JimLiu/baoyu-design>。其顶层 `SKILL.md` / `system-prompt.md` 提供设计指导、项目结构、交付与验证步骤，配有针对 Codex / Cursor / Claude Code 的参考文档；`built-in-skills/` 将移动端、高保真设计、交互原型、设计系统、导入、导出、演示等流程模块化。主设计产物通常为 HTML/CSS/JS 原型或面向领域的其他格式。
2. `JimLiu/baocut`：集成 Design（画板）与 Design System（品牌体系）的宿主应用：<https://github.com/JimLiu/baocut>。核心参考：
   - `skills/baocut/built-in-skills/design/SKILL.md`
   - `skills/baocut/built-in-skills/design-system/SKILL.md`
   - `packages/design-runtime/README.md`
   - `packages/design/src/canvas-check.ts`
   - `packages/design/src/canvas-layout.ts`
3. 此外 `packages/design-runtime/src/` 可见 canvas/editor/properties/geometry/preview/comments/export/design-system/fast-edit/collaboration 等模块。存在模块不能直接证明该模块在 BaoCut UI 中可用或在全部环境已启用。

## 2. 核心运作逻辑：不是单个提示词

```text
用户需求 / 既有品牌 / 参考信息
           ↓
Skill 规则：理解 → 选定风格与设计系统 → 排版 → 可编辑约束
           ↓
结构化设计文件 + 真实图片/字体资产
           ↓
静态格式校验（design_check）
           ↓
宿主设计编辑器：选择、拖动、属性编辑、标注、预览
           ↓
将标注 / 选区交给 Agent → 精准修改 → 再校验 → 导出
```

**BaoCut 的画板存储不是图片快照。** `canvas.json` v3 定义 board 的位置、尺寸、顺序、页面、附注及已安装设计系统；每个画板对应独立的 `.dc.html` 完整源文件，通过受约束的 `<x-dc>` 和脚本拓展实现可编辑属性、组件组合或交互。Design System 可以把 tokens、字体、品牌资源与组件绑定到设计稿。

**验证和渲染是两层问题。** `design_check` 检查文件引用、尺寸范围、HTML 标记、脚本规则、资产等静态结构，不验证真实视觉布局、交互正常与视觉审美。实际预览由独立运行时完成。源 `packages/design-runtime/README.md` 还说明其 TS runtime 是对原有 Claude Design 类型运行时的高度忠实重建；不应将其等同于普通的 MIT 源码库。

**独立 `baoyu-design` 与 BaoCut 内置流程应分开看。** 前者更像跨 Agent 的设计方法与脚手架；后者额外包含宿主编辑器、文件协议和标注回流。二者不是同一套 UI。

## 3. 工程优劣与产品机会

| 维度 | 研究对象已公开的机制 | DesignForge v0.1 | 希望超越的方向 |
|---|---|---|---|
| 结构化设计 | `canvas.json` + `.dc.html` / HTML 原型 | 自研 `designforge.project` JSON AST | 扩展为版本化组件树、自动布局 |
| 视觉编辑 | BaoCut 的完整画板运行时 | 多画板、层级、拖动、属性编辑 | 跨断点、组件实例、约束编辑 |
| Agent 改稿 | Skill + 文件/标注交接 | 带 baseHash 的 `designforge.patch`，应用前 Diff 审批 | 可视化局部 Agent 编辑、改稿合并、冲突处理 |
| 一致性 | Design System tokens / bundle | 基础颜色和排版 tokens | 多品牌、token alias、组件版本迁移 |
| 质量验收 | 静态 `design_check` | 结构检查 + 初级无障碍/溢出审计 | 浏览器实测、截图差异、交互审计 |
| 本地数据 | BaoCut 的目录/宿主机制 | 浏览器 localStorage + 项目 JSON | 本地文件持久化与 Git 原生提交 |
| 导出 | BaoCut 编辑器多类导出 | HTML、ZIP、JSON | React/Vue/Figma、真实响应式代码 |
| 模型接入 | 各自 Agent 宿主 | 外部 Agent 生成 Patch 后导入 | 用户自有 API Key、本地模型、限权工具运行 |

**不是说 v0.1 已经超越 BaoCut 全部功能。** 现在领先的研究假设是“变更粒度、可审计和人工审批”能减少 AI 改坏已有设计的风险；还没有做基准测试证明优于 BaoCut。相比成熟画板系统，当前在富文本、图片、Auto Layout、组件系统、多人协作、外部导入方面差距明显。

## 4. 许可与独立实现边界

- `JimLiu/baoyu-design` 使用 MIT License；未来若确有需要，允许按其许可条款使用它的文件，但须保留原始版权与许可。
- `JimLiu/baocut` 的根许可证是非标准的 **BaoCut Community License**。源码可见 **不等于** 可将整个编辑器或对 Claude Design 的逆向重建代码直接复制到独立商业软件。本项目没有拷贝其中的 runtime、CSS、协议文件或商标视觉资源，而是实现新的 JSON AST、渲染、CLI、编辑器和受限 Patch 协议。
- Claude、BaoCut、Anthropic 等名称用于标识研究对象，不表示合作、授权或官方兼容。
- 正式商用前需要另外做商标/品牌冲突搜索及依赖许可证清点。

## 5. 实际源码入口与复查路径

- <https://github.com/JimLiu/baocut/blob/main/skills/baocut/built-in-skills/design/SKILL.md>
- <https://github.com/JimLiu/baocut/blob/main/skills/baocut/built-in-skills/design-system/SKILL.md>
- <https://github.com/JimLiu/baocut/blob/main/packages/design-runtime/README.md>
- <https://github.com/JimLiu/baocut/blob/main/packages/design/src/canvas-check.ts>
- <https://github.com/JimLiu/baocut/blob/main/packages/design/src/canvas-layout.ts>
- <https://github.com/JimLiu/baocut/blob/main/LICENSE>
- <https://github.com/JimLiu/baoyu-design/blob/main/skills/baoyu-design/SKILL.md>
- <https://github.com/JimLiu/baoyu-design/blob/main/LICENSE>

## 6. 面向游戏研发的专有竞争力

DesignForge 长期不止要“输出漂亮页面”。要建立从 **设计系统 → UI 状态 / 流程 → 游戏 HUD / 按钮 / 弹窗 / 任务系统 → 国际化长文本测试 → 手势与小屏审计 → H5 运行代码 → Visual QA → PR** 的闭环。游戏产品还应有安全区、横竖屏、动态内容、状态机、局部可访问性审计与低端机渲染预算，这些领域能力可能形成不同于通用设计产品的壁垒。

## 7. M1 实施前的官方机制复核

本轮仅研究公开产品/文档机制，没有引入第三方编辑器源码或品牌资产。部分搜索索引对 BaoCut 的历史许可摘要互相冲突；以当前根许可及 README 为准，本项目继续独立实现。

| 来源 | 公开机制 | 本项目的工程选择 |
|---|---|---|
| [Penpot flexible layouts](https://help.penpot.app/user-guide/designing/flexible-layouts/) / [Design tokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) | Flex/Grid 与共享 Token 可一起表达自适应设计 | 使用原生 CSS Flex/Grid，编辑器与导出共用渲染；spacing 可引用数值 Token |
| [Figma Auto Layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma) / [Variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) | 容器布局、组件实例及变体降低重复编辑成本 | 显式组件定义/变体/实例覆盖，不把渲染子元素伪装成独立持久化节点 |
| [Framer breakpoints](https://www.framer.com/academy/lessons/framer-fundamentals-breakpoints) | 主布局继承与断点覆盖一起处理不同屏宽 | 同一树上保存受限字段覆盖，用画板 container queries 实际验证 |
| [Claude Design launch](https://www.anthropic.com/news/claude-design-anthropic-labs) / [Getting started](https://support.claude.com/en/articles/14604416-get-started-with-claude-design) | 对话、直接编辑、行内反馈及交付结合 | 先保持项目/标注/Patch/审批闭环；BYOK 和内置模型留给 M2，不宣称已实现 |
| [BaoCut](https://github.com/JimLiu/baocut) / [第三方声明](https://github.com/JimLiu/baocut/blob/main/THIRD_PARTY_NOTICES.md) / [baoyu-design](https://github.com/JimLiu/baoyu-design) | 宿主能力与 Agent Skill 相互补充；许可需分项目核对 | 保留独立 AST、受限协议和本项目原创实现；不复制 BaoCut runtime |

上表最后一列为本项目的设计决策，不是竞品实测性能结论。尚未进行同任务、同模型、同硬件的优劣基准测试。


## 8. alpha.7 官方机制复查（2026-10-25 Asia/Shanghai）

本节只依据当前官方文档；没有运行竞品、读取用户竞品账户或引入其源码。下表的工程选择是本项目推断/取舍，不是兼容或性能领先声明。

| 官方来源 | 复查机制 | 本项目实现及边界 |
|---|---|---|
| [Figma variants](https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants) | 相似组件归入组件集，可复制变体并组织属性值 | 当前提供列表式命名/复制/引用保护，尚非多属性变体矩阵 |
| [Penpot components](https://help.penpot.app/user-guide/design-systems/components/) / [variants](https://help.penpot.app/user-guide/design-systems/variants/) | 主源和实例覆盖分离，可从副本更新主源；变体关联参考层名、类型及层级 | 保留源ID作用域的普通源副本，显式更新；不兼容覆盖拒绝，不按名称猜测迁移 |
| [Framer breakpoints](https://www.framer.com/academy/lessons/framer-fundamentals-breakpoints) | 新断点布局继承主断点，再覆盖差异 | 本项目画板容器查询与明确编辑范围共用同一树，实测尺寸反馈和像素回归核对结果 |
| [Claude Design current guide](https://support.claude.com/en/articles/14604416-get-started-with-claude-design) / [design system](https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design) | 对话生成、画布编辑及设计系统结合，当前文档把Design作为Artifact模板入口 | 借鉴从设计体系到局部迭代的产品闭环；当前仍是外部Agent+受限Patch，不虚构内置模型或逆向复制运行时 |

官方文档中的入口、订阅与可用性会变化；不把4月发布稿当成永久当前状态。当前工作不涉及竞品付费/登录、第三方设计上传或部署。BaoCut/baoyu-design的原始研究与许可边界沿用前述章节。
