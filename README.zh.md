# dsh-workspace-presets

**为 DeepSeek Harness 提供「工作区 → Agent 预设」绑定。** 给一个工作区绑定一次预设,该工作区之后新建的会话就会自动以该预设启动、拥有它完整的能力——确定性、零额外延迟、零额外模型成本。

<div align="center">
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="支持的 DSH 版本:0.1.5、0.1.7 与 0.2.0" src="https://img.shields.io/badge/DSH-0.1.5%20%7C%200.1.7%20%7C%200.2.0-4d6bfe" />
  <img alt="工作区预设" src="https://img.shields.io/badge/-工作区预设-4d6bfe" /> <img alt="自动套用" src="https://img.shields.io/badge/-自动套用-4d6bfe" /> <img alt="中英双语" src="https://img.shields.io/badge/-中英双语-4d6bfe" />
  <!-- 发布到 npm 后可补充:npm 版本 / 下载量 / GitHub stars 徽章。 -->
</div>

<div align="center">
  🌏 <a href="./README.md">English</a> · <a href="./README.zh.md"><b>中文</b></a>
</div>

> **TL;DR** — 在 **设置 → 工作区预设** 给每个工作区绑定一个 Agent 预设,该工作区之后新建的会话自动以它启动:确定性、零延迟、零额外模型调用。
> 安装:`dsh plugin --profile web add dsh-workspace-presets` · 卸载:`dsh plugin --profile web remove dsh-workspace-presets`
>
> **TL;DR** — Bind an Agent preset to each workspace in **Settings → Workspace presets**, and every new session in that workspace boots with it: deterministic, zero latency, zero extra model cost.
> Install: `dsh plugin --profile web add dsh-workspace-presets` · Uninstall: `dsh plugin --profile web remove dsh-workspace-presets`

---

## 功能一览

- 在 DSH 设置面板新增原生 **「工作区预设」** 页:每个工作区一行、各带一个预设选择器(部署自带的预设与你自己声明的预设都会列出,损坏预设会被标记)。页面自带标题与说明——设置面板只提供导航与内容列,不替每个页面渲染标题。
- **自动套用绑定**:只要某个空白会话属于已绑定的工作区就生效——包括侧边栏为每个工作区保留的隐藏可复用空白会话,所有打开的标签页一致生效。
- 干净回退:未绑定的工作区保持 DSH 默认行为(全局默认 + hero 屏芯片);在空白会话上手动用芯片选的预设永远优先于绑定。
- 已开始的会话、子代理会话或已归档会话不受影响。

## 安装

**前置条件**:DSH 部署包含 Agent 预设(标准安装即有),且 PATH 里有 `pnpm`(`dsh plugin` 内部转发给 pnpm)。

**支持的 DSH 版本**:`0.2.0` 线(现在 npm 的 `dsh web` 与 DSH Desktop 2.x 都在这一代),`0.1.7` 线(同样按 Loader 条目存设置),以及更早的 `0.1.5` 线(命名命名空间式设置)。`0.1.7` 与 `0.2.0` 属于同一设置代:插件用到的所有 API 在两线上完全一致,因此 peer 范围同时声明两者。你在哪一代取决于 `dsh` 版本,而不是 web 还是 desktop。

**从 npm 安装**(发布后):

```sh
dsh plugin --profile web add dsh-workspace-presets
```

**其它 profile**(DSH Desktop 2.x 把自己的插件放在独立 profile 里)装法相同:

```powershell
dsh plugin --profile desktop add link:<本目录的绝对路径>
```

然后看下面的 [DSH 世代与 Agent 预设](#dsh-世代与-agent-预设):0.1.7 线上预设必须在 composition 里声明,所以你在 `dsh web` 用的预设可能需要在每个要用的 profile 里各跑一次 mirror 脚本。

**直接从 GitHub 安装(无需克隆):**

```sh
dsh plugin --profile web add github:GBDJXB/dsh-workspace-presets
```

**从本地克隆安装:**

```powershell
git clone https://github.com/GBDJXB/dsh-workspace-presets.git
cd dsh-workspace-presets
npm install          # ← 本地安装必须先做这步,见下方说明
dsh plugin --profile web add .\dsh-workspace-presets   # 或:dsh plugin --profile web add .
```

> 本地文件夹安装是 `link:` 安装:Node 会从仓库的真实路径解析模块,因此插件自己的运行时依赖(`@deepseek-ai/schemastery`)必须先装进仓库目录(`npm install` / `pnpm install`),否则 profile 无法启动。npm / git 安装不需要这步。

三种方式殊途同归:pnpm 把包装进 profile,`dsh` 看到包里的 `dsh.bundle.patch` 会自动调和 `dsh.profile.bundles`,**无需手改任何 profile 文件**。完成后**重启 profile**(`dsh web`)并**硬刷新浏览器**(Ctrl+Shift+R),打开侧边栏底部的 **设置 → 工作区预设** 即可看到新页面。

**或者让 LLM 帮你装**——把下面这段提示词发给任意一个 DSH 会话(或你惯用的 agent):

```text
帮我安装 dsh-workspace-presets 插件(为 DSH 提供「工作区 → Agent 预设」绑定),步骤:
1. 三选一执行安装:
   - npm:      dsh plugin --profile web add dsh-workspace-presets
   - GitHub:   dsh plugin --profile web add github:OWNER/dsh-workspace-presets
   - 本地克隆: git clone <仓库地址> && cd dsh-workspace-presets && npm install --legacy-peer-deps
               dsh plugin --profile web add <该文件夹绝对路径>
   (本地安装必须先在该仓库内执行 npm install,否则启动报 ERR_MODULE_NOT_FOUND,见下方「常见问题」。)
2. 重启 dsh web,并提醒我硬刷新浏览器(Ctrl+Shift+R)。
3. 验证:设置里出现「工作区预设」页;给某工作区绑定预设;该工作区新建会话自动套用(右下角有 toast 提示)。
遇到报错先查本 README 的「常见问题」表,不要盲目重试。
```

<details>
<summary><b>常见问题</b></summary>

| 现象 | 原因与解决 |
|---|---|
| `dsh plugin` 提示找不到 pnpm | 先 `npm i -g pnpm` 再重跑。 |
| 启动报 `ERR_MODULE_NOT_FOUND … imported from …\host.js` | 本地文件夹安装但没在仓库里装依赖:在仓库目录执行 `npm install`(或 `pnpm install`)后重启。npm / git 安装不会遇到此问题。 |
| 装完设置页没出现 | Host 半部分要重启 profile 才激活——重启 `dsh web` 后硬刷新浏览器。 |
| 页面出现「读取失败:…」或整页空白 | 该提示只在 Host 半部分未加载、或旧版 client 与当前宿主不匹配时出现。用 `dsh plugin --profile web add dsh-workspace-presets@latest` 升级到与本 DSH 同版本线的插件,再重启 + 硬刷新。 |
| 页面提示 Host 半部分未加载 | `settings.describe()` 里找不到本插件会认的三个名字(`workspace-agent-presets`,其次包名,最后 `workspace-presets`)。要么插件没挂在这个 profile(见最后一行),要么它的 `Config` 没有声明 volatile 字段——那种条目 DSH 根本不会提供给设置界面。 |
| 保存时报 `Config field "bindings" is not volatile` | 挂载的 Host 半部分不是本版本:它导出的设置小节 DSH 不会写入。重装插件并重启 profile。 |
| 已绑定工作区的新会话仍用全局默认预设 | 绑定只作用于**空白**会话,hero 屏手动选择永远优先,子代理会话不受影响;已开始的会话按设计不切换。 |
| 插件被挂载两次 / 启动时命名空间注册报错 | 你把 bundle 通道与手动 `cordis.patch.yml` 插入行同时用上了——二选一。 |
| 自己写的预设在 0.1.7 线上找不到 | 那条线没有文件系统预设名单;跑 `scripts/mirror-agent-presets.mjs --profile <profile 名>` 再重启 profile。 |
| 启动报 `ctx.settings.register is not a function` | 0.1.7 线上跑的是 0.2.0 之前的构建(那代设置是「按条目 config」)。升级插件。 |
| 启动告警 `patch: entry "workspace-agent-presets" not found` | 该 profile 的 `dsh.profile.bundles` 里没有本插件,绑定行是惰性的。先把插件装进 profile。 |

</details>

<details>
<summary><b>更新</b></summary>

```sh
dsh plugin --profile web add dsh-workspace-presets@latest
```

或把 `$DSH_HOME/profiles/web/package.json` 里的版本号调高后重跑 `pnpm install`,然后按上面方式重启 / 硬刷新。

</details>

## 使用

1. 打开侧边栏底部的 **设置**,进入 **工作区预设**。
2. 给每个工作区选一个预设(或保持「跟随全局默认」)。
3. 在该工作区新建会话——自动以绑定预设启动,右下角 toast 确认每次自动套用。

备注:

- 绑定在会话创建时作用于空白会话;修改绑定影响之后的会话(仍空白且正跑着旧绑定的会话也会更新);已开始的会话永不受影响。
- 在空白会话上用 hero 屏芯片手动选择的预设,永远覆盖该会话的工作区绑定。
- 若绑定的预设被删除或损坏,套用会被跳过、页面会把对应工作区行标出来,不会崩溃。

## 卸载

```sh
dsh plugin --profile web remove dsh-workspace-presets
```

然后重启 profile。若只想**临时禁用**,在该 profile 的 `cordis.patch.yml` 里追加:

```yaml
- id: workspace-agent-presets
  disabled: true
```

**残留政策**:插件不写任何自有文件——所有运行时效果(槽位注册、事件监听、样式、设置小节)随插件一起移除。唯一可能的残留是一段**惰性**配置:`0.1.5` 及更早是 `settings.yaml` 里的 `workspace-agent-presets:` 小节,`0.1.7` 及更新是 profile patch 里该条目的 `config`。没有任何东西解析它,不影响任何功能。想彻底清掉,卸载前点 **设置 → 工作区预设 → 清除全部绑定**(内部调用 `settings.replace` 清空),或之后手动删除该小节。

## DSH 世代与 Agent 预设

**绑定存在哪里。** 两代 DSH 存设置的方式不同,插件用同一份源码同时覆盖:

| | DSH ≤ 0.1.5 | DSH ≥ 0.1.7(当前:npm 的 `dsh web`、DSH Desktop 2.x) |
|---|---|---|
| 设置模型 | 命名命名空间 | 按 Loader 条目的 config |
| 绑定位置 | `$DSH_HOME/settings.yaml` 的 `workspace-agent-presets:` 小节 | `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 里 `workspace-agent-presets` 条目的 `config` |
| Host 半部分 | 调用 `settings.register('workspace-agent-presets', …)` | 导出 `Config`,其 `bindings` 字段标记为 volatile |

在 0.1.7 上**小节名是关键**:Loader 条目 id 就是设置名,所以 `cordis.patch.yml` 用 `id: workspace-agent-presets` 挂载这一行。Web 半部分从 `settings.describe()` 里按这个名字找小节,找不到再退到包名、最后退到 0.1.7 之前的短 id `workspace-presets`,之后所有读写都跟着真正应答的那个名字。除此之外不做版本嗅探:`settings.register` 只在该服务确实提供它时才调用。

**预设从哪来。** 这部分是 DSH 的差异,不是插件造成的:

- **≤ 0.1.5** 扫描文件系统:`$DSH_HOME/.agent-presets/<id>/`,每个预就是一个目录,内含 `agent.cordis.yml` 与可选的 `preset.yml`。
- **≥ 0.1.7** 完全没有文件系统名单。预设只以 composition 里的 `@deepseek-ai/dsh-agent-preset` 行存在,其 `config.plugins` 列表**就是**那份 composition。

所以为旧线写的预设,在新线看见之前必须先被声明。`scripts/mirror-agent-presets.mjs` 会为你用户根目录下的每个预设写入该声明,落在脚本自己拥有的标记区块里:

```sh
# --runtime-modules 可重复:把目标 profile 能解析预设行的每一棵树都列出来。
# 不给的话,包行不会被检查。
node scripts/mirror-agent-presets.mjs --profile web \
  --runtime-modules "$DSH_HOME/profiles/web/node_modules"

node scripts/mirror-agent-presets.mjs --profile web --dry-run   # 只打印计划,不写文件
node scripts/mirror-agent-presets.mjs --profile web --restore <workspaceId>:<presetId>,...
```

`--restore` 会顺带写入插件自己的设置行——这是把 0.1.7 丢掉旧 `settings.yaml` 小节之前记录的绑定带过来的方式。已存在的行**永不覆盖**:设置界面写过一次之后,绑定就属于你而不是脚本。

改过任何 `agent.cordis.yml` 之后重跑即可:标记区块原地重写,文件里其他所有行(包括设置界面写入的那些)逐字节保留。

> 声明式预设没有自己的目录:它的行相对 profile 解析,而不是相对预设文件夹。所以脚本只改写那些搬不过去的行——相对的 `./plugins/...` 行名变成 `file:///` URL,`skill-filesystem` 的 `customSkillDirs` 变成该目录的绝对路径,0.1.7 线改过名的包改成新名字(`@deepseek-ai/dsh-workflow-worker-thread` → `@deepseek-ai/dsh-workflow-ptc`,也就是 0.1.7 自带 `standard` 预设声明的那一行)。其余只改缩进,因此两代挂载的是同一份 composition。

> **包行是最容易踩的地方。** 两条线解析预设行的树不同,所以某个包只存在于*别的* profile 的 `node_modules` 里时,这一行在目标 profile 上什么都挂不上:DSH 会把这个预设标成损坏(宿主日志里是 `PackageOverlayNotFoundError … never started`),而不是启动失败,然后新会话就不能再用它了。`--runtime-modules` 就是用来抓这件事的,也是它要求列出全部根、而不是"第一个能解析的根"的原因。

## 兼容性

- **非侵入**:UI 只占两个新 id 的附加槽位(`settings.section` 的 `workspace-presets`、`shell.overlay` 的 `workspace-presets.overlay`),不补丁、不替换任何官方 UI。(那是槽位条目 id;Host 发布的设置小节名是 `workspace-agent-presets`,挂载行用同一个 id。)
- **只用官方 API**:`settings.describe/update/replace`、`agentPresets.list/select`、`slots`/`locale`/`connection`/`remote`/`timer` 服务、`sessions`/`workspaces` 列表 store。设置**小节**在 0.1.7 及更新声明为插件自己的 `Config`,在 0.1.5 及更早通过 `settings.register` 注册。
- **Remote 约定**:所有调用走 `ctx.remote.<命名空间>.<方法>(位置参数)`,返回 `RemoteResult`(`{ok:true,value}` / `{ok:false,error}`);已移除的 `ctx.connection.api` 与 `{result:{ok,value}}` 信封不再使用。每个 Remote 命名空间是**独立的 cordis 服务**(键为 `remote.<命名空间>`),所以插件 `inject` 里必须声明 `remote.agentPresets` 与 `remote.settings`——未声明时上下文代理会直接抛 `cannot get property "remote.agentPresets" without inject`。会话自身的预设读 `session.projectionValues.agentPreset`;`agentPresets.select` 返回该会话现在运行的预设,或一个拒绝理由。
- **不写文件**:绑定存在 DSH 自己的设置文档里;插件从不创建或删除预设目录、会话日志或私有存储。
- **小节字段必须是 volatile 的,这是页面存在的前提。** 在 0.1.7 及更新版本上,DSH 用 `volatileForm(schema)` 构造每个条目的设置页——只保留最近祖先被标记 volatile 的字段。一个字段都没标记的条目根本不出现在 `settings.describe()` 里,写入也会被直接拒绝,所以这个标记是必需的,不是装饰。它同时决定 live 提交快路径:只改动 volatile 字段时,新值被写进活动配置已持有的引用,而不是重启插件(`Entry.update` → `_commitVolatile`)。这种引用只有在 schema 把该字段包成 cosmokit `Volatile` 时才存在,而 `@deepseek-ai/schemastery` 从 **3.18.4** 起才这么做——本包依赖的正是该版本。用更旧的副本时,解析出的字段是普通值,loader 找不到引用、却把这次提交报告为成功,于是**继续沿用旧配置**。因此 Host 半部分在缺少 `.volatile()` 的 schemastery 旁会直接拒绝加载,而不是接受一次无法落地的保存;已装的副本必须重装(`dsh plugin --profile <name> add …@latest`)才能带上新依赖。
- **预设行没有来源字段。** 名单返回的是 `{id, isDefault, name?, description?, broken?}`,没有"系统 / 用户"标记。所以选择器沿用官方页面的判定方式:既不发布显示名、id 又是内置那几个之一的,标为内置;其余用自己声明的名字显示。
- **多标签安全**:套用操作幂等且由宿主按会话串行;设置写入带 revision 防冲突。

## 仓库结构

```
dsh-workspace-presets/
├── host.js            # Host 半部分:绑定小节(≥0.1.7 导出 Config,≤0.1.5 走 settings.register)
├── client.js          # Web 半部分:设置页 + 常驻协调器 + toast
├── cordis.patch.yml   # bundle 补丁:插入 host 插件行(id: workspace-agent-presets)
├── scripts/
│   └── mirror-agent-presets.mjs   # 为 DSH ≥ 0.1.7 声明 .agent-presets 里的预设
├── package.json       # 双面清单(main → host.js,./client → client.js)
├── .gitignore         # node_modules/(本地链接安装会产生)
├── LICENSE            # MIT
├── README.md          # 英文版
└── README.zh.md       # 本文件(中文版)
```

零构建、无 `lib/`、无生成物——仓库本身就是发布包。(本地链接开发时 `npm install` 产生的 `node_modules/` 已被 `.gitignore` 排除。)

`package.json` 要点:

```jsonc
{
  "name": "dsh-workspace-presets",
  "type": "module",
  "main": "host.js",
  "exports": { ".": "./host.js", "./client": "./client.js" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": [
        "@deepseek-ai/dsh-api-remotes",
        "@deepseek-ai/dsh-api-session-controller",
        "@deepseek-ai/dsh-api-workspace-controller",
        "@deepseek-ai/dsh-client-connection",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-renderer",
        "@deepseek-ai/dsh-client-ui-session",
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-client-ui-slots",
        "@deepseek-ai/dsh-client-ui-workspace"
      ]
    }
  },
  "dependencies": { "@deepseek-ai/schemastery": "^3.18.4" }
}
```

(`dsh.client.inject` 对齐官方 `ui-workspace` / `ui-agent-preset` / `ui-settings` 客户端包声明的那一套;换 DSH 版本时按该版本实际发布的 `@deepseek-ai/*` client 包名同步。该字段是模块图排序元数据,不是 Cordis 服务注入——浏览器侧的模块表基线自带 `react`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives` 等,无需声明。名字对不上任何 bundle 行只会少一条排序边,不算错误。)

## 开发

纯 JavaScript(ESM),零构建、零打包器、零 JSX——仓库即发布包。`client.js` 是手写的 `window.__ModuleLoader__.load(...)` 模块,用 `React.createElement` 渲染;Host 侧唯一导入是 `@deepseek-ai/schemastery`(与 DSH 自身 `settings` 服务校验 schema 用的是同一个 fork)。

Host 侧挂好后,改 `client.js` 只需刷新浏览器(client 模块系统按 bundle 的 mtime 重建模块图);改 `host.js` 或 `package.json` 需要重启 profile。

## License

MIT
