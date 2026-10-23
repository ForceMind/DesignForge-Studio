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
- [第三轮 CI](https://github.com/ForceMind/DesignForge-Studio/actions/runs/39986223929)：50 Node + 24 Chromium 全部通过，包含鼠标拖动、纵向边界和实例文字覆盖。后续增加颜色取色器/Token 双入口回归，套件共 25 项；最终运行结果待实际完成后追加。

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
