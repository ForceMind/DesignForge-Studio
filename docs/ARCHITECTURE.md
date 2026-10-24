# DesignForge 架构 · M1 core preview

## 数据兼容策略

保留 `format: designforge.project`、`version: 1`，通过可选字段扩展 M1。原 Orbit 文件及哈希 `21a89182` 未改变；读取旧工程无需迁移、重排或替换 ID。旧 M0 应用不能读取新增节点类型，这不是双向兼容承诺。正式扩展仍在 alpha 阶段；未来若修改字段语义，应引入显式新版格式和迁移函数。

- Board 仍有 `nodes` 根数组。Node 可有 `children`，仅 `frame/group/component` 容器允许持久化子节点。节点 ID 在整个画板树内唯一，最多 500 个节点、20 层嵌套。不同画板可使用相同节点 ID。
- `x/y` 相对于直接父容器；`w/h` 是固定尺寸或布局的设计参考。`move-node` 保留这些值，移动到不同父容器可能改变视觉位置；要保持位置须同时更新坐标。UI 会明确标注这一语义。
- `layout`：`mode: absolute/flex/grid`，方向、gap/padding、align/justify、columns、wrap。gap/padding 支持数值 Token。Flow 子节点不使用 x/y；顺序来自 children 数组。绝对布局图层树按数组顺序排列，最后一个节点绘制在最上层。
- `sizing.w/h: fixed/fill/hug`。文字 hug 采用浏览器内容测量。Fill 会使用父容器空间；循环的 hug/fill 组合未做完整约束求解，见已知问题。
- `constraints.horizontal/vertical: start/end/center/stretch/scale`，`referenceW/referenceH` 保存父容器的参考尺寸。修改宽高后仍可保持边距或比例。Inspector 首次配置约束时记录基准。
- `responsive: [{maxWidth, changes}]` 使用**画板容器宽度**而非整个工作台宽度。宽断点先、窄断点后，变化可覆盖 w/h/layout/sizing/style/hidden；Inspector 目前提供简化的添加与清除入口。
- `board.autoHeight: true`：单根容器时按内容撑开高度，`board.h` 作为最小高度；多根元素或非容器根时回到固定高度。此规则用于避免响应式导出纵向截断，编辑器壳也读取真实 DOM 高度。

## 组件与设计系统

```json
{
  "components": [{
    "id": "action", "name": "Project action",
    "variants": [{"id": "primary", "name": "Primary", "root": {"...": "完整容器节点"}}]
  }],
  "themes": {"dark": {"surface":"#202938", "ink":"#F2F4F8"}},
  "activeTheme": "dark"
}
```

`instance` 节点持有 componentId、variantId 和 `overrides[sourceNodeId]: {text,style}`。渲染时从最新定义投影，先应用覆盖，再用实例根的尺寸/样式。投影子元素只有 `data-source-id`，不会冒充可持久化节点；画布选中整个实例。Inspector 可直接修改实例文字，解除关联会复制整棵树并重新生成 ID。组件定义禁止嵌套实例以避免循环引用。源容器与库定义显式更新，不暗中同步。

Tokens 保留既有必需颜色、radius、fontFamily，允许额外颜色/数字键和 `$alias`。主题是基础 Token 的覆盖映射；每套主题分别校验别名及循环。颜色、布局间距、圆角、字号等渲染路径解析 Token。字体选项为内建栈或 `asset:<fontId>`。

## 模块与共同渲染路径

- `tree.mjs`：递归寻址、祖先锁定、移动循环保护、复制/组合/解组/对齐，纯函数操作可由 UI 和 Patch 复用。
- `core.mjs`：递归结构校验、Token、受限 CSS 生成、实例投影、容器查询、静态审计、哈希、Patch、Diff。
- `assets.mjs`：内嵌资产 MIME/signature/大小检查；SVG 使用封闭的标签和属性白名单，拒绝脚本、CSS、外链、实体、未知标记。不是通用 SVG 编辑器。
- `storage.mjs`：校验后写入当前项目，先保存上一有效快照；最多 8 份且编码 JSON 总预算 750,000 字符。初次打开即存档；当前文件损坏时读取最新有效备份。Quota 错误交给 UI，不清理用户项目。未通过校验的原始存档先存入 rejected 槽位，保留原始字节供下载修复；保留失败不覆盖当前文件。样式类型及数值范围会在基础与所有主题下分别校验。
- `geometry.mjs`：自由布局的边缘/中心吸附及 8px 网格；编辑期间只改 DOM 预览，松手才提交一份历史。
- `app.mjs`：选区、历史、画布、树/Inspector、组件/资源库、人工 Patch 确认。图层属性和 HTML 导出共用 `renderBoard`，不维护另一套布局引擎。

布局由浏览器 Flex/Grid 和 container queries 执行。静态 AST 不伪装成浏览器布局结果；静态审计跳过 Flow 子项几何推断，但仍检测文字/触控/显式对比度。

## 事务与安全

UI commit 克隆当前项目 → 修改 → 递归校验 → 写历史/存储 → 重绘。失败不提交数据。Undo/Redo 为最多 35 个内存完整快照，跨刷新历史使用备份恢复；二者不同。批注锚点递归查找，容器删除清除后代锚点。

Patch v1 保留强制 baseHash、受限操作/字段及整批原子校验；锁定节点和祖先约束对 Patch 同样生效。Hash 是冲突探测而非认证签名。Diff 展示后代、父级、顺序、布局、组件库/主题/资产变更；仍是字段摘要，不是语义影响或可视化截图 Diff。

导入仅处理数据；文本 HTML escape，CSS 来自枚举/有界数值，原始 HTML/JS 不执行。资源只接受受限内嵌 data URL；模型密钥不进入工程。本地服务器拒绝点目录、node_modules 与符号链接越界；CLI apply 使用排他新建写入，不覆盖既存文件。

## 验证分层

Node 测试覆盖协议、树操作、锁定、资产、存储和 CLI 文件保护。Playwright 在 CI 的真实 Chromium 中运行操作/尺寸检查、保存截图和失败 trace。截图需人工复核，未建立像素差异阈值；当前未覆盖其他浏览器与真机。记录见 VALIDATION.md，剩余工作见 KNOWN_ISSUES.md。


## M1 alpha.2：事务交互与断点继承

`responsive.mjs` 统一渲染器和 Inspector 的宽→窄继承：layout/style/sizing 逐字段合并，其他允许字段替换。`setScopedChanges` 只在所选 maxWidth 写入，`resetScopedField` 仅删一个覆盖字段。重复宽度被结构校验拒绝。渲染会在影响该分支的断点上同步重算后代，避免父容器切换 Flex/Grid 后子项仍为 absolute；组件投影子层的选择器按实例 ID 隔离。

预览宽度及手工选择的编辑范围保存在会话 Map，不写进项目、不加入历史。画板尺寸输入仍修改设计尺寸。预览宽度可以帮助编辑同一树的实际容器查询，位置/名称/文字内容仍属全局字段。场景切换/重载后默认从设计宽度开始。

`viewport.mjs` 只负责真实 DOM 测量与临时样式。`geometry.mjs` 提供尺寸计算、约束反解、框选和父子去重。尺寸操作记录初始测量，pointermove 不写 AST/存储；pointerup 经统一 commit 校验后只写一份历史；取消清除预览并恢复。Overlay 在 viewport 坐标中保持固定像素大小，脱离嵌套容器裁切。Flow 或断点模式不提供会移动原点的缩放方向，避免改动全局 x/y。

框选使用真实客户端几何，只选当前画板完全包围的图层，过滤隐藏及祖先锁定，再去掉重复子层。它只改变选区，无项目写入。默认空白拖动改为框选，Space/H/中键仍平移。容器背景只有已选中时才直接进入移动；未选中的容器背景拖动用于子层框选，点击则选中该容器。项目切换会清理预览 Map，避免相同 ID 导致跨项目编辑范围泄漏。

响应式 CSS 的作用域收集按受影响节点/树边展开，避免将全部独立节点与无关断点交叉相乘。Flow 子项先重置 flex 再应用当前主轴的 Fill；约束参考尺寸取原设计父级/画板，即使省略显式 referenceW/H，断点覆盖父尺寸也不改变参考基线。临时参考值仅存在于渲染副本，不写入 v1 项目。
