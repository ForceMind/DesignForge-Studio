# M1 验证记录

## 基线与范围

远程 M0 基线：`56a189bf929d09eb8b092a24674b717faba6e0cd`。原始 Orbit 文件保持 3 画板、170 节点、hash `21a89182`；16 个原测试及原 Patch 均保留。

本轮在 `codex/m1-editor-foundation` 开发，[PR #1](https://github.com/ForceMind/DesignForge-Studio/pull/1)。测试工程均为仓库原创示例，不包含用户商业设计或密钥。

## 已执行结果

- 本地 Node 测试：53 项通过，包括原基线、树/布局/组件、递归 Patch/锁定/原子回滚、资源边界、存档及 CLI 防覆盖。
- `npm run validate / audit / export`：原 Orbit 通过结构校验、静态审计返回 0 finding、3 页 HTML 导出成功。静态结果不等同浏览器验收。
- 十个 M1 示例均执行 JSON 往返及结构验证、HTML 渲染；原示例一起共 11 份。
- `npm run format:check`：已加入可重复格式检查；技能 frontmatter 使用 skill-creator 的 quick_validate.py 通过。
- [首轮 CI](https://github.com/ForceMind/DesignForge-Studio/actions/runs/39983513888)：40 Node + 21 Chromium 全部通过。测试真实操作 UI、读取实际浏览器 CSS/几何并截图，非格式校验或 --list。
- [第二轮 CI](https://github.com/ForceMind/DesignForge-Studio/actions/runs/39984734670)：49 Node 通过；Chromium 22/23 通过。失败用例在鼠标操作前读取到初次打开尚未持久化的存档；现已修复为首次加载即保存。不可把该轮记作全绿。
- [第三轮 CI](https://github.com/ForceMind/DesignForge-Studio/actions/runs/39986223929)：50 Node + 24 Chromium 全部通过，包含鼠标拖动、纵向边界和实例文字覆盖。后续增加颜色取色器/Token 双入口回归，套件共 25 项；最终结果见下方验收记录。

## 截图复核与修复

从 Actions 下载首轮截图并实际查看了 dark editor、1024px editor 和 390px Studio。发现窄屏设计在固定 1000px 画板高度处截断，虽然横向断言通过。随后增加 autoHeight、编辑器真实高度同步和纵向边界断言，第二轮已通过三个宽度的完整 Studio 边界检查。暗色 Inspector 文本对比度也已调整，待最终截图再核对。

## 浏览器执行条件

本地工作容器没有 Chromium；两次 Playwright 下载分别返回无效归档，系统包安装受权限限制。没有绕过权限限制；使用仓库 GitHub Actions 的 Ubuntu + Node 22 + Playwright Chromium 真实运行。CI 保留截图与失败 trace 14 天，需从具体 run 的 `browser-evidence` 获取。

覆盖：树/画布/Inspector 同步、文本编辑、撤销重做、存档回读、Flex/Grid 计算样式、多选组合/解组/复制、重设父级、折叠、实例变体和解除关联、主题持久化、M0 导出 ZIP、本地损坏恢复、1024px 编辑器、Studio 390/768/1440px 与九个其他示例、受限 SVG 导入、鼠标拖动。

缺口：Firefox/WebKit/真机、完整键鼠矩阵、触屏、实际自定义字体的多平台解码、像素 golden image Diff、复杂任意项目的溢出/碰撞/截断、完整 WCAG。人工截图复核不能替代这些缺口。

## 后续校验强化

新增跨主题样式类型/范围检查、非法原始存档保留及保留失败不覆盖的测试；Node 套件现为 53 项。浏览器新增原始存档下载修复用例，现共 26 项。

实际 HTTP smoke 检查：工作台和 core.mjs 返回 200；点目录、node_modules、编码路径穿越、指向根外文件的符号链接均返回 404。

两次后续运行停留在 `playwright install --with-deps chromium` 外部安装阶段，因此不能将其写成浏览器通过。CI 改用 runner 预装 Chrome 执行原套件并记录 `google-chrome --version`；本地默认仍使用 Playwright Chromium，也可设置 `DESIGNFORGE_BROWSER_CHANNEL=chrome` 复用已安装 Chrome。来源：[Playwright 官方 channel 文档](https://playwright.dev/docs/browsers)、[GitHub runner 软件清单](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)。这是执行环境调整，没有删除任何断言。


[Chrome 执行轮次](https://github.com/ForceMind/DesignForge-Studio/actions/runs/39988049824) 在 `773e16d` 上通过 53 Node + 26 浏览器测试（Chrome 155.0.8059.39）。实际下载并查看截图后发现 runner 无 CJK 字体，中文显示方框，因此该轮仅计功能通过，视觉未通过。随后为 CI 添加有界超时的 fonts-unifont 安装及字体清单输出，再跑原套件和截图。这不修改产品字体或上传任何第三方字体到工程。


## 2026-10-23 · alpha.1 验收记录

- 代码与环境基线：`1310e3ba91f5ac8538b4d13c03658c63b69f4733`。
- [最终验收 CI](https://github.com/ForceMind/DesignForge-Studio/actions/runs/39988482554)：verify 和 browser 均 success；53 项 Node、26 项真实 Chrome 测试全部通过。
- 实际浏览器：Google Chrome **155.0.8059.39**；26 项用例使用两个 worker，约 24 秒。CI 安装 fonts-unifont，并输出中文字体清单。
- 实际下载 artifact `12517345508`，查看 dark editor、1024px editor、390px 导出截图：中文方框已消除，Inspector 文本可读，移动内容包含 checklist 和 footer，不再被固定高度截断。
- 下列 PNG 直接复制自该次真实浏览器输出，未重新绘制、替换或加工。此次截图只证明所列视图，不代表整体视觉回归或全 M1 完成。

| 截图 | 覆盖范围 |
|---|---|
| [深色工作台](screenshots/editor-dark.png) | 双画板、层级树、中文工作台、暗色 Inspector |
| [1024px 编辑器](screenshots/editor-1024.png) | 左右侧栏、根容器属性、取色器及 Token 文本并存 |
| [390px 响应式页面](screenshots/studio-mobile.png) | 三列变单列、内容撑开、完整 checklist/footer |

最终文档/截图提交没有继续修改产品逻辑。后续 commit 的 CI 结果仍须以其 Actions 为准。


## 2026-10-24 · alpha.2 交互研发

- 基线：PR #1 / a111d1d；原 53 项 Node、26 项 Chrome 回归继续保留。
- 第一阶段：[CI run 10](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40053806900)，61 Node + 33 真实浏览器用例通过，覆盖尺寸手柄、取消、撤销/回读、约束反解、断点编辑/继承/重置及父布局重排。
- 第二阶段：[CI run 11](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40054204854)，64 Node 通过，浏览器 34/37 通过。三个框选用例发现容器背景被误判为移动操作，已调整优先级；不删除断言，保留该轮失败记录。
- 后续补充跨项目临时状态隔离、锁定动作边界、文本输入原生撤销，以及组件响应式投影隔离；该阶段本地 64 Node 通过，浏览器扩大到 41 项；最终结果见下方。

- [CI run 12](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40054449008)：64 Node 通过，浏览器 39/40 通过。框选数据与选区已正确；后续快捷键用例发现焦点仍停在吸附复选框，导致组合快捷键被当作输入控件操作忽略。画布操作现在显式聚焦 viewport，再运行原测试核对。


### alpha.2 最终验收

- 产品代码：`452a6287a4e700bcecb0f85d56cf4ab3e6b059be`，版本 `0.2.0-alpha.2`。
- [CI run 15](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40055061632)：verify / browser 均 success；**65 Node + 43 真实 Chrome 测试通过**，原用例保留。浏览器为 Google Chrome 155.0.8059.39，43 项约 40.1 秒。
- 新增回归包含约束反解、断点字段继承/恢复、父布局切换、框选、锁定及输入焦点、同 ID 项目切换、组件投影隔离、Flex 主轴切换，以及父级宽度覆盖时未显式填写 referenceW 的右边距保持。
- 响应式规则只为受影响节点及后代生成。100 个独立节点/200 个不同宽度的压力用例断言规则为 200 条、输出小于 180 KB，防止无关断点形成平方级 CSS；这不是大型项目性能基准。
- 下载 artifact `12544882139` 并实际查看以下三张原始 PNG，未加工：尺寸手柄/Inspector 数值可见；断点编辑范围和字段恢复入口可见；多选图层与画布高亮同步。截图中文可读。

| 原始截图 | 证明的范围 |
|---|---|
| [尺寸交互](screenshots/m1-resize.png) | 单选手柄、206 × 106 实际尺寸及 Inspector 同步 |
| [断点编辑](screenshots/m1-breakpoints.png) | 500px 独立预览、修改范围、700/500px 断点与字段恢复 |
| [矩形框选](screenshots/m1-marquee.png) | 两个兄弟图层的树/画布多选同步 |

断点截图的测试容器刻意保持 fixed 640px，在 500px 预览中可见溢出；它用于验证范围编辑和继承，不作为响应式页面无溢出的证据。截图不是 golden image Diff；Firefox/WebKit、真机、触屏和完整 WCAG 仍未验收。完整 M1 仍有富文本、标尺/参考线、多选整体缩放等缺口。

## 2026-10-24 · alpha.3 标尺与参考线

- 原 65 Node、43 Chrome 回归保留；新增 6 Node、8 Chrome，用例覆盖受限参考线数据、hash/Diff/导出隔离、锁定原子性、刻度/投影、参考线事务和实际几何吸附。
- [CI run 17](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40083797212)：71 Node 通过；Chrome 49/51 通过。两个严格坐标用例分别收到 302 而非 303、369 而非 370。排查发现编辑器 artboard-frame 的 1px border 占用内容宽度，main 的 max-width 被压缩 2px，设计宽与实际 CSS 宽不符。
- 修复为不占布局空间的装饰描边；保留原精确坐标断言，另加真实 main 宽度 / world scale 为 800px 的检查。最终浏览器结果待下轮记录，不把该轮写作全绿。


### alpha.3 最终验收

- 修复画板装饰边框占宽后，[CI run 18](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40083998683) 在 `b259e113462b687972a2326659f2713a7280103b` 上通过 **71 Node + 51 Chrome**；严格坐标及新增实际内容宽度断言通过，没有放宽原断言。
- 加入等距分布后，[CI run 19](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40084129934) 在产品代码 `cbad269c9c8501aa1dddc386f4057ba51917d477` 上 verify/browser 均 success：**73 Node + 52 真实 Chrome 测试全部通过**，原 43 项浏览器回归保留。
- 实际浏览器 Google Chrome **155.0.8059.39**；52 项约 33.2 秒。新增等距分布断言浏览器真实 gap 相等、两端/尺寸保留、垂直分布及单步撤销，锁定/Flow 选区无项目写入。
- 下载 artifact `12556103557`，实际查看以下三张原始 PNG，并直接复制到仓库；未裁剪、重绘或加工。浅/深色标尺刻度、303/210px 参考线、250px 键盘调整及面板读数可见；等距分布的三层选区与面板入口可见。

| 截图 | 范围 |
|---|---|
| [浅色参考线](screenshots/m1-guides-light.png) | 水平/垂直标尺、两条参考线、数值/隐藏/锁定面板 |
| [深色参考线](screenshots/m1-guides-dark.png) | 深色可读性、选中线标签与键盘微调后的值 |
| [等距分布](screenshots/m1-distribution.png) | 三层多选、不同尺寸、水平等距结果与操作入口 |

本地 `format:check`、原 Orbit validate/audit/export 通过，Orbit hash 仍为 `21a89182`。参考线不进入 HTML 导出；静态导出相等性有 Node 断言。辅助线当前只支持移动吸附，尺寸拖拽仍按网格；没有完成多选整体缩放、富文本、通用碰撞/截断审计、像素差异或其他浏览器/真机验收。


## 2026-10-24 · alpha.4 编辑与设计系统闭环

本地 Node 套件扩大到 131 项并通过；原 Orbit validate/audit/export 通过（hash 21a89182），HTTP smoke 工作台及五个新模块均返回 200。新增实际浏览器用例覆盖多选缩放、富文本、组件样式/字体隔离、本地库下载/导入、主题 Token、DOM 审计及过期状态。浏览器结果待 CI 实际执行后补录，不能将新增测试文件当作通过结果。

- [CI run 21](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40090397666) 在 c2aba812 上：131 Node 通过，Chrome 70/71 通过。失败为旧组合测试仍断言英文 absolute-layout，但新的阻止提示为中文 Auto Layout；保留“项目未变”断言并更新提示断言。后续组合流程还需保留测量下 Fill/Hug 的归一化能力，不能靠新限制移除旧功能。
- 只读安全复现发现 23,831-byte 工程可通过实例把 100 叶子组件投影为 10,100 个节点、约 1.86 MB HTML；新增投影渲染单位/文字预算与读取前大小限制，待回归验证。未运行最大规模负载。

预算及组合兼容修复后，本地 Node 全套 141 项通过待复验；下一轮 Chrome 包含原 71 项及新增小文件投影放大/8MB拒绝回归。多选边缘缩放额外断言未修改轴的 Hug sizing 保留。

预算接入后的全套 Node 首次为140/141：畸形textRuns被提前预算错误遮蔽，丢失字段级路径；修复BudgetFailure字段诊断并删除重复预算遍历，保留原断言后141/141通过。


### alpha.4 第一阶段最终验收

- 产品代码 `d2173558de731ba32451b0e74faccd632a3eba1d`，版本 `0.2.0-alpha.4`。
- [CI run 22](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40091408166)：verify/browser 均 success，**141 Node + 72 真实 Chrome 测试全部通过**。Chrome **155.0.8059.39**，72 项约 1.1 分钟。原 52 项浏览器测试全部保留；组合用例仅更新中文提示断言，项目不变/后续组合解组复制断言均继续执行。
- 新回归包括同父级多选盒子缩放/取消/单步撤销/回读、窄预览约束及未修改轴Hug、实测对齐/组合、锁定键盘与实例解除、富文本字素/格式保留/字体、组件断点覆盖与恢复、真实库下载与前缀导入、主题隔离、DOM检测导出/过期、相同ID状态隔离，以及小JSON投影放大/超大文件拒绝。
- 下载 artifact `12558912285` 并实际查看五张原始截图，直接复制下列PNG到仓库，未裁剪或重新绘制。中文、分段文字、字体、选中框、组件库和检测结果可见。

| 原始截图 | 验证范围 |
|---|---|
| [工作台](screenshots/m1-workbench.png) | 深色工作台、Desktop/Mobile、层级与参考线面板 |
| [多选缩放](screenshots/m1-multiresize.png) | 两层共同手柄、630 × 450选区、活动图层数值 |
| [富文本](screenshots/m1-richtext.png) | 受限分段样式、Unicode字素与行高入口 |
| [设计系统包](screenshots/m1-library.png) | kit命名空间导入、真实组件实例和源后代属性 |
| [浏览器检测](screenshots/m1-browser-audit.png) | 故意包含裁切/重叠/小按钮的样例与警告 |

多选截图允许用户把图层缩放至父框外，证明操作与选区，不证明该测试设计无溢出。检测截图刻意包含设计问题，证明能发现并导出证据。截图人工复核不等于golden image、WCAG或Firefox/WebKit/真机验收。第一阶段八项交付的逐项证据见 [M1_ACCEPTANCE.md](M1_ACCEPTANCE.md)；原路线中的增强项仍以ROADMAP/KNOWN_ISSUES为准。

验收复核补充：数值宽高输入此前只改参考值，Fill/Hug下可能不改变实际尺寸。现改为仅把输入轴切到fixed，保留另一轴；Auto Layout子项X/Y只读并说明布局管理。新增浏览器回归，待下一轮实际结果。

[CI run23](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40091994281) 在4a96933上通过141 Node + 73 Chrome（57.8秒），包含数值宽高与未改轴模式、Flow坐标只读。随后接入只读文字膨胀预检及CLI有界读/init保护，新增测试待下一轮实际执行。

文字预检首轮 [CI run24](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40093115708) 在 af1cc2d 上：145 Node通过，Chrome78/79通过。唯一失败为正常Flow/Hug折行被TEXT_OVERFLOW误报；scrollWidth/clientWidth均256、scrollHeight/clientHeight均96，需修Range对行末空白的边界测量，保留严格断言。多尺寸中文长文、只读副本、清理和UI导出均已通过；不将该轮记为全绿。

Range测量现按非空白连续内容段执行；scroll尺寸保留作证据，不再单独把无可见字形的悬挂空白当溢出。原Flow/Hug空结果断言保留，并增加真正nowrap长词必须报TEXT_OVERFLOW的同板对照。当前全套预期146 Node、80 Chrome，以实际执行为准。


### M1 基础交付 · 最终扩展验收

- 产品代码 **ecd52a30a9c24b64fc186c7ad4ae620060736d85**。
- [CI run25](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40093595024) verify/browser均success：**146 Node + 80真实Chrome全部通过**。Google Chrome 155.0.8059.39，浏览器80项约1.2分钟。原成熟回归及失败场景断言保留。
- 新增文字压力用例验证原DOM/存档不变、Flow/Hug自然长高、Unicode/分段/placeholder、clone前预算/异常清理，以及中文长内容Studio在390/768/1440px的原稿及约+30%场景边界。正常pre-wrap折行不误报，真实nowrap长词仍报告TEXT_OVERFLOW。
- CLI新建/有界读测试通过；项目8MB、Patch1MB，init拒绝既存文件且保留bytes。
- 下载artifact **12559624019**，实际查看 [文字膨胀预检](screenshots/m1-text-expansion.png) 和 [最终检测面板](screenshots/m1-audit-final.png)，原始PNG直接保存，不覆盖前述run22截图来源记录。
- 文字模拟按分段字素向上取整，短段可能超过30%，是完整压力场景而非新增问题Diff。覆盖的是中文样本及字素压力；不是全语言、像素golden、WCAG或真机认证。

至此，第一阶段八项基础交付具备代码、示例、验证、原始截图、文档与PR证据。广义M1增强路线和M2/M3的未实现项仍明确保留，不因本表验收而改写为已完成。


### M1 alpha.5 · 布局排序、断点总览与评审回归

产品代码 **856471b0796ee179a25951d903844c56e7c97b26**，版本 **0.2.0-alpha.5**。[CI run30](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40103132608) verify/browser 均 success：**158 Node + 99 真实 Chrome 全部通过**，Google Chrome 155.0.8059.39，99项约1分钟。原146/80成熟回归保留；新增12项Node、19项浏览器测试。

- PR评审两项：End约束结合Hug/Fill时尺寸差引起移动跳变；SVG图标断点颜色未生效。修复后验证800/600预览中的连续微调、实际拖动预览/松手几何、Fill对齐、主题与实例颜色隔离及真实静态HTML渲染；两条讨论已标记解决。
- Flex行/列、换行、Grid的真实鼠标排序、插入线、单次提交、Undo/Redo/重载/导出；Esc、pointercancel、blur、父框外释放、同顺序释放的零写入及零历史；锁定/祖先锁定、多选保护、隐藏兄弟及实例关联保持。
- 本节点断点图范围、精确≤边界、280单点/2400全域、预览与明确编辑范围独立、越界数值拒绝、范围编辑/改宽/删除/撤销/字段继承恢复；不新增项目字段。
- Node测试、原Orbit验证/审计/HTML导出及格式检查通过；Orbit仍为3画板/170节点/hash21a89182，原示例未改写。

历史失败和修正：run27在759e0f3上149 Node通过、Chrome81/84通过；新用例误选不存在的800预览选项，已使用“设计宽度”；两条拖动断言忽略固有文字尺寸小数与CSS px锚点取整。run28在75a4754上82/84通过，颜色全通过，只余上述坐标精度断言；修正为最多0.6 CSS px取整容差，同时保留松手前后<0.1 CSS px的严格不跳变断言。run29在1d50467上154 Node通过、94/95 Chrome通过；trace确认取消/无变化均无存档写入，唯一失败为新测试点击导入后本应禁用的Undo而超时。修正为明确断言禁用，再执行有效排序验证一击撤销；没有放宽产品行为或延长超时。run30全绿。

下载并实际查看 artifact **12563339017**（产品提交856471b，SHA256 `4cd0736fd7faa04a4c52a95bd59a9adae9c6ea00f8095d733638996587956eaf`，保留至2026-11-07 UTC）：

| 原始PNG | 验证范围 |
|---|---|
| [布局拖动排序](screenshots/m1-flow-reorder.png) | 换行Flex、半透明图层、同父插入线、全局顺序提示和Inspector前后按钮 |
| [断点范围总览](screenshots/m1-breakpoint-overview.png) | 500px预览、≤600当前效果与基础编辑范围独立、数值范围拒绝反馈 |

PNG直接从该artifact保存，未裁剪或重画。断点图夹具刻意使图层超过画板边界以区分预览效果与基础尺寸，本图不用于证明无溢出；排序图保留布局占位，未承诺实时重排其他兄弟。检查的是Chrome，未新增其他引擎/真机、像素golden或WCAG认证。


### M1 alpha.6 · 连续研发与三引擎验收（2026-10-25 Asia/Shanghai）

产品代码 **8b5dafa4abcabc1a74d55c312dcffd257cb2a1ad**，版本 **0.2.0-alpha.6**。[CI run36](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40113832454)四个job均success：

| 检查 | 实际结果 | 环境 |
|---|---|---|
| Node | 187通过，0失败 | Node22 CI |
| Chrome | 124通过，0跳过，约1.8分钟 | Google Chrome155.0.8059.39 / Linux x64 |
| Firefox | 118通过，6项明确跳过，约1.3分钟 | Playwright Firefox157.0 / Linux x64 |
| WebKit | 118通过，6项明确跳过，约2.5分钟 | Playwright WebKit27.2 / Linux x64 |

6项像素检查只针对经审阅的Chrome/Linux基准：Studio三个浏览器视口390/768/1440、明/暗工作台，以及先匹配原图、再制造12px偏移并要求检出的负向对照。其他两引擎各自执行同样118项交互；没有把跳过计作通过。WebKit的Safari样式UA不代表运行了用户Mac或iOS真机，实际平台由browser-version.json记录。

新增覆盖节点局部撤回（文字/富文本成组、实例变体成组、叶字段子集）、后续编辑冲突、锁定/缺资源/ID碰撞拒绝、删除与批注恢复、父级/子层顺序保护、Undo/Redo/刷新边界；全页断点的嵌套/源投影/实例覆盖剔除、搜索分页、真实预览、定位到实际可编辑owner、来源JSON下载。导入测试证明保留当前工程、拒绝伪造渲染内部元数据和非法显示名称，原合法自定义元数据不被删除。

历史检查点和实际失败：

| Run / 产品提交 | 结果与修正 |
|---|---|
| run32 / 7ef5988 | 176 Node + 109 Chrome全通过，节点历史首轮 |
| run33 / 8123413 | 183 Node + 115 Chrome全通过，全页断点首轮 |
| run34 / 28dbfa8 | Chrome115通过；Firefox111/115、WebKit112/115。捕获引擎布局量化带来的累计0.01坐标漂移、整数鼠标事件导致的1px指南差异，以及WebKit测试在手柄异步重绘前读取boundingBox。 |
| run35 / c1337b0 | 184 Node通过；Chrome121通过但此轮显式自动生成基准，尚不算严格像素验收；WebKit116交互通过，5像素视图跳过；Firefox114/116，剩精度两项。 |
| run36 / 8b5dafa | 187 Node、124/118/118三引擎通过；禁止自动更新，严格比较及差异检出成功。 |

位置计算改为对既有设计值叠加实测位移，连续40次前后微调在真实浏览器回到原坐标，纯函数100次迭代保持精确；吸附继续从准确目标反解。参考线测试观察真实pointermove坐标，要求与目标屏幕点的差异小于一个屏幕像素再精确核对存档；拖动测试也从真实pointerdown/move计算输入，并保留松手前后<0.1 CSS px的严格断言。WebKit手柄测试使用稳定hover动作后再量测，不用固定延时，也未放松保存/撤销/锁定断言。

#### 原始证据与像素基准来源

- 基准捕获artifact **12567431230**，来源c1337b0/run35，SHA256 `4d9d79c51de2d4e092d8b46e19bbd5a6a8476a1aed9a2e9cbb8ef62fb56a9a6b`。5张PNG均实际下载、逐张查看后直接提交到`tests/browser/visual-baselines.spec.mjs-snapshots/`；同份artifact的[节点历史](screenshots/m1-node-history.png)和[整页断点](screenshots/m1-board-breakpoints.png)也已人工查看并直接保存。
- run36 Chrome artifact **12567159565**，SHA256 `b57c77d9994176b56336b17d63c0a9c12c17ea50d96ba5307e7a61e18683453e`。严格匹配上述基准，额外12px偏移对照通过。
- run36 Firefox artifact **12567154629**，SHA256 `02bf55a7a5a346723b9ed177134d6a0ebd9f6fa0c50c2dc5c13f00c6a4f74db5`；实际查看并保存[Firefox全页断点](screenshots/m1-board-breakpoints-firefox.png)。
- run36 WebKit artifact **12567508376**，SHA256 `0b748cba8c428489464f31db79e4c975295da93676998654b2d87452d8d62441`；实际查看并保存[WebKit节点历史](screenshots/m1-node-history-webkit.png)。

这些artifact均已下载，读取实际启动版本；正常CI不使用`--update-snapshots`，配置为`updateSnapshots: none`。基准容许不同像素比例0.001，颜色阈值采用Playwright默认0.2。它约束固定视图，不承诺所有设计的美观、完整WCAG、AI视觉评审、真实移动触屏或原生Safari。运行/基准维护方式依据[Playwright官方CI](https://playwright.dev/docs/ci)和[视觉比较文档](https://playwright.dev/docs/test-snapshots)，未引入第三方设计源码。

原Orbit再次验证为3画板/170节点/hash21a89182；11个工程往返、旧Patch、原成熟回归和CLI导出保持。


#### alpha.6 组件源锁定补充复验

代码复查发现历史恢复入口只校验工程合法性，可能绕过后续新增的组件源锁定。`5a17130` 复用核心 `assertOverrideEditAllowed`，在字段预览与候选工程最终提交前执行同一保护；覆盖现有实例、变体/覆盖原子组和删除实例恢复，不扩大 Patch 权限。

run37 在5a17130：190 Node通过；Chrome124/125、Firefox和WebKit各118/119交互通过。唯一新用例未接管“更新变体”prompt，被浏览器默认取消，因而根本未锁定定义；断言保持不变，补为明确选择既有base变体。修正提交 **47550d482f02b025964a792288d7f0186f9250b0**，[CI run38](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40115199604)四个job全success：**190 Node、Chrome125（1.3分钟）、Firefox119（1.2分钟）、WebKit119（2.5分钟）通过**；后两者各6项Chrome像素检查明确跳过。原5张像素基准和负向检出对照继续严格通过，不自动更新。

新增3项Node、1项真实三引擎回归，证明锁定覆盖被阻止时，无关实例名称仍可独立恢复；候选工程和当前源锁定不变。此补验沿用前述run35/run36截图和基准来源，未把旧截图标成新run生成。


### M1 alpha.7 · 专业属性与组件创作（2026-10-25 Asia/Shanghai）

已通过检查点 **a5038a08a515925f8d855de622c9df5e8eb67c53**，[CI run45](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40117664682)四job全success：**200 Node + 134 Chrome + 128 Firefox + 128 WebKit通过**；Firefox/WebKit各6项Chrome专属像素检查明确跳过。Chrome1.3分钟、Firefox1.6分钟、WebKit2.7分钟。128项相同功能用例与6项Chrome像素用例分别统计，不把重复引擎执行算成独立场景。

- 实测Inspector尺寸与参考值分离，Fill/Hug、缩放、预览、隐藏、数值编辑范围及另一轴模式、异步reflow保持一致；读取/预览不改项目或历史。
- 明暗模式指定Inspector文字/画布帮助的实际计算色对比度至少4.5，仅限测试列出的文字，不是全面WCAG认证。工作台CSS不改变用户画板。
- 完整历史值按需展开，恶意HTML样式长文本仅显示为文本；完整尾部、当前/恢复值和下载报告逐项核对。点击文字/展开/导出不改变撤回勾选或项目，不新增Undo步骤。
- 组件与变体复制/重命名/删除、所有画板声明引用数、最后变体/被引用/源锁定保护、库包往返、名称转义及Undo/回读。
- 源副本编辑后更新准确变体，保留实例后续覆盖和其他画板；删除已覆盖的源层会原子拒绝更新，不删用户覆盖；失败不新增历史。实际叶子根按钮保留BUTTON语义和源文字，解除关联后的普通按钮不带容器children字段，Undo/Redo/刷新均通过。

历史失败和修正均保留：

| Run / 提交 | 实际结果及修正 |
|---|---|
| run40 / 393db07 | 190 Node通过；Chrome127/130、Firefox/WebKit各123/124功能通过。新断言误把≤600范围的fixed写入当作应修改基础Fill；按真实编辑范围核对基础Fill保留及断点fixed。另两项Chrome工作台像素差异为预期UI改变，下载actual.png逐张查看后更新仅两张基准。 |
| run41 / 78e2fd7 | 190 Node、Chrome130、Firefox/WebKit各124全部通过，严格像素比较及12px差异检出成功。 |
| run42 / 7b63013 | 200 Node通过；Chrome132/133，历史details异步toggle尚未填入pre就被测试JSON.parse；改为等待完整尾部内容，不加固定等待。Firefox/WebKit各127交互通过；三项组件管理流程在三引擎通过。 |
| run43 / c90bcc1 | 四job全success，叶子源按钮类型/文字和从Tokens转入源编辑通过；此轮还未覆盖解除关联。 |
| run44 / cab86b7 | 200 Node通过；Chrome133/134，新增解除关联用例在隐藏的画板列表上等待超时。trace最后动作明确为组件页签内点击data-board；先切到图层页签再选择画板，断言和超时未放宽。 |
| run45 / a5038a0 | 200/134/128/128通过，包含叶子源编辑、解除关联及完整Undo/Redo/回读。 |

#### 原始PNG和基准变更来源

- run40 Chrome artifact **12568551988**，SHA256 `1c41214552a4413b936affb23a9da8ef6cc0b23e67fb34f8bffeac8c7046c145`。两张工作台actual PNG和[实测尺寸](screenshots/m1-inspector-measurements.png)、[完整历史差异](screenshots/m1-history-full-review.png)均实际下载查看后直接保存，未裁剪或编辑。原三个Studio导出golden不改，常规CI一直禁止自动更新。
- 完整历史图刻意使用超长且包含HTML样式标记的恶意文字，原夹具是固定60px文本盒，画板文字溢出是压力输入；该图证明安全展示和完整字段查看，不用于证明夹具排版无溢出。
- run45 Chrome artifact **12570096646**，SHA256 `fc5538809a4e81c47f7317400acd00a1e1cb8b6a0814670701f380a10d26dd97`；该轮组件原图已下载查看，最终提交的组件图改取下述run47；版本文件证明Chrome155.0.8059.39、Playwright1.64.1、Linux x64。

原Orbit验证仍为3画板/170节点/hash21a89182，当前CLI审计/三画板HTML导出完成。未运行用户Mac、生产环境或部署；没有将设计/密钥送入外部模型。


#### alpha.7 最终视觉复核与验收

`75d537283d22e34b3d452fda9a45a1209ce9cdad`显式观察border-box；[run46](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40118025162)通过200 Node、Chrome134（1.7分钟）、Firefox128（1.4分钟）、WebKit128（2.8分钟），后两者各6跳过。新增边框场景保持content box不变但增加16px外盒，读数须异步刷新，项目/历史不变。

实际查看该轮Firefox组件和WebKit尺寸PNG，发现WebKit属性select的原生绘制使文字垂直裁切，虽然既有功能测试通过。`5dd72a46eb909a12a173f01f819214a42f1861a9`统一Inspector select的appearance、垂直留白与CSS箭头，保留原生select语义；增加明暗模式下用实测字体行盒比较每个属性下拉框可用高度的断言。

最终产品代码 **5dd72a46eb909a12a173f01f819214a42f1861a9**，[CI run47](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40118816678)所有job成功：

| 检查 | 实际结果 | 实际环境 |
|---|---|---|
| Node | 200通过，0失败 | Node22 CI |
| Chrome | 134通过，0跳过，2.2分钟 | Chrome155.0.8059.39 / Linux x64 |
| Firefox | 128通过，6明确跳过，1.4分钟 | Playwright Firefox157.0 / Linux x64 |
| WebKit | 128通过，6明确跳过，2.8分钟 | Playwright WebKit27.2 / Linux x64 |

三套artifact均实际下载、读取browser-version.json，Playwright1.64.1；下列原图逐张查看，确认WebKit下拉文字完整后直接保存，无裁剪/重画。WebKit的Macintosh UA不代表用户Mac或Safari真机。

| Artifact | SHA256 | 保存的原始PNG |
|---|---|---|
| Chrome12569704171 | 2f55d9b7a4d1ecd5eb7ef674c4fc700b9ed3f6e6e7aefa506d6cafc5d674e91b | [组件管理/源副本](screenshots/m1-component-management.png) |
| Firefox12569634006 | cc88a93ebad2025c6b0adc56a0e797841bb59e1283bd6b814aef33d49d1becd6 | [Firefox组件管理](screenshots/m1-component-management-firefox.png) |
| WebKit12569259300 | b2bab53292fee01ad9856447c3e0fed71518e89bde0f1dd2bfa95f441f1b2c20 | [WebKit尺寸/下拉](screenshots/m1-inspector-measurements-webkit.png) |

本轮没有调高像素阈值或再次自动更新；既有5个视图和12px负向对照继续通过。人工原图检查发现的UI缺陷与自动化通过结果分别记录，不把测试全绿等同视觉完美。最后文档/截图提交后仍须核对PR head的CI；功能代码与此检查点相同。
