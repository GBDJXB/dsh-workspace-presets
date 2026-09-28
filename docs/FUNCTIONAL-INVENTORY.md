# dsh-workspace-presets 功能清单（重构信息收集）

> 目的：在决定重写该插件之前，把「它到底做什么、靠哪些 DSH 契约实现、哪些部分与版本漂移无关」固定下来，作为重写的需求基线。
> 调查对象：`D:\DSH\plugins\dsh-workspace-presets`（工作树 HEAD `9a077fb`，工作区干净）。
> 两个运行时实例：`dsh web` profile 与 DSH Desktop 2.0.15（内嵌 `dsh --version` = 0.1.7-rc.2）。**更正**：当时认为 `dsh web` 是 npm 0.1.5 一代，实机验证表明它也是 **0.1.7-rc.2**；0.1.5 只作为代码里仍保留的适配分支存在。
> 本文描述的是基线 `9a077fb`（= tag `v0.2.0`）**当时的**实现，其中的行号、文件大小与代码引用都对应该提交，不是当前工作树。
> 已交付的适配 `38ea186`（0.2.1）与本文计划的差距见第 7 节；版本控制决策见 `GIT-STRATEGY.md`。
> 本文只描述现状，不含重构方案。

---

## 1. 一句话功能

给每个 workspace 绑定一个 Agent preset；该 workspace 之后新建的**空白**会话自动以该 preset 启动，用户手动选择的 preset 永远优先。

- 绑定关系是**插件自己的持久化数据**（不是 DSH 内建概念）。
- 落点：DSH 设置面板新增一页「工作区预设」（`Settings → Workspace presets` / `设置 → 工作区预设`）。
- 触发方式：**无 UI 的客户端协调器**（`shell.overlay` 里的透明组件）监听会话/工作区列表变化，对未开始的空白会话调用官方 `agentPresets.select`。
- 等价说法：DSH 的「全局默认 preset + 每个新会话手动选」被提升为「按工作区默认」，且不触碰已开始会话。

---

## 2. 交付物构成（基线 `9a077fb` 时的大小）

| 文件 | 基线大小 | 当前 `38ea186`（实测） | 角色 | 重写相关性 |
|---|---|---|---|---|
| `host.js` | 109 行 | 118 行 / 5,463 B | Host 半部分：唯一职责是**绑定关系的设置节**（两代 DSH 两种落盘方式） | 视目标 DSH 版本决定改写或保留 |
| `client.js` | 639 行 / 28.6 KB | 665 行 / 29,744 B | Web 半部分：手写 `window.__ModuleLoader__` bundle，含设置页 + 协调器 + toast + 双语文案 + 注入样式 | **重写主体**，几乎所有 DSH 契约都集中在此 |
| `cordis.patch.yml` | 36 行 | 36 行 / 1,667 B（未改） | bundle patch：向 profile 组合插入 host 行，行 id `workspace-agent-presets`（该 id 即 0.1.7 的设置节名，**承载契约**） | 契约需保留，写法可能改 |
| `scripts/mirror-agent-presets.mjs` | 371 行 | 371 行 / 16,463 B（未改） | 把 `~/.dsh/.agent-presets/<id>/agent.cordis.yml` 声明成 0.1.7 的 `@deepseek-ai/dsh-agent-preset` 行；可选 `--restore` 写回绑定 | **与 UI/设置漂移无关，可原样复用** |
| `package.json` | 67 行 | 70 行 / 1,964 B | 双面包清单：`main` → `host.js`，`exports["./client"]` → `client.js`，`dsh.bundle.patch`，`dsh.client`（platform/immediately/inject） | inject 列表需按目标版本重算 |
| `README.md` / `README.zh.md` | 246 / 244 行 | 251 / 249 行 | 安装、使用、两代差异、兼容性、故障排查 | 重构后需重写「支持的 DSH 版本」段 |
| `.gitignore` | 3 行 | 3 行（未改） | `node_modules/`、`*.log`、`package-lock.json` | 与 `package-lock.json` 曾被跟踪的状态矛盾，已由 `48e5ff1` 解决，见 `GIT-STRATEGY.md` |
| `.gitattributes` / `LICENSE` | 2 行 66 B / 21 行 1,091 B | 未改 | 样板 | 保留 |

「当前 `38ea186`」一列是 0.2.1 适配提交的实测大小，供对照行号漂移；本文其余章节的行号引用仍按基线 `9a077fb`。

无构建步骤、无 `lib/`、无生成物：仓库即发布包。

---

## 3. 功能单元清单（细到行为）

### F1. Host 侧绑定数据节（`host.js:28-109`）

| 项 | 内容 |
|---|---|
| 导出 | `name = 'workspace-presets'`（`host.js:30`）、`SETTINGS_NAMESPACE = 'workspace-agent-presets'`（`:39`）、`Config`（`:99`）、`apply(ctx)`（`:101`） |
| 数据结构 | `bindings: Array<{ workspaceId: string; agentPreset: string }>`，默认 `[]`（`:48-55`） |
| ≤0.1.5 路径 | `ctx.inject(['settings'], …)` 后若 `settings.register` 存在，则 `settings.register('workspace-agent-presets', BindingsSchema, { base: { bindings: [] } })`（`:105-108`）；`BindingsSchema` 是**非 volatile** 版本（`:92`） |
| ≥0.1.7 路径 | 导出 `Config`，其 `bindings` 字段被 `.volatile()` 包裹（`:79-99`）：该代把变更经 Loader 的 volatile 快路径提交进运行中配置，否则保存会被接受但静默丢弃 |
| 版本闸门 | 若 schemastery 无 `.volatile()` 则**抛错拒绝加载**（`:79-89`），`dependencies` 固定 `^3.18.4` |
| 惰性注入 | 故意不用硬 `inject: ['settings']`，让缺 `settings.register` 的部署仍能 apply（`:101-108`） |

### F2. 挂载与设置节命名（`cordis.patch.yml:34-36`）

- 声明 `- insert: [{ id: workspace-agent-presets, name: 'dsh-workspace-presets' }]`，由 `package.json.dsh.bundle.patch` 在 `dsh plugin add` 时调和进 `dsh.profile.bundles`。
- **行 id 是负载项**：0.1.7 的设置节名 = Loader 条目 id；客户端按名字查节，两边必须一致（`cordis.patch.yml:13-22`）。
- 客户端另有回退名 `workspace-presets`（0.1.7 之前手动挂载用的旧 id，`client.js:50`）。
- 文件内明确禁止 bundle 通道与手动 insert 并用（会双重挂载并在启动时报重复注册）。

### F3. 设置页「工作区预设」（`client.js:419-536`）

- 注册座位：`ctx.slots.inject('settings.section', …)` → `ctx.slots.register({ name:'settings.section', id:'workspace-presets', order:25, label:()=>t('nav'), locale:LOCALE_NS }, WorkspacePresetsPage)`（`:603-609`）。
- 页面状态机：`loading | ready | error | unavailable`（`:162-172`, `:430-441`）。
  - `unavailable`：`settings.describe()` 的 namespaces 里找不到本插件节 → 提示「Host 半部分未加载」。
  - `rosterEmpty`：部署未组合任何 preset。
  - 失败重试：最多 3 次、间隔 2000 ms（`:58-60`, `:291-297`）；`gateway/invocation-unavailable` 视为「无 preset」这一合法状态而非错误（`:303-315`）。
- 每行 = 一个工作区：标题 `workspace.title`、副标题 `workspace.path`（`:494-499`）。
- 选择器选项：首项「跟随全局默认({preset})」+ 全部**未损坏** preset（`broken === undefined`）+ 若绑定指向已消失/损坏 preset 则附加「`<id> · 已损坏`」项（`:469-490`）。
- 用户 preset 标记：基线里用 `preset.trust === 'user'` 显示 `· 用户`（`:481`）。**该字段在 0.1.7 的 roster 行里不存在**，所以这行标记从不渲染；`38ea186` 已改为官方同款的内置判定（见第 7 节）。
- 写操作：
  - 改绑定 → `settings.update(ns, { bindings }, revision)`（`:351-371`）→ 成功后 `refreshMeta()`。
  - 清空全部 → `settings.replace(ns, {}, revision)`（`:373-392`），按钮在无绑定或不可写时禁用（`:530`）。
  - 冲突处理：写失败后刷新一次，若 revision 变化则**重试一次**（多标签页安全）。
- 只读控制：`described.writable === false` 时禁用所有写控件（`:342`, `:507`）。
- 文案：保存成功「已保存/已清除全部绑定」；失败显示具体错误（`:455-466`）。

### F4. 显式选择记忆（用户优先语义的落点，`client.js:61-66`, `:255-272`）

- 问题：会话自身的 preset 投影无法区分「仍在全局默认」与「用户手动选了全局默认」——两者都读作默认 id。
- 方案：协调器只写「绑定集合内的值」，所以监听 `agent-preset/selected` 事件，把**落在绑定集合之外**的选择记入 `localStorage['dsh-workspace-presets/user-chosen']`（会话 id 集合），跨刷新保留；协调器遇到该集合内的会话直接跳过（`:567`）。
- 读取失败（隐私模式/存储被禁）静默降级为内存集合。

### F5. 自动套用协调器（`client.js:538-601`）

注册座位：`ctx.slots.inject('shell.overlay', …)` → `ctx.slots.register({ name:'shell.overlay', id:'workspace-presets.overlay' }, Reconciler)`（`:611-615`）；无可见 UI，仅一个 4 秒后自动消失的 toast。

判定顺序（全部满足才调用 `agentPresets.select(sessionId, binding)`）：

1. meta 为 `ready` 且 preset 名单非空；
2. 存在工作区绑定；
3. 会话属于已绑定工作区、**未归档**（`workspaces.archivedSessionIds`）；
4. `session.blank === true`（只动未开始的空白会话）；
5. 非子代理：`session.origin !== 'subagent'` 且 `session.parentId === undefined`；
6. 不在 `userChosen` 集合内；
7. 当前 preset ≠ 绑定值；
8. 当前 preset 属于「全局默认」（`undefined`、等于默认 id）或「旧绑定值」（绑定集合成员之一）——即**只升级默认/陈旧绑定，不抢夺第三种显式选择**；
9. 该会话无在途请求（`inFlight` 去重）。

成功后在右下角弹出 `toastApplied`：「已套用工作区预设:{preset}({workspace})」（`:578-585`, `:593-600`）。

覆盖范围注意：侧边栏为每个工作区保留的**隐藏可复用空白会话**也在 `workspace.sessionIds` 内，因此也被套用；已开始的会话永不改动。

### F6. 刷新与跨标签页同步（`client.js:394-416`）

- `connection/reset` → `refreshMeta()`（网关重连后重读）。
- `remote.$on('settings/document-updated', ns)`：`ns` 等于两个已知名字之一则刷新（另一标签页写入后本页跟随）。
- `remote.$on('agent-preset/selected', (sessionId, agentPreset))`：见 F4。
- 首次挂载即 `refreshMeta()`（`:623`）。

### F7. i18n（`client.js:68-111`, `:275-276`）

- `ctx.locale.register('workspacePresets', { zh, en })`，`ctx.locale.bind('workspacePresets')` 得到 `t()`。
- 16 个键：`nav, description, followDefault, userPreset, brokenPreset, clearAll, cleared, saved, empty, loading, unavailable, rosterEmpty, saveError, loadError, toastApplied, none`。
- 自带极简 `{name}` 插值 `fmt()`（`undefined` 时保留占位符）。

### F8. 样式与视觉（`client.js:52-55`, `:178-233`, `:278-283`）

- 运行时创建 `<style>` 注入 `document.head`，打标 `data-plugin="dsh-workspace-presets"` 与 `data-plugin-css="dsh-workspace-presets/settings.css"`，由 `ctx.effect` 在卸载时移除（client 模块系统按这两个标记认领/回收样式标签）。
- 12 个 `wpres-*` 作用域类名；几何照抄官方设置区（行 `16px 0` 内距、`.5px` 底边、选择器高 34px / 圆角 8px / 三级文字 12×12 chevron）。
- 颜色全部走 DSH 令牌：`--dsw-alias-label-primary|tertiary|dimmed`、`--dsw-alias-border-l2|l4`、`--dsw-alias-bg-layer-3|overlay`、`--dsw-alias-interactive-bg-hover`、`--dsw-alias-brand-primary`、`--dsw-alias-state-success-primary|error-primary`、`--dsw-shadow-lv3`。
- 页面自行渲染 `<h2>` 标题：因为该代设置外壳不替每节画标题（0.1.5 行为）。

### F9. 前端基础设施（`client.js:113-134`）

- 自带 30 行 snapshot store（`getSnapshot/subscribe/set`）+ `useStore` 钩子，替代外部状态库。
- `call(operation)` 归一化 Remote 结果：`{ok:true,value}` / `{ok:false,code,error}`，保留 `code` 以区分「端点不存在」与「业务拒绝」（`:144-160`）。

### F10. 预设镜像脚本（`scripts/mirror-agent-presets.mjs`）

| 能力 | 位置 | 说明 |
|---|---|---|
| 发现预设 | `:90-96` | 扫描 `<dshHome>/.agent-presets/*/agent.cordis.yml` |
| 读元数据 | `:98-107` | 极简 `preset.yml` 的 `key: value` 解析 |
| 声明块生成 | `:184-207` | 生成 `@deepseek-ai/dsh-agent-preset` 行，`order` 从 10 起 |
| 区域所有权 | `:48-49`, `:209-216`, `:285-299` | 用 `# >>> / # <<< dsh-workspace-presets` 标记包裹，重写时先剥离；区域外字节级保留 |
| 行重写 | `:138-181` | `./`、`../` 行名 → `file:///` 绝对 URL；`skill-filesystem.customSkillDirs` 的 `!!js` 表达式 → 绝对路径；重命名包 `@deepseek-ai/dsh-workflow-worker-thread` → `@deepseek-ai/dsh-workflow-ptc`（并同步行 id） |
| 自检 | `:301-352` | 校验 `file:///` 行存在、无残留 `./` 行、preset id 合法；`--runtime-modules` 逐根校验包行可解析，任何问题**不写文件**并以退出码 1 结束 |
| 设置行补写 | `:224-246` | `--restore <workspaceId>:<presetId>,...` 时，若 profile patch 里没有 `workspace-agent-presets` 行则插入绑定（0.1.5 的 `settings.yaml` 节迁到 0.1.7 的条目 config）；已有行永不覆盖 |
| 原子写 | `:363-368` | 写临时文件后 `rename`（该文件同时是 0.1.7 的设置文档，被监听） |
| 参数 | `:72-87` | `--profile`（必填）、`--dsh-home`、`--out`、`--restore`、`--runtime-modules`（可重复）、`--dry-run`、`--help` |

### F11. 持久化与残留（数据契约）

| 代 | 存储位置 | 形态 |
|---|---|---|
| DSH ≤ 0.1.5 | `<DSH_HOME>/settings.yaml` 的 `workspace-agent-presets:` 节 | `bindings:` 列表（已在本机 `settings.yaml.imported:3-6` 观察到实例） |
| DSH ≥ 0.1.7 | `<DSH_HOME>/profiles/<profile>/cordis.patch.yml` 中 `id: workspace-agent-presets` 条目的 `config` | 同上（本机 desktop profile 实际写入，workspaceId `315dbfe7-…` → preset `leetcode-coach`） |

- 插件自身**不创建任何文件**；卸载后最多残留一个无人读取的惰性节。
- README 给出的清空方式：卸载前点「清除全部绑定」，或事后手工删除该节（`README.md:140`）。

---

## 4. 依赖的 DSH 契约（兼容性风险的真正所在）

### 4.1 Host 侧

| 契约 | 用法 | 备注 |
|---|---|---|
| Host 插件形状 | 具名导出 `name` / `Config` / `apply(ctx)` | 与 whale-widget 等其他插件一致 |
| `settings` 服务 | `settings.register(ns, schema, {base})` | 仅 ≤0.1.5 存在；≥0.1.7 无此方法 |
| 设置节 = Loader 条目 | 条目 id 即节名；`Config` 即节 schema；只有带 `volatile` 元数据的字段可被设置界面写 | ≥0.1.7 |
| Loader volatile 快路径 | 仅 volatile 字段的变更被提交进运行中配置引用（`Entry.update` → `_commitVolatile`） | 需要 `@deepseek-ai/schemastery ≥ 3.18.4`（经 cosmokit `Symbol.for("cosmokit.volatile.write")` 协议跨模块副本识别） |
| bundle patch | `package.json.dsh.bundle.patch` → `cordis.patch.yml` 的 `insert` 行 | `dsh plugin add` 自动调和 bundles |

### 4.2 Web（client）侧

| 契约 | 用法 | 备注 |
|---|---|---|
| bundle 注册 | `window.__ModuleLoader__.load({ id, factory: (require) => … })` | 无构建步骤，`require('react')` 取自共享模块图 |
| 包声明 | `exports["./client"]` + `package.json.dsh.client.{platform,inject}` | `inject` 仅作加载/预取元数据 |
| Cordis 生命周期 | `ctx.effect(fn, label)`、`ctx.timer.timeout` | |
| 服务注入 | `inject: ['slots','locale','connection','remote','remote.agentPresets','remote.settings','timer']` | **每个 Remote 命名空间是独立服务**，未声明时访问 `ctx.remote.<ns>` 会抛 `cannot get property … without inject`（`client.js:628-635`） |
| 座位（slots） | `ctx.slots.inject(name, cb)` + `ctx.slots.register({name,id,order,label,locale}, Component)`，座位名 `settings.section` 与 `shell.overlay` | 全新 id，不覆盖官方 UI |
| 设置 RPC | `settings.describe()` → `{ namespaces:[{ns,revision,value}], writable }`；`settings.update(ns, patch, revision?)`；`settings.replace(ns, value, revision?)` | 以「按名查节 + 跟随应答名」代替假设（`client.js:299-349`） |
| 预设 RPC | `agentPresets.list()` → `{ presets:[{id,name,isDefault,trust,broken}] }`；`agentPresets.select(sessionId, presetId)` → 选中的 id | 与官方 hero 屏芯片同一个 RPC |
| 事件 | `remote.$on('settings/document-updated', ns)`、`remote.$on('agent-preset/selected', sessionId, agentPreset)`、`ctx.on('connection/reset')` | |
| 会话/工作区列表 | `sessions.list` → `{ byId }`；`workspaces.list` → `{ items:[{workspaceId,title,path,sessionIds}], archivedSessionIds }` | 协调器的输入全靠这两个 store |
| 会话投影 | `session.projectionValues.agentPreset`；空白判定 `session.blank`；子代理判定 `session.origin === 'subagent'` / `session.parentId` | |
| 错误码 | `gateway/invocation-unavailable` = 该部署没有这个方法 | |
| 主题令牌 | 见 F8 的 12 个 `--dsw-alias-*` / `--dsw-shadow-lv3` | |
| 样式标签归属 | `data-plugin` + `data-plugin-css` | 老客户端模块系统按此标记回收 |

### 4.3 安装/运维契约

- `dsh plugin --profile <name> add|remove <pkg|link:path|github:owner/repo>`（内部转发 pnpm）。
- `link:` 安装下插件自己的依赖必须装在插件目录（本仓库 `node_modules/@deepseek-ai/schemastery` 已是 3.18.4）——否则 `host.js` 以 `ERR_MODULE_NOT_FOUND` 让 profile 启动失败。
- 生效方式：Host 改动需**重启 profile**；`client.js` 改动由客户端 HMR 观察（轮询 bundle mtime），必要时硬刷新。

### 4.4 目标版本（0.1.7-rc.2）实测契约差异

运行时位置：DSH Desktop 2.0.15 随包携带的完整 DSH 发行树
`C:\Users\lexin\AppData\Local\Programs\DSH Desktop\resources\app\node_modules\@deepseek-ai\`（284 个包，全部为 `0.1.7-rc.2`）；`resources\app\lib\client.js` 是该运行时的客户端引导产物。以下均为在该树中直接观察到的代码。

**A. 客户端 bundle 注册：未变。**
`dsh-client-ui-settings-shell/lib/client.js:1-3` 仍是 `window.__ModuleLoader__.load({ id, factory: (require) => … })`，`package.json` 仍是 `exports["./client"]` + `dsh.client.{platform,inject,external,immediately}`（例：`dsh-client-ui-renderer` 声明 `{platform:'web', immediately:true}`）。**但 `require("@deepseek-ai/dsh-client-ui-slots")` 在那棵包里解析到一个空目录**（`resources/app/node_modules/@deepseek-ai/dsh-client-ui-slots` 有目录、0 个文件，时间戳与当时的操作同刻）。
> **已定论（2026-09-27）**：这是**那台 Desktop 安装树的孤立损坏**，不是 0.1.7 的契约变化。依据：npm 安装的 `@deepseek-ai/dsh`（0.1.7-rc.2）与 `profiles/web/node_modules` 里的同名包都完整可读（`lib/client.js`、`lib/types/**/*.d.ts` 齐备），插件在该线上已实机跑通。

**B. 设置界面模型：变了，且这是重写的主要动机。**
0.1.7 引入了 **`configForms` 服务**与 **`plugins.item` 座位**，插件配置不再是「自己注册一个 `settings.section` 并自绘表单」：

```js
// dsh-client-ui-settings-shell/lib/client.js:159-189（原文摘录）
const inject = ['slots', 'locale', 'configForms']            // 新增 configForms 服务
const bash = new ShellCardController(ctx.configForms.get('bash-sandbox'))
ctx.configForms.whileServed([BASH_NS, PWSH_NS], (served) =>
  ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item', id: 'shell', order: 10,
    label: () => t('title'), locale: NS,
    inject: () => (served.has('pwsh-sandbox') ? pwsh : bash).inject(),
  }, ShellCard)))
```

- 座位名从 `settings.section`（现在是**顶层大节**，Desktop 自己的页面用它）转向 `plugins.item`（**插件配置卡片**），`register` 新增可选的 **`inject` 工厂**字段，向组件提供 slot 输入。
- 表单原语由 `@deepseek-ai/dsh-client-ui-primitives` 提供：`SettingsForm`、`SettingsValueField`、`SettingsFormModel`、`settingsNumberField`——即官方已经有一整套配置表单组件，旧实现手搓的 `<select>`、自绘 `<h2>` 标题、`--dsw-alias-border-l4` 描边配方在 0.1.7 里属于重复实现。
- 组件契约变为两视图：`props.view === 'summary'` 返回一行描述文本，否则返回 `SettingsForm`（`:66-110`）。
- 因此 **「页面是否还需要自己画标题」的答案是：不该画**；标题由 `label` 提供，官方外壳渲染。

**C. `ctx.remote.settings`：参数表未变，新增两个方法。**
`dsh-api-settings-controller/lib/typert.host.js:440-475`：

```
@Remote describe(): SettingsDescribeValue                       // { writable, hasDocument, namespaces: SettingsNamespaceView[] }
@Remote update(ns, patch, expectedRevision): Promise<SettingsNamespaceView>
@Remote replace(ns, section, expectedRevision): Promise<SettingsNamespaceView>
@Remote mutate(ns, ops: SettingsPathOpView[], expectedRevision): Promise<SettingsNamespaceView>   // 新增
@Remote openSettingsDocument(signal): Promise<SettingsDocumentOpenValue>                          // 新增（流式文档）
```
`SettingsNamespaceView` 含 `ns / schema / value / base? / user? / applies:'live' / secrets / revision`（`:489`）。即旧实现的「按名查节 + revision 守卫」逻辑仍然成立，只是写方法应优先用 `mutate`（按路径改，不必整节替换）。

**D. `ctx.remote.agentPresets`：`select` 的**客户端**签名变了。**
`dsh-agent-preset-registry/lib/typert.host.js:208-209`：

```
@Remote('select') async select(agent: Agent, agentPreset: string): Promise<string>   // 0.1.7
@Remote('select') async select(sessionId: string, agentPreset: string): string       // 旧实现假设
```
远端首参在 0.1.7 是 **Agent 对象**（`select` 内部 `agent.session.append('agent-preset/selected', …)`，`lib/index.js:753-761`），线上按字符串 id 传输、由 Host 侧解析。旧的 `agentPresets.select(sessionId, presetId)` 调用是否仍被接受，必须在目标树里实测（这决定客户端协调器能否原样保留）。
> **已实测（2026-09-27）**：**仍被接受**，客户端协调器无需删除。浏览器侧的类型面本来就是字符串：`dsh-agent-preset-registry/lib/typert.remote-client.d.ts` 声明 `select(agentId: SessionId, agentPreset: string)`，Host 侧再把它解析成 `Agent`。所以这条差异不是兼容性问题，先前把它列为「风险」是误读。
`list()` 未变：`remoteExportList()` 返回 `{ presets: [{ id, name?, description?, order?, broken?, isDefault }] }`（`lib/index.js:592-598`）。

**E. Host 侧盖章：可行，且这是取消客户端协调器的正确落点。**
- `ctx.on('session/created', (session) => …)` 在 0.1.7 是公开的 Host 事件，`dsh-session/lib/invariant.js:145-147` 就是用它做种子（`{ global: true }`）。
- 事件与选择语义齐全：`agent-preset/selected` 在 Host 侧以 `(sessionId, agentPreset)` 发射（`dsh-agent-preset-registry/lib/index.js:489`），提交选择写入会话日志（`:761`），`dsh-session/lib/index.js:80` 把它列为已知事件类型。
- 因此 Host 半边可以在 `session/created` 上解析「会话属于哪个工作区 + 是否空白」，命中绑定就直接提交 `agent-preset/selected`，从而**取消 F4（localStorage 手动选择补丁）、F5（浏览器协调器）、F6 的会话/工作区列表订阅**，并消除多标签页竞态。
- 需要重写主体自己补上的三点：① 在会话创建瞬间区分「绑定套用」与「用户显式选择」的时序（旧实现靠 localStorage 事后补救）；② 子代理/归档会话语义在 Host 事件里如何判定；③ Host 半边如何取到 binding 配置（`Config` 的 volatile 引用）与 workspace 归属。

**F. `dsh.client.inject` 的 9 个包名：全部仍然存在**（`dsh-api-remotes`、`dsh-api-session-controller`、`dsh-api-workspace-controller`、`dsh-client-connection`、`dsh-client-locale`、`dsh-client-ui-renderer`、`dsh-client-ui-settings`、`dsh-client-ui-session`、`dsh-client-ui-workspace`）；0.1.7 新增了 `dsh-api-settings-controller`、`dsh-client-ui-primitives`、`dsh-client-ui-settings-*` 系列，重写应据实际用到服务重算该列表。注意 `dsh-client-ui-settings` 自身只声明 `inject: ["@deepseek-ai/dsh-api-remotes"]`，`ui-workspace` 声明 11 个——该字段是加载元数据（模块图排序），不是服务注入清单；名字对不上任何 bundle 行只会少一条排序边，不会报错。
> **已执行（2026-09-27）**：`38ea186` 把该列表从 9 个补到 11 个（新增 `dsh-client-ui-layout`——`shell.overlay` 的声明方，与 `dsh-client-ui-slots`），并补上 `immediately: true`（官方多数客户端包的写法）。

**G. 未能完成核实的事项**（本机文件系统访问在调查中反复出现瞬时不可读，含一处空包目录）：
1. 0.1.7 主题令牌集合（`--dsw-alias-*`）是否与 F8 的 12 个一致——需在干净树里核对 `dsh-client-ui-theme`。**部分确认（2026-09-27）**：`38ea186` 的页面在浅色/深色下显示正常，说明这 12 个令牌在该线仍有效；未逐一比对完整令牌表（`dsh-client-ui-theme` 的声明面在干净树里仍未读）。
2. `slots` 服务的完整当前签名（`register` 的 `inject` 字段语义、`settings.section` 与 `plugins.item` 的 kind/scope 声明表）——已确认存在 `slots.inject` / `slots.register` / `slots.registerFactory` / `slots.install` / `slots.renderSlot`（`dsh-client-ui-renderer/lib/client.js:1270-1852`），细节仍需对着干净树读一遍。**部分确认**：`settings.section`（list/root，选项 `id`/`order`/`label`/`locale`）与 `shell.overlay`（list/root）两处注册在实机上均生效。

---

## 5. 现状与已知问题（为什么考虑重写）

| 观察 | 证据 |
|---|---|
| 客户端契约已经历一次破坏性变更（0.1.5 的 `ctx.connection.api` 对象信封 → `ctx.remote` 位置参数 + `RemoteResult`） | `client.js:20-23`、提交 `6ad714a` |
| Host 契约又经历一次破坏性变更（命名空间设置 → 按条目 config + volatile） | `host.js:9-26`、提交 `9a077fb` |
| **目标版本又换了一代设置界面模型**：`configForms` + `plugins.item` + 官方 `SettingsForm` 原语，取代「插件自己注册 section 并手绘表单」 | §4.4-B |
| 两代差异全部内联在同一个文件里，靠**运行时探测**（`typeof settings.register !== 'function'`、`describe()` 找节名），没有版本常量、没有特性声明 | `host.js:105-108`、`client.js:324-338` |
| 客户端是**手写 bundle**：无构建、无类型、无测试，639 行（基线）里 UI/状态/协调/文案/样式混在一个工厂函数内 | `client.js` 全文 |
| 协调器把「用户手动选择」编码进 `localStorage`，跨设备/跨浏览器不生效；语义补丁而非 DSH 内建概念 | `client.js:61-66` |
| 0.1.7 一代**没有文件系统 preset 名单**，必须靠外部脚本往 profile patch 里写声明——插件功能的一部分落在仓库外的运维脚本 | `README.md:154-178`、`scripts/mirror-agent-presets.mjs` |
| ~~`agentPresets.select` 远端首参在 0.1.7 是 `Agent`，旧实现按 `sessionId` 调用~~ —— **已撤销**：浏览器侧类型面本身就是 `SessionId`，实机上也正常工作，这不是缺陷 | §4.4-D（含回填） |
| 本机 DSH Desktop 安装树已见损坏（`dsh-client-ui-slots` 空目录、`resources/app/node_modules` 访问反复瞬时失败） | §4.4-A。**证据出处更正**：先前版本把「`profiles/web/node_modules` 被清空三次」记在 `D:\DSH\plugins\DeepSeek-Balance-Whale-Widget\.dsh-repair\dsh-web-doctor.ps1` 名下，该路径在当前机器上不存在（`Test-Path` 为 False），该结论目前无法复核，应按未复核背景对待 |

---

## 6. 重写时的可复用 / 待替换清单

**可原样复用（与 UI、设置模型漂移无关）**
- `scripts/mirror-agent-presets.mjs`：区域所有权、行重写规则、自检、原子写、`--restore`。重写不应触碰这部分逻辑，只需保持 `SETTINGS_ENTRY_ID = 'workspace-agent-presets'` 与插件一致。
- 数据形态 `bindings: Array<{workspaceId, agentPreset}>`（已是落盘格式，改动会造成用户绑定丢失）。
- 语义规则（F5 的 9 条判定与 F4 的「手动优先」）——这是产品的实际需求，和实现方式无关；在 Host 侧盖章方案里这些规则要**原样搬到服务端**（尤其「只升级默认/陈旧绑定，不抢夺第三种显式选择」）。
- `cordis.patch.yml` 的行 id 与 bundle 通道；`package.json` 的 `dsh.bundle.patch` / `dsh.client` 双面结构与 `exports["./client"]` 形状。
- 设置 RPC 的调用形状（`describe/update/replace` 参数表未变，见 §4.4-C）与 revision 守卫重试策略。
- 双语 16 个文案键的内容。
- 12 个 `--dsw-alias-*` 令牌与视觉配方：**仅在改用官方 `SettingsForm` 原语后仍需自定义样式时**才保留，否则随 `plugins.item` 卡片一起删掉。

**必须重写**
- `client.js` 整体：从「`settings.section` 自绘表单 + `shell.overlay` 协调器」改为「`plugins.item` + `configForms` + `SettingsForm` 原语」；若 Host 侧盖章方案成立，`shell.overlay` 与 `localStorage` 逻辑直接删除。
- `host.js`：从「只导出 `Config`」升级为「`Config` + 在 `session/created` 上套用绑定」——这才是这次重写的功能增量，且是唯一能取消跨标签页竞态的落点。
- `package.json`：`peerDependencies` 从 5 个 `^0.1.5-rc.1` 改为 `0.1.7` 线；`dsh.client.inject` 按实际用到的服务重算；`description` 与 README 徽章同步。
- `cordis.patch.yml` 的注释段（整段在解释 0.1.5 与 0.1.7 差异，重写后大半失效）。

**待重构前确认（剩余信息缺口）** — 状态截至 2026-09-27
1. 目标运行的 `dsh web` 究竟是哪条线 → **已解决**：就是 **0.1.7 线**（`dsh --version` = `0.1.7-rc.2`）。先前「`profiles/web/node_modules` 里没有 `@deepseek-ai/*`」的观察也已不成立（该目录下有完整的一批 `@deepseek-ai/*` 包）。§4.4-A 的空包目录属另一台 Desktop 树的孤立损坏。
2. `agentPresets.select(sessionId, …)` 在 0.1.7 是否仍被接受 → **已解决，仍被接受**（见 §4.4-D 的回填）。协调器不必删除。
3. §4.4-G 的两项：主题令牌集合、`slots` 完整签名 → **部分确认**，见 §4.4-G 的回填。
4. Host 侧盖章需要补的三个判定（绑定与显式选择的时序、子代理/归档判定、binding 配置读取方式）→ **仍未做**；这是 `1.0.0` 的未完成前置。

**已定案的产品范围（用户决定，但截至 2026-09-27 未执行）**
- 重写**只支持新版**（0.1.7 一代 / Desktop 2.x / 新版 `dsh web`）：F1 的 ≤0.1.5 路径、设置名回退、`host.js` 的 `settings.register` 分支、`README` 的两代表格全部属于**可删除**部分。
- 重写**改为 Host 侧盖章**（§4.4-E 已证实 `session/created` 可用）：F4、F5、F6 的浏览器侧逻辑属**可删除**部分。
- 上述两项对应 `GIT-STRATEGY.md` 的 D3（版本号直接 `1.0.0`）。
- **注意**：实际交付的 `38ea186`（0.2.1）**没有执行上述任何一条**，它保留了全部「可删除」部分，只做版本适配。见第 7 节。

---

## 7. 实际交付与本文计划的差距（2026-09-27 追加）

已交付的是 `38ea186`（0.2.1）：**在保留现有架构的前提下，把实现修到能在当前 0.1.7 线上跑通**，`dsh web` 实机验证通过（用户确认）。本文第 6 节规划的 `1.0.0` 重写（只支持新版 + Host 侧盖章 + `plugins.item`/`configForms`）**未执行**，仍属意向。

`38ea186` 实际做了什么：

| 改动 | 对应本文条目 |
|---|---|
| 删掉 `preset.trust === 'user'` 标记，改用官方同款内置判定（`name === undefined` 且 id 命中内置集合） | F3 的标记行；§4.2 的「预设 RPC」里 `trust` 字段实际不存在 |
| 设置名改为候选链 `workspace-agent-presets → dsh-workspace-presets → workspace-presets`，读写跟随应答名 | F2 的回退名；§4.2「设置 RPC」的按名解析 |
| `host.js` 文档改写为以 0.1.7 为正；补上 volatile 的**真正原因**（`volatileForm` 表单投影的前提，不只是快路径优化） | F1 的 ≥0.1.7 路径；§4.1 的 volatile 说明 |
| `package.json`：`0.2.0 → 0.2.1`、补 `immediately`、inject 加 `dsh-client-ui-layout`/`dsh-client-ui-slots`、peer 对齐 `0.1.7-rc.2`、schemastery `^3.18.4` | §6「必须重写」的 `package.json` 行 |
| README 纠正「0.1.5 = web、0.1.7 = Desktop」的错误对应，补两条新故障行 | §6 的 README 段落 |

**未做**（`1.0.0` 的范围）：Host 侧 `session/created` 盖章、删除客户端协调器与 `localStorage` 补丁、改用 `plugins.item`/`configForms`/`SettingsForm` 官方表单、删除 0.1.5 适配分支与设置名回退、版本号跳 `1.0.0`、Desktop profile 验收。

**因此本文第 4 节的契约表仍然是对「当前实现依赖什么」的准确描述**（0.2.1 仍用这套契约），而第 6 节的「必须重写」清单应当读作**尚未发生的计划**，不是已达成的状态。
