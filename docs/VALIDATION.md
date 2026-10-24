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
