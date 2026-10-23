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
