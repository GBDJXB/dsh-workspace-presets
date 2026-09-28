# dsh-workspace-presets 版本控制决策

> 结论先行：**在现有仓库、现有主线上重写，不另起仓库**；重写以「最后一个双代兼容版」打 tag 作为回退锚点，历史保留、不清理。理由与操作步骤见下。
>
> **调查时间点基线**：工作树 HEAD `9a077fb`，`git status` 干净，`main` 领先 `origin/main` 1 个提交，远端不可达（`git ls-remote` 因本机凭据 `SEC_E_NO_CREDENTIALS` 失败，未做推送验证）。
>
> **已定案（用户决定）**：目标只支持新版（0.1.7 一代 / Desktop 2.x / 新版 `dsh web`），不再兼容 0.1.5；重写允许改为 Host 侧盖章会话 preset（先验证可行性）；版本控制按本文执行。**注**：本节是当时的决策记录，实际交付与之有差距，见第 7 节。
>
> **已执行（本地，未推送，实时状态以 `git log` 为准）**：`v0.2.0` 锚点 tag 打在 `9a077fb`；`package-lock.json` 已 `git rm --cached` 并提交为 `48e5ff1`；`feat/rewrite` 从 `48e5ff1` 分支出去，并在其上提交了 `38ea186`（0.2.1 适配，见第 7 节）。因此 `main = 9a077fb`（`ahead origin/main 1`），`feat/rewrite = 38ea186`（`ahead main 2`）。**先前版本的本节把 `48e5ff1` 记在 `main` 名下，那是错的。**

---

## 1. 仓库现状

| 项 | 值（调查时间点 `9a077fb`） |
|---|---|
| 路径 | `D:\DSH\plugins\dsh-workspace-presets`（本身即插件包根） |
| 远端 | `origin` = `https://github.com/GBDJXB/dsh-workspace-presets.git` |
| 分支 | 仅 `main`（`origin/HEAD → origin/main`）；本文执行记录又建了 `feat/rewrite` |
| 提交 | 6 个，最早 2026-09-05，最新 2026-09-26 |
| tag | **无**（随后新建 `v0.2.0`） |
| stash | 无 |
| 跟踪文件 | `.gitattributes .gitignore LICENSE README.md README.zh.md client.js cordis.patch.yml host.js package-lock.json package.json scripts/mirror-agent-presets.mjs` |
| 待推送 | `9a077fb`（0.2.0，双代兼容 + 镜像脚本）尚未推送，`ahead 1` |

现行提交历史（截至 `9a077fb`；`38ea186` 之后的分支状态见第 7 节）：

```
9a077fb fix: support both DSH settings generations and mirror presets for 0.1.7   ← 未推送，main
74db0a6 fix: workspace preset won't override user's manual choice
6ad714a fix: adapt the client half to DSH 0.1.5 (settings panel + Remote wire)
e029837 Update README.md to include clearer English and Chinese instructions
e3fd5c4 Update .gitignore to include package-lock.json and modify README with correct GitHub username
24b9d8c Initial commit
```

## 2. 影响决策的四个既有事实

1. **包名与包路径是被引用的外部标识**。两个 profile 都以 `link:` 指向该目录并把它写进 `dsh.profile.bundles`：
   - `profiles/web/package.json`：`dsh-workspace-presets: link:D:/DSH/plugins/dsh-workspace-presets`，bundles 含 `dsh-workspace-presets`
   - `profiles/desktop/package.json`：同一 `link:`，bundles 含 `dsh-workspace-presets`
   改仓库名/包名要同步改两个 profile、README 的安装命令、`cordis.patch.yml` 的 `name:`——收益为零，成本越界到用户环境。
2. **工作树就是运行中的代码**。两个 profile 是链接安装，仓库 `node_modules` 同时是 link 解析目标（内含 schemastery 3.18.4）。任何 `git checkout`/`git clean`/分支切换都可能让正在运行的 profile 立刻缺依赖或换代码。
3. **重写不是 API 断裂，而是内部实现替换**。对外不变的部分：包名、`main`/`exports` 双面形状、`dsh.bundle.patch`、行 id `workspace-agent-presets`、落盘数据形态 `bindings: [{workspaceId, agentPreset}]`、`scripts/mirror-agent-presets.mjs` 的全部行为、设置页与协调器的用户可见语义。因此它是一次**大版本重写**，不是新包、不是新仓库、不是新 Git 历史。
4. **`main` 是用户安装来源**。README 的 GitHub 安装通道是 `dsh plugin --profile web add github:GBDJXB/dsh-workspace-presets`，即默认分支的 HEAD。默认分支不应长期停在会崩的旧实现上，也不宜在重写未完成时对外叫 1.0。

> 补充（调查后新增）：`.gitattributes` 只有 `* text=auto`；`dsh web` profile 的 `node_modules` 曾被清空三次。这两点都指向「工作树即运行时」这一脆弱性，也是下面把 tag 当作唯一快照机制的理由。
>
> 证据出处更正：先前版本把「清空三次」记在 `D:\DSH\plugins\DeepSeek-Balance-Whale-Widget\.dsh-repair\dsh-web-doctor.ps1` 名下，但该路径在当前机器上不存在（`Test-Path` 为 False），也没有留下可检索的替代记录。结论本身（曾被清空）来自当时的观察，**目前无法在这台机器上复核**；按此决策时请把它当作未复核背景，而不是可验证证据。

## 3. 决策

**D1 — 继续使用现有仓库与远端，不新建仓库、不重写历史。**
理由：事实 1 与 3。新仓库会打断 issue/PR 连续性与安装 URL，且重写没有任何需要洗掉的历史（6 个提交，无 secrets、无大文件；`package-lock.json` 是唯一需要清理的跟踪项）。历史保留的价值在于 `6ad714a`/`9a077fb` 两次契约适配的提交信息本身就是「DSH 契约怎么漂移」的一手证据。

**D2 — 「旧实现」的保留靠 tag，不靠分支。**（已按「只支持新版」定案收敛）
- tag `v0.2.0`：指向 `9a077fb`（最后一个双代兼容版），**已创建**。不可变回退锚点，`git worktree add` 或 `npm pack` 都能取回可发布快照。
- **不建任何 legacy 分支**：0.1.5 一代不再支持，也就不再有需要回补的旧代缺陷；需要旧实现时从 `v0.2.0` 起临时 worktree 即可。
- tag `v0.1.5-support-eol` 取消：目标已定为只支持新版，不需要「停止支持」这一标记点。

**D3 — `main` 就是重写线，重写在一个短生命周期分支上完成后再合入。**
- 从 `main` 开 `feat/rewrite`（**已创建**）。
- 重写期 `main` 不动；重写完成、两个 profile 都验证通过后合回 `main`。
- 对外版本号：**直接 `1.0.0`**。目标已定为只支持新版，不再需要 `0.3.0`（显式双代适配层）这一中间版本；`1.0.0` 的语义正好是「对外契约不变、内部实现与支持的 DSH 版本线同时换代」。

**D4 — 重写不做 git 历史手术，但必须做四项仓库卫生。**
1. ~~`package-lock.json` 被跟踪却写在 `.gitignore` 里~~ **已解决**：`git rm --cached package-lock.json`，提交 `48e5ff1`；文件保留在磁盘（本地 `npm install` 会重建），不再入库。
2. 统一 **行尾**：`.gitattributes` 只有 `* text=auto`；`host.js`/`client.js` 在当前工作树是 LF，Windows 侧编辑后容易混入 CRLF。重写首个提交里改为 `* text=auto eol=lf`，并对 `*.js`、`*.mjs`、`*.yml`、`*.md` 显式 LF。
3. `node_modules/` 已忽略（正确），但它是 link 安装的解析目标：**禁止在重写期间对该仓库执行 `git clean -xdf`**，并在 `README` 的开发段写明这一点（当前 README 只说「本地 npm install 会创建 node_modules，已被忽略」，未提 link 运行依赖）。
4. 每次验证通过的提交对应一个 tag（`v1.0.0-rc.N`），因为这台机器上「已安装 = 工作树」，tag 是唯一能把「当时能跑的那份」与后来编辑区分开的机制。

**D5 — 发布与安装通道不变。**
- npm 包名保持 `dsh-workspace-presets`（registry 上是否已发布未核实，推送前需确认版本占用）。
- 安装命令不变：`dsh plugin --profile web add dsh-workspace-presets` / `link:<path>` / `github:GBDJXB/dsh-workspace-presets`。
- 重写必须同时改：`README` 的「支持的 DSH 版本」徽章与安装说明、`package.json.description`、以及 `peerDependencies` —— 当前 5 个 peer 全部指向 `^0.1.5-rc.1`，与「只支持新版」的目标不符，属必改项。

## 4. 操作记录与剩余步骤

已完成（本地仓库，未推送）：

```powershell
cd D:\DSH\plugins\dsh-workspace-presets
git tag -a v0.2.0 -m "0.2.0: dual-generation support (DSH <= 0.1.5 settings namespaces, >= 0.1.7 per-entry config)"
git rm --cached package-lock.json           # → 提交 48e5ff1（在 feat/rewrite 上，不在 main）
git switch -c feat/rewrite                  # 当时分支；此后又提交了 38ea186
# 结果：main = 9a077fb（ahead origin/main 1），feat/rewrite = 38ea186（ahead main 2），tag v0.2.0 → 9a077fb
```

剩余（需网络/凭据，本机 `git ls-remote` 曾以 `SEC_E_NO_CREDENTIALS` 失败）：

```powershell
git push origin main
git push origin v0.2.0
# 若继续 1.0.0 重写：在 feat/rewrite 上完成后
git switch main
git merge --no-ff feat/rewrite -m "feat!: rewrite client half against current DSH contracts"
git tag -a v1.0.0 -m "1.0.0: rewrite for DSH >= 0.1.7 only; drops named-settings (<= 0.1.5) support"
git push origin main v1.0.0
# 若就此把已适配的 0.2.1 交付（见第 7 节）：
#   git switch main && git merge --no-ff feat/rewrite -m "fix: adapt both halves to DSH 0.1.7"
#   git tag -a v0.2.1 -m "0.2.1: runs on the current DSH 0.1.7 line"
#   git push origin main v0.2.1
```

若在重写期间需要临时回到可运行实现：`git stash`（不要 commit）或 `git worktree add <仓库外的临时目录> v0.2.0`，**不要**在两个 profile 链接的目录里做 checkout。

## 5. 明确不做的事

- 不新建仓库、不改包名/仓库名、不改远端 URL。
- 不用 `git filter-repo`/`rebase -i` 重写历史。
- 不建 legacy 分支、不建平行维护的第二个包（目标已定为只支持新版；若最终仍要双代，方案是同一个包里的显式适配层，而不是两个包——两个包会让 README 安装通道、`cordis.patch.yml` 行 id、绑定数据落点全部翻倍）。**注**：0.2.1 保留 0.1.5 适配分支并不违反这一条——它在同一个包里，属于「显式适配层」，不是第二个包。
- 不在重写未验证前把 `main` 指向新实现（`main` 是 GitHub 安装通道；`38ea186` 目前也仍在 `feat/rewrite` 上，见第 7 节）。
- 不把 `scripts/mirror-agent-presets.mjs` 拆成独立仓库：它与绑定的设置节名强耦合，拆开只会制造版本漂移面。
- 不删除 `host.js` 里的 `settings.register` 分支以外的历史证据：`6ad714a` / `9a077fb` 的提交信息记录了两次 DSH 契约漂移，重写时可作参考（保留历史，不清理）。

## 6. 与功能清单的接口

`docs/FUNCTIONAL-INVENTORY.md` 第 6 节列出「可复用 / 必须重写 / 待确认」。已定案的映射：

- **目标只支持新版** → 第 6 节的「若放弃 0.1.5 一代则 `host.js` 退化为导出 `Config` + 空 `apply`」成立，直接进 `1.0.0`，不设 `0.3.0`。（**未执行**：已交付的 `38ea186` 走的是保留双代适配的 0.2.1，见第 7 节。）
- **Host 侧盖章已证实可行** → 0.1.7 提供 `ctx.on('session/created', …)`（`dsh-session/lib/invariant.js:145`）与 `agent-preset/selected` 提交路径（`dsh-agent-preset-registry/lib/index.js:753-761`）。重写因此是「Host 半边新增会话创建时套用绑定」+「Web 半边改用 `plugins.item`/`configForms` 官方表单」，旧协调器与 `localStorage` 补丁删除。详见 `FUNCTIONAL-INVENTORY.md` §4.4-E。（**未执行**，同上。）
- 第 6 节「待确认」剩余项（目标 `dsh web` 走哪条线、`agentPresets.select` 首参兼容性、主题令牌与 `slots` 完整签名）必须在重写编码前定稿，否则重写会重复当前的「探测式兼容」错误。其中两项已由 `38ea186` 的实机验证回答，见第 7 节。
- **发布前的前置修复**：本机 DSH Desktop 安装树曾见空包目录（`resources/app/node_modules/@deepseek-ai/dsh-client-ui-slots` 0 文件），且 `profiles/web/node_modules` 有被清空的病史。对着损坏的树验证等于白验——`1.0.0` 的验收必须在干净安装上做。

## 7. 计划与实际交付的差距（2026-09-27 追加）

**结论：已交付的不是本文第 3、6 节描述的 `1.0.0` 重写，而是把现有实现修到能在当前 0.1.7 线上跑通的 `0.2.1` 适配。** 规划的 `1.0.0` 仍是未执行的意向；读第 3、6 节时不要当作已实现。

| 项 | 本文计划（第 3、6 节） | 实际提交 `38ea186`（0.2.1） |
|---|---|---|
| 支持代际 | 只支持 0.1.7，删除 0.1.5 路径 | 保留 0.1.5：`host.js` 的 `settings.register` 守卫、设置名回退链 `workspace-agent-presets → dsh-workspace-presets → workspace-presets` |
| 套用落点 | Host 侧在 `session/created` 盖章 | 仍是客户端 `shell.overlay` 协调器 + `localStorage` 手动优先补丁 |
| 设置界面 | `plugins.item` + `configForms` + 官方 `SettingsForm` 原语 | 仍是自注册 `settings.section` + 自绘 `<h2>`/`<select>` |
| 版本号 | 直接 `1.0.0` | `0.2.0 → 0.2.1` |
| 验收 | 两个 profile 各验证一次 | 仅 `dsh web`（用户确认可用）；Desktop 未验证 |

`38ea186` 实际修的内容（与本文计划的交集）：roster 行已无 `trust` 字段（改用官方同款内置判定）；设置名解析改为候选链并跟随应答名；`package.json` 补 `immediately` 与 `dsh-client-ui-layout`/`dsh-client-ui-slots`，`peerDependencies` 对齐 `0.1.7-rc.2`，`schemastery` 提到 `^3.18.4`；README 的「0.1.5 = web、0.1.7 = Desktop」错误对应关系被纠正；`Config.bindings` 的 volatile 注释补上「表单投影前提」这一真正原因。

**实机验证回填（来源：`dsh web` profile 在 0.1.7-rc.2 上装载 `38ea186` 并实际使用）**

- §4.4-D 的疑问 → **已解决**：`agentPresets.select(sessionId, presetId)` 在该线上被接受，协调器无需删除。远端首参在 Host 侧确实是 `Agent`，但浏览器侧仍按字符串 `sessionId` 传输（`dsh-agent-preset-registry/lib/typert.remote-client.d.ts` 的 `select(agentId: SessionId, agentPreset: string)`），所以签名差异不是兼容性问题。
- §6 第 1 项 → **已解决**：当前 `dsh web` **就是 0.1.7 线**（`dsh --version` = `0.1.7-rc.2`，web profile 的 `dsh.profile.bundles` 装载插件后 `dsh --profile web --dump-config` 能看到 host 行）。这也意味着 §4.4-A 那个 `dsh-client-ui-slots` 空目录是本机 Desktop 安装树的孤立损坏，不是 0.1.7 的契约变化。
- §4.4-G 的两项（主题令牌集合、`slots` 完整签名）**仍未核实**，但 0.2.1 的页面在浅色/深色下显示正常，说明现有 12 个 `--dsw-alias-*` 令牌在该线仍有效。

**若继续 1.0.0**：第 4 节的 `git worktree add <仓库外临时目录> v0.2.0` 仍是从当前状态回退到可发布旧版的正确做法；由于 0.2.1 已在 web 上跑通，`v0.2.1` 可作为「能跑的新基线」锚点（见第 4 节的备选命令）。
