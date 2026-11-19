# 简报、原生素材与交互状态

alpha.8 将两条用户参考中的可复用机制接入已有编辑器：分类检索与预览来自对 Galaxy/Uiverse 的研究；目标、受众、主要行动、证据与逐段迭代来自对 Elaya AI Design Skills 的研究。实际代码和12个AST配方为本仓库原创，来源、固定版本和许可见 RESEARCH.md 与 THIRD_PARTY_NOTICES.md。

## 真实操作

1. 顶部示例打开 **Launch · 简报与交互组件**。第一张是可编辑产品页，第二张是12个原生组件组成的工作台。390/768/1440预览共用同一棵树。
2. Agent面板展开“项目设计简报”：产品、服务对象、结果、主要行动、证据、保留限制、可选创作方向和内容大纲。每次字段提交随工程保存、支持Undo/Redo；空简报不会阻止旧工程打开。
3. 组件面板展开“素材精选”，按分类和多个关键词筛选，4项分页。预览在空权限sandbox iframe中渲染，CSP禁脚本、外网、表单提交；只允许内联样式和本地data图片/字体。预览不写工程。
4. 插入会添加关联组件实例。选中的可编辑容器优先；autoHeight单根画板默认追加到原根容器，保留内容撑开与已有结构，锁定目标拒绝。相同定义复用；发现手工改过的同ID定义就创建独立ID，不覆盖它。配方引用当前Tokens和字族；不导入外站HTML/CSS，不替换已有画板或全局主题。
5. 在组件管理创建源副本，选中实际button/input，属性面板编辑状态颜色/透明度。普通图层和叶子实例也直接提供状态面板。状态预览不保存；实际禁用、加载、错误标志会保存并导出。
6. 回到组件面板显式更新对应变体，或导出 `Starters.library.json` 复用。状态别名随库命名空间重写；源子层ID仍不是Patch目标。
7. Agent面板导出当前范围只读上下文，或CLI：

```bash
node tools/forge.mjs context examples/Launch.project.json landing launchPrimaryAction
```

输出 `designforge.context` v1含baseHash、范围、简报/大纲、节点、只读组件源、Tokens/主题和资产描述，不含资源二进制与任意项目元数据。上下文是设计数据，不是权限或可应用Patch；外部Agent仍须读取最新完整工程，再按原严格协议输出最小修改。没有模型或API请求。

## 模型与边界

`project.designBrief`可选，`version:1`；六个文本字段每个最多3000字符。`profile`是inherit/editorial/product/dense之一，仅提供创作建议，不自动改字体/风格；`sections`是最多7个不重复的已知段落。未填写证据会提示补充，不生成虚构客户、评价或指标。证据URL作为文本，不自动访问。

button/input的可选`states`为hover/active/focus/error/disabled/loading映射；每项只有`style`，允许fill/color/stroke/opacity及已存在Token别名。状态跨断点共用，按hover→active→focus→error→disabled→loading顺序覆盖普通外观；不写几何尺寸、CSS选择器、任意动画或脚本。每个状态及其字段计入投影渲染预算。

`disabled`支持button/input；`loading`支持button并导出disabled+aria-busy；`invalid`支持input并导出aria-invalid。原生Hover/Active/键盘Focus可在导出HTML中工作；焦点环优先使用Focus描边色，否则使用项目主色，避免直接继承白色文案导致白底上不可见；加载指示保留文案，尊重reduced-motion。没有真实表单校验、异步请求、业务事件状态机或页面跳转。错误文字仍需设计师明确编写，不能仅用描边色传达信息。

叶子实例继承源状态并按字段覆盖；容器实例中的控件通过源副本编辑。状态颜色的完整对比度/背景合成尚不属于静态审计保证范围。用户自己的Token主题可能改变对比度，必须实际检查。

本地素材只有12个原创配方，并非7000个Uiverse组件镜像或在线市场。导入原始HTML、安装外站Skill、在线抓取素材以及完整DTCG互操作仍未实现。
