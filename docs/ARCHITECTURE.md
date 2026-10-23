# DesignForge 架构设计 v0.1

## 设计目标

**设计数据与运行界面解耦、Agent 修改默认保守、浏览器里即刻可编辑、零云端依赖。** 软件目前是可运行的研究原型，而不是完整的 Figma / BaoCut 替代品。

```text
index.html + src/app.css + src/app.mjs
  ├── 多画板缩放/平移、图层选择/编辑
  ├── Design Tokens / 批注 / 静态审计
  ├── import/export、undo/redo、localStorage
  └── Agent 提示词生成 → Patch 文件导入 → Diff → 审批
           │
       src/core.mjs  ← 原创、纯函数、可单测
          ├── DesignForge Project v1 schema validation
          ├── HTML render/export (escaped strings + allowed CSS)
          ├── contrast/layout static audit
          ├── applyPatch (validate + atomic clone)
          └── diffProjects / hashProject
           │
        CLI / Agent Skill
```

## 数据协议

入口类型是 `format: "designforge.project"` 且 `version: 1`。示例在 `examples/Orbit.project.json`。顶层属性：

```json
{
  "format": "designforge.project",
  "version": 1,
  "id": "project1",
  "title": "Product Design",
  "tokens": {"primary":"#5C4ACF", "primarySoft":"#EEEAFE", "radius":14, "fontFamily":"system-ui"},
  "boards": [{
    "id": "desktop", "name":"Dashboard", "x":0, "y":80,
    "w":1280, "h":800, "bg":"#FFFFFF",
    "nodes": [{
      "id":"title01", "name":"Heading", "type":"text",
      "x":24,"y":24,"w":280,"h":48,
      "text":"Hello Design", "style":{"fontSize":30,"fontWeight":700,"color":"$ink"}
    }]
  }],
  "comments": [],
  "updatedAt":"2026-10-23T00:00:00.000Z"
}
```

注意：上文的 tokens 是结构示意，实际导入文件**必须**包含所有 `TOKEN_KEYS` 颜色条目（见 `src/core.mjs`）。数值限制与解析以 `validateProject()` 实现为准；画板宽度 280–2400、高度 280–3200、最大 24 块，单画板不超过 500 元素。每个元素是绝对定位，不支持树状嵌套和响应式约束。类型：`rect/circle/text/button/pill/line/icon/input`。

节点支持颜色直接值或形如 `$primary` 的 token 引用，不接受任意 CSS 表达式。文字会 HTML escape；静态导出不注入脚本。图标从本地已知矢量集合生成，不接受外部 SVG 片段。第一版使用静态 HTML 页面而非生产可交互前端。

## Agent Patch 流程

1. UI / CLI 导出**完整项目 JSON**。Agent 按选中画板与元素 ID 生成白名单 Patch，不触碰原文件。
2. `applyPatch(project, patch)` 用项目哈希 `baseHash` 阻止旧版本覆盖；在克隆对象上尝试变更，单个操作失败会回滚整批。
3. 应用后 `validateProject(next)` 二次检查，全通过才形成新快照。
4. UI 用 `diffProjects` 汇总节点和 Token 字段改动，用户确认后写入历史，支持 Undo。CLI 仅 `--out new.json`，不在原位覆盖。

不可信 Agent 输出只是一份**数据文件**，不是可执行代码。`baseHash` 用于版本冲突检测，不是签名，不能证明生成者身份。第一版的 Diff 是用户可读的字段变动摘要，不能保证“语义影响范围”完全相同，例如修改 Token 会影响多处引用节点。

## 审计边界

`validateProject` 检查结构、字段、引用、基础格式；`auditProject` 检查：元素超出画板、触控目标小于 44px、字号小于 12px、显式前景/填充的对比度、未知图标。它**没有**运行真实浏览器布局，也不会根据叠放图层准确推断真实背景，因此“0 个 warning”不代表视觉或 WCAG 全面通过。下一阶段接 Playwright 截图与 DOM 计算样式/交互审计。

## 数据与部署

- 不设服务端账户。`src/app.mjs` 使用浏览器 `localStorage` 自动保存；用户自行下载 JSON 备份。
- `tools/serve.mjs` 仅在 `127.0.0.1:4173` 监听并静态提供项目文件；不是面向公网、多人或未经授权用户的服务。
- `src/zip.mjs` 使用 ZIP STORE（不压缩）输出自包含的多画板 HTML/JSON 包。页面本身无外部 CDN 依赖。
- `tools/forge.mjs` 的校验/审计/导出/应用可离线运行，CI 可以把它接入其他仓库。

## 现阶段明确缺口

- 无多版本持久化、跨设备同步、云协作/权限、对图片/字体/视频的素材管理。
- 非组件树 AST，没有布局引擎、栅格约束、自动吸附、响应式断点、富文本样式、渐变。
- AI 由外部 Agent 生成补丁，应用程序**不直接调用模型**；无法声称已完成自然语言一键生成 UI。
- 代码生成当前仅为静态绝对定位页面，不代表生产 React/Vue 组件。
- 尚无真实浏览器自动化视觉/交互测试。本开发环境的 Chromium 策略阻止测试 URL，未规避该限制。
