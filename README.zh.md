# dsh-workspace-presets

**为 DeepSeek Harness 提供「工作区 → Agent 预设」绑定。** 给一个工作区绑定一次预设,该工作区之后新建的会话就会自动以该预设启动、拥有它完整的能力——确定性、零额外延迟、零额外模型成本。

<div align="center">
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="支持的 DSH 版本:0.1.1-rc.2" src="https://img.shields.io/badge/DSH-0.1.1--rc.2-4d6bfe" />
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

- 在 DSH 设置面板新增原生 **「工作区预设」** 页:每个工作区一行、各带一个预设选择器(系统 / 用户预设均列出,损坏预设会被标记)。
- **自动套用绑定**:只要某个空白会话属于已绑定的工作区就生效——包括侧边栏为每个工作区保留的隐藏可复用空白会话,所有打开的标签页一致生效。
- 干净回退:未绑定的工作区保持 DSH 默认行为(全局默认 + hero 屏芯片);在空白会话上手动用芯片选的预设永远优先于绑定。
- 已开始的会话、子代理会话或已归档会话不受影响。

## 安装

**前置条件**:DSH 部署包含 Agent 预设(标准安装即有),且 PATH 里有 `pnpm`(`dsh plugin` 内部转发给 pnpm)。

**支持的 DSH 版本**:`0.1.1-rc.2`(peer 范围)。

**从 npm 安装**(发布后):

```sh
dsh plugin --profile web add dsh-workspace-presets
```

**直接从 GitHub 安装(无需克隆):**

```sh
dsh plugin --profile web add github:YOUR_USERNAME/dsh-workspace-presets
```

**从本地克隆安装:**

```powershell
git clone https://github.com/YOUR_USERNAME/dsh-workspace-presets.git
cd dsh-workspace-presets
npm install          # ← 本地安装必须先做这步,见下方说明
dsh plugin --profile web add .\dsh-workspace-presets   # 或:dsh plugin --profile web add .
```

> 本地文件夹安装是 `link:` 安装:Node 会从仓库的真实路径解析模块,因此插件自己的运行时依赖(`@deepseek-ai/schemastery`)必须先装进仓库目录(`npm install` / `pnpm install`),否则 profile 无法启动。npm / git 安装不需要这步。

三种方式殊途同归:pnpm 把包装进 profile,`dsh` 看到包里的 `dsh.bundle.patch` 会自动调和 `dsh.profile.bundles`,**无需手改任何 profile 文件**。完成后**重启 profile**(`dsh web`)并**硬刷新浏览器**(Ctrl+Shift+R),打开 **设置 → 工作区预设** 即可看到新页面。

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
| 已绑定工作区的新会话仍用全局默认预设 | 绑定只作用于**空白**会话,hero 屏手动选择永远优先,子代理会话不受影响;已开始的会话按设计不切换。 |
| 插件被挂载两次 / 启动时命名空间注册报错 | 你把 bundle 通道与手动 `cordis.patch.yml` 插入行同时用上了——二选一。 |

</details>

<details>
<summary><b>更新</b></summary>

```sh
dsh plugin --profile web add dsh-workspace-presets@latest
```

或把 `$DSH_HOME/profiles/web/package.json` 里的版本号调高后重跑 `pnpm install`,然后按上面方式重启 / 硬刷新。

</details>

## 使用

1. 打开 **设置 → 工作区预设**。
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
- id: workspace-presets
  disabled: true
```

**残留政策**:插件不写任何自有文件——所有运行时效果(槽位注册、事件监听、样式、设置命名空间)随插件一起移除。唯一可能的残留是 DSH 自己的设置文档里一段**惰性**的 `workspace-agent-presets:` 小节:没有任何命名空间解析它,不影响任何功能。想彻底清掉,卸载前点 **设置 → 工作区预设 → 清除全部绑定**(内部调用 `settings.replace` 清空),或之后手动删除设置文档里的该小节。

## 兼容性

- **非侵入**:UI 只占两个新 id 的附加槽位(`settings.section` 的 `workspace-presets`、`shell.overlay` 的 `workspace-presets.overlay`),不补丁、不替换任何官方 UI。
- **只用官方 API**:设置命名空间 + `settings.describe/update/replace`、`agentPresets.list/select`、`slots`/`locale`/`connection`/`remote`/`timer` 服务、`sessions`/`workspaces` 列表 store。
- **不写文件**:绑定存在 DSH 自己的设置文档里;插件从不创建或删除预设目录、会话日志或私有存储。
- **多标签安全**:套用操作幂等且由宿主按会话串行;设置写入带 revision 防冲突。

## 仓库结构

```
dsh-workspace-presets/
├── host.js            # Host 半部分:注册设置命名空间(约 40 行)
├── client.js          # Web 半部分:设置页 + 常驻协调器 + toast
├── cordis.patch.yml   # bundle 补丁:插入 host 插件行(id: workspace-presets)
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
      "inject": [
        "@deepseek-ai/dsh-api-remotes",
        "@deepseek-ai/dsh-client-connection",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-settings"
      ]
    }
  },
  "dependencies": { "@deepseek-ai/schemastery": "^3.18.1" }
}
```

(`dsh.client.inject` 与官方 `ui-agent-preset` 客户端包一致;如面向其他 DSH 版本请对应调整。)

## 开发

纯 JavaScript(ESM),零构建、零打包器、零 JSX——仓库即发布包。`client.js` 是手写的 `window.__ModuleLoader__.load(...)` 模块,用 `React.createElement` 渲染;Host 侧唯一导入是 `@deepseek-ai/schemastery`(与 DSH 自身 `settings` 服务校验 schema 用的是同一个 fork)。

## License

MIT
