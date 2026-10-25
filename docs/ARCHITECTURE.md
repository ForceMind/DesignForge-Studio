# DesignForge 架构 · M1 core preview

## 数据兼容策略

保留 `format: designforge.project`、`version: 1`，通过可选字段扩展 M1。原 Orbit 文件及哈希 `21a89182` 未改变；读取旧工程无需迁移、重排或替换 ID。旧 M0 应用不能读取新增节点类型，这不是双向兼容承诺。正式扩展仍在 alpha 阶段；未来若修改字段语义，应引入显式新版格式和迁移函数。

- Board 仍有 `nodes` 根数组。Node 可有 `children`，仅 `frame/group/component` 容器允许持久化子节点。节点 ID 在整个画板树内唯一，最多 500 个节点、20 层嵌套。不同画板可使用相同节点 ID。
- `x/y` 相对于直接父容器；`w/h` 是固定尺寸或布局的设计参考。`move-node` 保留这些值，移动到不同父容器可能改变视觉位置；要保持位置须同时更新坐标。UI 会明确标注这一语义。
- `layout`：`mode: absolute/flex/grid`，方向、gap/padding、align/justify、columns、wrap。gap/padding 支持数值 Token。Flow 子节点不使用 x/y；顺序来自 children 数组。绝对布局图层树按数组顺序排列，最后一个节点绘制在最上层。
- `sizing.w/h: fixed/fill/hug`。文字 hug 采用浏览器内容测量。Fill 会使用父容器空间；循环的 hug/fill 组合未做完整约束求解，见已知问题。
- `constraints.horizontal/vertical: start/end/center/stretch/scale`，`referenceW/referenceH` 保存父容器的参考尺寸。修改宽高后仍可保持边距或比例。Inspector 首次配置约束时记录基准。
- `responsive: [{maxWidth, changes}]` 使用**画板容器宽度**而非整个工作台宽度。宽断点先、窄断点后，变化可覆盖 w/h/layout/sizing/style/hidden；Inspector 提供添加/改宽/删除、范围总览与逐字段恢复继承。
- `board.autoHeight: true`：单根容器时按内容撑开高度，`board.h` 作为最小高度；多根元素或非容器根时回到固定高度。此规则用于避免响应式导出纵向截断，编辑器壳也读取真实 DOM 高度。

## 组件与设计系统

```json
{
  "components": [{
    "id": "action", "name": "Project action",
    "variants": [{"id": "primary", "name": "Primary", "root": {"...": "完整源节点，通常为容器"}}]
  }],
  "themes": {"dark": {"surface":"#202938", "ink":"#F2F4F8"}},
  "activeTheme": "dark"
}
```

`instance` 节点持有 componentId、variantId 和 `overrides[sourceNodeId]: {text,style}`。渲染时从最新定义投影，先应用覆盖，再用实例根的尺寸/样式。投影子元素只有 `data-source-id`，不会冒充可持久化节点；画布选中整个实例。Inspector 可修改源后代文字/样式覆盖；根样式由实例自身属性管理。解除关联复制源树、保留实例根ID并为后代生成新ID。组件定义禁止嵌套实例以避免循环引用。源容器与库定义显式更新，不暗中同步。

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

Node 测试覆盖协议、树操作、锁定、资产、存储和 CLI 文件保护。Playwright 在 CI 的真实 Chromium 中运行操作/尺寸检查、保存截图和失败 trace。截图需人工复核，未建立像素差异阈值；alpha.6接入其他引擎，实际结果见VALIDATION.md；真机仍未覆盖。记录见 VALIDATION.md，剩余工作见 KNOWN_ISSUES.md。


## M1 alpha.2：事务交互与断点继承

`responsive.mjs` 统一渲染器和 Inspector 的宽→窄继承：layout/style/sizing 逐字段合并，其他允许字段替换。`setScopedChanges` 只在所选 maxWidth 写入，`resetScopedField` 仅删一个覆盖字段。重复宽度被结构校验拒绝。渲染会在影响该分支的断点上同步重算后代，避免父容器切换 Flex/Grid 后子项仍为 absolute；组件投影子层的选择器按实例 ID 隔离。

预览宽度及手工选择的编辑范围保存在会话 Map，不写进项目、不加入历史。画板尺寸输入仍修改设计尺寸。预览宽度可以帮助编辑同一树的实际容器查询，位置/名称/文字内容仍属全局字段。场景切换/重载后默认从设计宽度开始。

`viewport.mjs` 只负责真实 DOM 测量与临时样式。`geometry.mjs` 提供尺寸计算、约束反解、框选和父子去重。尺寸操作记录初始测量，pointermove 不写 AST/存储；pointerup 经统一 commit 校验后只写一份历史；取消清除预览并恢复。Overlay 在 viewport 坐标中保持固定像素大小，脱离嵌套容器裁切。Flow 或断点模式不提供会移动原点的缩放方向，避免改动全局 x/y。

框选使用真实客户端几何，只选当前画板完全包围的图层，过滤隐藏及祖先锁定，再去掉重复子层。它只改变选区，无项目写入。默认空白拖动改为框选，Space/H/中键仍平移。容器背景只有已选中时才直接进入移动；未选中的容器背景拖动用于子层框选，点击则选中该容器。项目切换会清理预览 Map，避免相同 ID 导致跨项目编辑范围泄漏。

响应式 CSS 的作用域收集按受影响节点/树边展开，避免将全部独立节点与无关断点交叉相乘。Flow 子项先重置 flex 再应用当前主轴的 Fill；约束参考尺寸取原设计父级/画板，即使省略显式 referenceW/H，断点覆盖父尺寸也不改变参考基线。临时参考值仅存在于渲染副本，不写入 v1 项目。


## M1 alpha.3：标尺、参考线与约束移动

可选 `boards[].guides` 是编辑辅助数据，每板最多 100 项 `{id, axis: x/y, position: 0..10000, hidden?, locked?}`。坐标是画板局部 CSS px，不随预览宽度重新缩放。`guides.mjs` 集中校验、锁定规则、坐标投影和刻度间距计算；未知字段/非有限数值/重复 ID 拒绝。参考线进入存储、备份、hash 和板级 Diff，HTML/CSS 导出忽略，不扩展 Agent Patch 的权限。

标尺和可拖动的线使用 viewport 像素覆盖层，命中区域不随 zoom 缩小；原点跟随当前画板的 DOM 实测位置。pointermove 仅改变暂态位置和面板读数，pointerup 单次提交；取消/失焦复原。隐藏线不吸附，锁定线仍吸附但不能被移动/删除；解锁必须是单独操作。移出画板释放删除，按 Esc 取消。线坐标超出当前预览范围时不渲染、不吸附，但不丢弃工程数据。

图层移动同样测量实际父级 padding-box/子项/兄弟几何，按边框修正画板参考线到父相对坐标，再用 `positionChanges` 反解 End/Center/Scale 等原约束。历史写入保留原宽高、sizing 和 constraints。Auto Layout 子项仍由原生布局管理；alpha.5 的排序手势只改 children 顺序，不写自由坐标。

等距分布使用同父级、可见且未锁定的至少三个自由图层的 DOM 几何，固定两端盒子的外沿，按真实尺寸计算相等间隙。只反解并写入分布轴的位置，保留另一轴、宽高、约束和树顺序；Auto Layout 选区明确拒绝，由 gap/justify 管理。跨度不足时可得到负间隙，不承担自动消除重叠的功能。


## M1 alpha.4：编辑闭环补齐

- `richtext.mjs` 提供 v1 可选 textRuns（最多 256 段，合计 10000 字符）、受限分段样式、安全 spans 和 Unicode 字素范围；普通编辑按公共前后缀保留格式。输入框保持原生纯文本。节点支持行高/字体以及安全字体 Token；实例文字覆盖清源格式，样式覆盖明确字段在各断点优先。
- 多选尺寸事务测量同父级自由图层的实际盒子，仿射变换盒子与间隙，松手一次提交，约束反解保留参考尺寸；Flow、scoped、锁定、跨父级及超界选区明确拒绝。字体/后代继续使用各自布局规则，不等于内容栅格化缩放。
- 组合/解组重新参考约束坐标，提供实测盒子时允许根层 Fill/Hug 并按当前几何归一化 fixed；几何响应式覆盖无法无损时拒绝。对齐与键盘移动也使用实测几何和约束反解；祖先锁定及解除实例关联入口统一保护。
- `component-properties.mjs` 提供源后代文字/样式及单字段恢复，`token-editor.mjs` 提供当前主题定向写入和恢复，失败原子拒绝。主题新建不再覆盖同名已有主题。
- `design-library.mjs` 管理严格纯 JSON 的 designforge.library v1，包体最多 2 MB，引用资源仍受既有预算约束。前缀隔离重写 Token/主题/组件/资产引用及字体继承，不改变文字和当前画板；包不含画板/评论/凭据，未开放 Patch 的库管理权限。
- `browser-audit.mjs` 读取当前 DOM 的父级/画板越界、可见文字溢出/实际裁切、兄弟矩形碰撞及触控热区。实例源图层映射回实例 ID；碰撞仅是 warning。报告记录 hash、预览宽度、时间和浏览器，编辑后显示过期；未声称像素 Diff 或 WCAG 认证。

`scene-budget.mjs` 按组件变体缓存投影成本，并对重复实例累加节点、富文本 span 与文本成本，阻止小 JSON 放大成海量 DOM。validateProject 与直接 renderBoard 均有预算保护，不先 materialize 巨树；读取前再限制项目/Patch/库文件大小。失败不会覆盖存档。

文字膨胀预检在离屏fixed/inert副本按同一CSS宽度扩大字素，使用原字体/分段与container queries，审计后finally清除。原DOM/AST/存档不写入，结果按hash/宽度标记过期并可单独导出；因子1..2，UI固定约+30%，按分段向上取整。CLI读取采用固定上限缓冲区和分块读，文件增长也不突破预算；init不能覆盖既存文件。


## M1 alpha.5：原生布局排序与宽度总览

`flow-layout.mjs` 根据可见兄弟图层的 viewport 实测盒子选出最近边缘；Grid 按行、Flex 按主轴选择前/后插入点。它输出插入锚点及屏幕标记，不猜测 Flex/Grid 尺寸。`reorderSibling` 在全部检查完成后仅调整同父数组，保留节点对象和所有字段，返回 false 表示无顺序变化；锁定源/祖先、跨父级和非法位置均拒绝。

工作台在 pointermove 只临时平移原图层 DOM 并降低透明度（图层仍占布局空间）和画插入线；pointerup 检查父框、画板、viewport 与起始项目 hash，再调用统一 commit 一次。取消、窗口失焦及拖出父框不记录历史；显式项目修改、Undo/Redo、宽度切换或项目导入会先结束手势。组件投影被当作完整实例排序，不解除关联。前后按钮和 Alt + 方向键复用同一顺序操作。

`breakpoint-overview.mjs` 将本节点 maxWidth 集合划为 280–2400px 连续区间；最窄区间含左端，其余左开右闭，与 effectiveNode 的 ≤ 级联一致。边界为 280 时保留单点按钮；2400 断点覆盖整个预览域时不虚构基础专属区间。区间、预览游标和修改范围是不同状态；预览 width 和 scope 继续只存会话 Map，不写 v1，不增加 Undo。父级/组件源影响由真实 container queries 执行，总览明确只显示本节点。

End 定位的反解加入“实测尺寸 − 当前有效声明尺寸”差值；拖动每个兄弟保存各自盒子，并用 important 临时样式预览，避免断点定位规则遮住拖动。SVG 图标从 wrapper 的安全 CSS color 继承 stroke，响应式颜色与静态导出因此共用路径。没有新增项目字段、Patch 权限或运行依赖。


## M1 alpha.6：节点修订与全页布局来源

`node-history.mjs`复用现有项目快照，不在v1中保存第二套节点副本或操作指令。`retainHistory`保留最多35份快照（含当前），序列化JSON合计上限12×1024×1024字符；只保留最新同项目连续分支用于节点时间线，Undo后产生新编辑仍截去旧Redo分支。刷新/导入文件重新开始会话，持久化恢复仍使用原项目备份。

局部撤回以“修改前 / 修改后 / 当前”三个状态比较，按实际差异计算字段。当前等于修改后才可撤回，已等于修改前标记已恢复，存在后来编辑则冲突且不勾选。文字与textRuns、变体与overrides分别原子成组；responsive数组为整体比较，style/layout/sizing/constraints与普通实例覆盖按叶字段比较。选择子集后重算候选，重新校验整个项目；失败不产生历史/存储写入。预览和应用之间还核对项目hash及两份来源快照hash。

删除/创建/节点类型替换以完整子树和相关批注为受保护单元，禁止覆盖后来编辑或新增批注；恢复沿原父级与现存邻居定位，无锚且原位置无邻居时追加。原父不存在/锁定、同板ID或批注ID冲突、引用资产/组件/Token已不存在时拒绝。父级变更把位置/尺寸模式/约束一起比较；节点后来换父时，旧坐标字段不能直接恢复。父容器顺序恢复只调整已有子层顺序，保留子层后来修改的内容；子层集合或顺序再次变化会产生冲突。

`board-breakpoints.mjs`复用`materializeInstance`得到与渲染器相同的根继承、源字段和实例覆盖剔除结果，先检查投影预算再收集宽度。记录实际ownerId及可选sourceId，来源条目不冒充可持久化节点。全页面板按宽度分组、每页6组、来源每次20条，可搜索/继续显示；导出只读designforge.breakpoint-report v1并带当前hash。点击直接覆盖进入其真正节点的编辑范围；点击组件源定位整个实例及预览，不把源ID写进画板。单一当前项目缓存随项目对象替换而失效，临时宽度和筛选不写项目。

为消除Firefox等引擎的布局量化噪声，移动/微调可将实测起点作为origin，把位移反解到既有设计坐标，保留零位移和连续整数微调；Scale只缩放增量。吸附使用目标坐标反解，不能把起点量化误差带到准确参考线上。原End+Hug/Fill的绝对反解继续保留。

公开工程/定义与Patch新增节点拒绝`$sourceId/$referenceSize/$selector`，它们只由渲染副本创建。Node名称与变体显示值做类型校验；其他合法自定义元数据仍保留，失败不会通过删字段来“修复”输入。

CI通过固定Playwright依赖启动Chrome、Firefox及WebKit，并在每份artifact记录实际启动的引擎/版本/平台。Chrome/Linux保留5张原始PNG参考图，常规比较禁止自动更新；额外的12px偏移对照验证差异检出。像素基准不跨引擎冒用，另两个引擎仍执行完整交互用例。

历史恢复和Patch共用组件源覆盖锁定判定；计划逐字段给出blocked状态，应用候选工程前再次检查所有实例，避免从删除历史恢复覆盖到后续锁定的源层。


## alpha.7 属性反馈与组件管理

Inspector 保留当前编辑范围的W/H输入，同时从选中元素DOM的border box除以world缩放得到实测尺寸，最多显示两位小数。读取不修改AST或历史。ResizeObserver显式观察当前元素的border-box，字体/内容导致的异步reflow也会刷新；改选和重绘重新绑定，无可见盒子时明确显示“当前图层未显示”。尺寸数值编辑继续只把被修改轴写为fixed，且遵从当前基础/断点范围。

历史差异卡片将勾选label与文本区域分开；完整值在原生details展开时惰性序列化并通过textContent显示。下载`designforge.node-history-review` v1包含当前baseHash、来源步骤与前后hash、选中键、完整前/后/当前值及冲突状态，不含可执行指令，也不进入Patch应用通道。展开和下载共用当前工程/来源快照有效性检查。

`component-library.mjs`提供原子本地创作操作；先校验源工程，再克隆、修改并完整校验候选工程。组件/变体重命名保留ID，复制保留其作用域内源ID但不共享可变对象；统计所有画板的声明实例（含嵌套及锁定实例）。被引用对象不能删除，至少保留一个变体，锁定源也不能被删掉。

源编辑采用明确的普通画板副本，无临时项目字段或假投影ID：克隆源根到新画板，源节点ID在不同画板作用域内可复用。用户使用原有图层/布局工具编辑，选中相同源根后显式更新对应变体。绑定更新检查根身份，通用“用当前容器更新变体”入口继续保留。更新不能自动清理悬空覆盖、嵌套实例或缺资源；候选校验失败则定义/实例/历史均不变。副本包含在文件/HTML导出中，用户可自行删除；不是自动同步主定义或协作分支，尚无更新前专用视觉Diff审批。

实例解析继续沿用同一materializeInstance：容器源保持frame投影；非容器源保留button/text/image等类型和源文字，不给叶子根附加children。解除关联后仍能通过工程校验并保留语义；没有为此放宽公开工程、SVG、字体或Patch边界。明暗模式只调整工作台变量，不改用户画板内容。


## alpha.8 原生状态、素材与简报

- `interaction-states.mjs`定义状态/字段/原生标志枚举、形状校验、按状态/style叶字段合并和固定选择器CSS；标量与每个主题的Token类型由core复用checkStyle验证。core渲染普通/实例展开共用renderedEntries，响应式和状态选择器均按画板/实例作用域隔离。没有来自项目数据的任意选择器/动画。
- `scene-budget.mjs`把每个状态与其字段计入渲染单位，先计算投影再克隆/渲染；叶子实例文本按实际源文本及根文字覆盖计算，不能被instance.text空值抵消；替换富文本同步扣除源span成本。原5000/board、20000/project和200万投影字符上限继续有效。
- `state-inspector.mjs`处理临时预览与显式覆盖编辑，持久字段进入原commit/save/Undo；data-df-state仅在渲染DOM存在，禁止由Agent作为公开元数据写入。`node-history`恢复状态映射与原生标志；`design-library`保留状态并重写别名。
- `starter-gallery.mjs`提供12个原创AST配方、纯插入候选和受限预览；默认折叠，仅打开时渲染，4项分页限制iframe工作量。相同定义复用，手工差异保留并换ID；不合并全局Tokens或请求外站。iframe为空sandbox，CSP默认禁源，仅允许内联样式和data资源。
- `design-brief.mjs`保存可选受限project.designBrief，生成提示/大纲与allowlist只读范围；`brief-inspector.mjs`是Agent面板入口。CLI context和UI下载加上当前baseHash。报告排除任意顶层/节点元数据和资源data，不授予模型调用、命令执行或链接访问权限。
- `Launch.project.json`有产品页/原生素材两张画板，`Starters.library.json`可独立导入；`make-reference-example.mjs`可重建。原Orbit格式、字节与哈希不变。完整模型/操作见CREATIVE_WORKFLOW，来源及许可见RESEARCH与THIRD_PARTY_NOTICES。
