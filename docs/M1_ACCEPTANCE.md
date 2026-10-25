# M1 第一阶段交付验收

日期：2026-10-25（Asia/Shanghai）。版本：0.2.0-alpha.8。最新产品/CI见VALIDATION当前章节；历史alpha.7代码5dd72a46已保留。[PR #1](https://github.com/ForceMind/DesignForge-Studio/pull/1)，分支 codex/m1-editor-foundation；稳定 main 仍为 M0。

本表对应用户要求的第一阶段八项工程交付。结论是这些基础交付已完成验收；不会把长期路线中尚未实现的增强项改写为已完成。

| 交付 | 实际结果 | 验证证据 |
|---|---|---|
| 可运行改进工作台 | Node本地启动、明暗模式、层级/画板/Inspector同步、完整编辑流程 | HTTP smoke及真实Chrome编辑、保存回读/恢复、导出下载 |
| 真正可编辑组件树和布局 | 嵌套容器、Flex/Grid、Fixed/Fill/Hug、五类约束、断点范围、组件/变体/实例 | tree/responsive/group/richtext/flow-layout单测及实际CSS/几何断言 |
| 兼容已有数据 | v1继续使用；可选嵌套/分段/设计系统数据，原Orbit不变 | Orbit 3画板/170节点/hash21a89182，原Patch和回归全部保留 |
| 可复用设计系统 | Token/alias/字体/主题、实例源后代覆盖/恢复、本地库包前缀隔离与冲突拒绝 | 真实库下载→另一项目导入→插实例渲染；主题/字体/资产引用单测；12项原生素材检索/预览/插入，状态随库导出 |
| 可操作示例 | 原Orbit + 11个M1工程（含Launch双画板），Desktop/Mobile与横竖游戏HUD；Studio.library.json / Starters.library.json | 12工程JSON往返、全部HTML渲染，Studio390/768/1440原稿/中文长文及约+30%压力场景边界 |
| 测试及可验证结果 | alpha.8本地219 Node通过；三引擎验收及实际截图复核见当前VALIDATION记录 | [CI run49](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40197963027)及最新VALIDATION.md |
| 架构/路线/缺陷文档 | 模块、协议扩展、投影预算、当前能力边界和历史失败记录已更新 | ARCHITECTURE / PATCH_PROTOCOL / ROADMAP / KNOWN_ISSUES / VALIDATION |
| GitHub提交及PR | 独立分支持续提交，PR可审阅，不替换稳定main | PR #1、产品代码及后续文档提交；具体head以GitHub为准 |

## 实际操作

1. 在分支 codex/m1-editor-foundation 上运行 npm start，打开终端输出的loopback地址。测试工具用 npm ci 安装。
2. 打开Studio，树中选节点，修改布局/文字；Shift多选同父自由图层并拖尺寸手柄，Esc取消，Undo/Redo及刷新回读。
3. 在Flex/Grid父级内单选图层拖动排序，或用Alt+方向键；Esc/移出父级取消，松手一次Undo。点击断点范围条切换修改范围，输入宽度只预览且不增加历史。从标尺拖出参考线；画板设置修改数值/锁定/隐藏；Inspector选择基础/断点范围并恢复字段继承。
4. 文字框选字符应用样式，改变内容保留前后格式；节点可选字体/字体Token及行高。
5. 组件面板导出/导入Studio.library.json，使用命名空间避免覆盖；插实例，修改源后代属性后单字段恢复。
6. 打开Launch，在Agent面板保存简报与证据、导出当前范围上下文；素材分类搜索、插入、源副本编辑状态、Undo/回读。
7. 检查面板运行浏览器几何检查或“模拟文字+30%”，后者只在离屏副本运行；导出实际/模拟结果及上下文，编辑后旧结果显示过期。

## 明确边界

- 多选缩放限同父自由图层的基础样式，调整盒子与间隙；不等于字体/后代内容整体栅格缩放。实测组合会将参与根尺寸固定，Undo保留原布局；几何断点覆盖等无法无损情况拒绝。
- 设计系统为受限本地包，不是完整DTCG或在线库版本同步；定义内不支持嵌套实例。富文本不是HTML或完整段落排版引擎。
- DOM碰撞是建议，可能是有意叠放；已验证列明的Chrome/Firefox/WebKit Linux交互与5张Chrome像素基准；真机/触屏、原生Safari、完整WCAG仍未完成，文字压力不是全语言覆盖。
- AI调用/BYOK、截图/HTML重构、视觉Diff审批/三方合并仍是M2；React/Vue与原型导航等仍是M3。当前保留严格Patch闭环，不宣称内置AI已完成。

最新截图：[组件管理/源副本](screenshots/m1-component-management.png) · [实测尺寸](screenshots/m1-inspector-measurements.png) · [完整历史差异](screenshots/m1-history-full-review.png) · [节点历史](screenshots/m1-node-history.png) · [全页断点](screenshots/m1-board-breakpoints.png) · [Firefox来源定位](screenshots/m1-board-breakpoints-firefox.png) · [WebKit历史](screenshots/m1-node-history-webkit.png) · [布局排序](screenshots/m1-flow-reorder.png) · [断点范围](screenshots/m1-breakpoint-overview.png) · [文字预检](screenshots/m1-text-expansion.png) · [检测面板](screenshots/m1-audit-final.png)；其他alpha.4原始截图来源和历史失败记录见VALIDATION.md。

alpha.5 新增的排序仅限单选同父；本节点范围条展示单节点，alpha.6 的画板断点面板聚合整页来源。独立预览与无变化排序不写项目/历史；真实拖动、锁定、实例、取消/重载/导出及范围边界回归均已通过。范围截图的测试图层刻意宽于父画板边界，证明预览与修改范围独立，不证明该夹具没有溢出。


alpha.6补齐会话节点历史、整页断点来源聚合、三引擎CI及Chrome像素回归。历史最多35份完整快照且有总字符预算，刷新或文件导入会重新开始；不是长期版本服务。Firefox和WebKit各119项交互通过，6项Chrome专属像素检查明确跳过；Chrome125项包括同样119项交互、5个正向像素视图和1个12px偏移检出对照。

补充安全回归：后续锁定组件源后，历史局部恢复仍复用 Patch 的源层/祖先锁定保护；无关实例名称可独立撤回。恢复已删除的实例也不能把覆盖写回已锁源层。


alpha.7继续完成专业属性反馈和组件创作，实际操作：

7. 选Fill/Hug文字，对照参考W/H、实际布局读数和画板预览；数值改宽只固定当前编辑范围的宽轴。预览/缩放/异步盒子变化不增加撤销记录。
8. 历史预览中展开完整值或导出只读review JSON；长文本不截断，点击文字不误切勾选。报告不是可应用的Patch。
9. 组件面板展开管理，重命名/复制组件与变体；被引用项、最后变体或锁定源不可删除。创建源副本后使用完整图层编辑器，选源根、在相应变体点“更新此变体”。副本作为普通画板保留/导出；实例自定义内容不丢失，悬空覆盖拒绝更新。叶子根按钮可更新并解除关联为普通按钮，Undo/Redo/回读保持。

此流程不等于独立主定义编辑模式、嵌套实例、多属性变体矩阵或来源三方合并；更新定义目前用整体Undo，专用可视化审批待后续。

最终补验还覆盖只改变边框的异步盒子尺寸同步；实际查看WebKit截图发现下拉文字裁切后，统一控件绘制并核对文字行盒可用高度。修复后Chrome/Firefox/WebKit全部通过，新原始截图已保存；未调宽像素容差。
