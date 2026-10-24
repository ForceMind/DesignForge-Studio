# M1 第一阶段交付验收

日期：2026-10-24（Asia/Shanghai）。版本：0.2.0-alpha.5。产品代码：856471b0796ee179a25951d903844c56e7c97b26。[PR #1](https://github.com/ForceMind/DesignForge-Studio/pull/1)，分支 codex/m1-editor-foundation；稳定 main 仍为 M0。

本表对应用户要求的第一阶段八项工程交付。结论是这些基础交付已完成验收；不会把长期路线中尚未实现的增强项改写为已完成。

| 交付 | 实际结果 | 验证证据 |
|---|---|---|
| 可运行改进工作台 | Node本地启动、明暗模式、层级/画板/Inspector同步、完整编辑流程 | HTTP smoke及真实Chrome编辑、保存回读/恢复、导出下载 |
| 真正可编辑组件树和布局 | 嵌套容器、Flex/Grid、Fixed/Fill/Hug、五类约束、断点范围、组件/变体/实例 | tree/responsive/group/richtext/flow-layout单测及实际CSS/几何断言 |
| 兼容已有数据 | v1继续使用；可选嵌套/分段/设计系统数据，原Orbit不变 | Orbit 3画板/170节点/hash21a89182，原Patch和回归全部保留 |
| 可复用设计系统 | Token/alias/字体/主题、实例源后代覆盖/恢复、本地库包前缀隔离与冲突拒绝 | 真实库下载→另一项目导入→插实例渲染；主题/字体/资产引用单测 |
| 可操作示例 | 原Orbit + 10个M1工程，Desktop/Mobile与横竖游戏HUD；Studio.library.json | 11工程JSON往返、全部HTML渲染，Studio390/768/1440原稿/中文长文及约+30%压力场景边界 |
| 测试及可验证结果 | 158 Node + 99 Chrome全部通过；实际截图复核 | [CI run30](https://github.com/ForceMind/DesignForge-Studio/actions/runs/40103132608)，VALIDATION.md |
| 架构/路线/缺陷文档 | 模块、协议扩展、投影预算、当前能力边界和历史失败记录已更新 | ARCHITECTURE / PATCH_PROTOCOL / ROADMAP / KNOWN_ISSUES / VALIDATION |
| GitHub提交及PR | 独立分支持续提交，PR可审阅，不替换稳定main | PR #1、产品代码及后续文档提交；具体head以GitHub为准 |

## 实际操作

1. 在分支 codex/m1-editor-foundation 上运行 npm start，打开终端输出的loopback地址。测试工具用 npm ci 安装。
2. 打开Studio，树中选节点，修改布局/文字；Shift多选同父自由图层并拖尺寸手柄，Esc取消，Undo/Redo及刷新回读。
3. 在Flex/Grid父级内单选图层拖动排序，或用Alt+方向键；Esc/移出父级取消，松手一次Undo。点击断点范围条切换修改范围，输入宽度只预览且不增加历史。从标尺拖出参考线；画板设置修改数值/锁定/隐藏；Inspector选择基础/断点范围并恢复字段继承。
4. 文字框选字符应用样式，改变内容保留前后格式；节点可选字体/字体Token及行高。
5. 组件面板导出/导入Studio.library.json，使用命名空间避免覆盖；插实例，修改源后代属性后单字段恢复。
6. 检查面板运行浏览器几何检查或“模拟文字+30%”，后者只在离屏副本运行；导出实际/模拟结果及上下文，编辑后旧结果显示过期。

## 明确边界

- 多选缩放限同父自由图层的基础样式，调整盒子与间隙；不等于字体/后代内容整体栅格缩放。实测组合会将参与根尺寸固定，Undo保留原布局；几何断点覆盖等无法无损情况拒绝。
- 设计系统为受限本地包，不是完整DTCG或在线库版本同步；定义内不支持嵌套实例。富文本不是HTML或完整段落排版引擎。
- DOM碰撞是建议，可能是有意叠放；当前只验证Chrome及列明视图，未完成Firefox/WebKit/真机/触屏、像素golden、完整WCAG；文字压力不是全语言覆盖。
- AI调用/BYOK、截图/HTML重构、视觉Diff审批/三方合并仍是M2；React/Vue与原型导航等仍是M3。当前保留严格Patch闭环，不宣称内置AI已完成。

最新截图：[布局排序](screenshots/m1-flow-reorder.png) · [断点范围](screenshots/m1-breakpoint-overview.png) · [文字预检](screenshots/m1-text-expansion.png) · [检测面板](screenshots/m1-audit-final.png)；其他alpha.4原始截图来源和历史失败记录见VALIDATION.md。

alpha.5 新增的排序仅限单选同父；断点范围图仅列本节点，不是整页聚合。独立预览与无变化排序不写项目/历史；真实拖动、锁定、实例、取消/重载/导出及范围边界回归均已通过。范围截图的测试图层刻意宽于父画板边界，证明预览与修改范围独立，不证明该夹具没有溢出。
