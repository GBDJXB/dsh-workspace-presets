# docs

本目录记录 `dsh-workspace-presets` 插件重构前的信息收集与版本控制决策。

**本目录属于插件仓库本身。** 仓库根就是 `D:\DSH\plugins\dsh-workspace-presets`（该路径即插件包根，同时也是本次会话的工作区），两份文档随本仓库提交。旁边的 `D:\DSH\plugins\DeepSeek-Balance-Whale-Widget` 是**另一个**独立仓库，与本目录无关。

| 文档 | 内容 | 何时改 |
|---|---|---|
| [FUNCTIONAL-INVENTORY.md](./FUNCTIONAL-INVENTORY.md) | 插件功能清单：11 个功能单元、外部 DSH 契约、现状问题、可复用与待确认项 | 重写需求变化时 |
| [GIT-STRATEGY.md](./GIT-STRATEGY.md) | 版本控制决策：仓库/分支/tag/版本号/仓库卫生，以及已执行与剩余步骤 | 重写范围或发布方式变化时 |

## 计划与实际交付的差距（先读这段）

下表是 2026-09-26 定案、但**截至 2026-09-27 并未执行**的重写计划。实际交付的是 `38ea186`（0.2.1）：把现有实现修到能在当前 0.1.7 线上跑通，`dsh web` 已实机验证可用。细节与证据见 `GIT-STRATEGY.md` 第 7 节。

| 定案项 | 状态 |
|---|---|
| 重写只支持新版 DSH（0.1.7 一代），不再兼容 0.1.5 | **未执行** — 0.2.1 保留了 0.1.5 适配分支 |
| 改为 Host 侧在会话创建时盖章 preset，替代客户端协调器 | **未执行** — 仍是 `shell.overlay` 协调器；可行性已证实（`ctx.on('session/created')`） |
| Web 半边改用 `plugins.item`/`configForms` 官方表单 | **未执行** — 仍是自注册 `settings.section` + 自绘控件 |
| Git 按 `GIT-STRATEGY.md` 执行 | **部分执行** — `v0.2.0` 锚点 tag、`48e5ff1` 仓库卫生、`feat/rewrite` 分支已就位；`1.0.0` 合入与推送未做 |

调查对象与时间点：
- 插件工作树 `D:\DSH\plugins\dsh-workspace-presets`，基线 `9a077fb`（0.2.0，即 tag `v0.2.0`）。文档中的行号与文件大小均相对该基线；当前代码是 `feat/rewrite` 上的 `38ea186`（0.2.1），行号已漂移。
- 运行时实例：DSH Desktop 2.0.15（内嵌 `dsh --version` = 0.1.7-rc.2）；`dsh web` profile（以 `link:` 装载同一插件）。后续实机验证表明**当前 `dsh web` 也是 0.1.7 线**，原先「web 是 0.1.5 一代」的假设已作废。
