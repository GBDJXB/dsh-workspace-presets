# dsh-workspace-presets

**Per-workspace Agent preset bindings for DeepSeek Harness.** Bind an Agent preset to a workspace once, and every new session started in that workspace automatically boots with that preset's full capabilities — deterministic, zero extra latency, zero extra model cost.

<div align="center">
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="Supported DSH versions: 0.1.1-rc.2" src="https://img.shields.io/badge/DSH-0.1.1--rc.2-4d6bfe" />
  <img alt="Workspace presets" src="https://img.shields.io/badge/-Workspace%20presets-4d6bfe" /> <img alt="Auto apply" src="https://img.shields.io/badge/-Auto%20apply-4d6bfe" /> <img alt="zh%20%2F%20en" src="https://img.shields.io/badge/-zh%20%2F%20en-4d6bfe" />
  <!-- After publishing, add: npm version / npm downloads / GitHub stars badges. -->
</div>

<div align="center">
  🌏 <a href="./README.md"><b>English</b></a> · <a href="./README.zh.md">中文</a>
</div>

> **TL;DR** — Bind an Agent preset to each workspace in **Settings → Workspace presets**, and every new session in that workspace boots with it: deterministic, zero latency, zero extra model cost.
> Install: `dsh plugin --profile web add dsh-workspace-presets` · Uninstall: `dsh plugin --profile web remove dsh-workspace-presets`
>
> **TL;DR** — 在 **设置 → 工作区预设** 给每个工作区绑定一个 Agent 预设,该工作区之后新建的会话自动以它启动:确定性、零延迟、零额外模型调用。
> 安装:`dsh plugin --profile web add dsh-workspace-presets` · 卸载:`dsh plugin --profile web remove dsh-workspace-presets`

---

## What it does

- Adds a native **"Workspace presets"** page to the DSH settings panel: one row per workspace, each with a preset picker (system / user presets, broken presets flagged).
- **Applies the binding automatically** whenever a *blank* session belongs to a bound workspace — including the hidden reusable blank session the sidebar keeps per workspace, in every open tab.
- Falls back cleanly: a workspace without a binding keeps DSH's normal behavior (global default, hero-screen chip). An explicit chip choice on a blank session always wins over the binding.
- Sessions that have started, subagent sessions, or archived sessions will not be touched.

## Installation

**Prerequisites:** a DSH deployment that composes Agent presets (the standard install does), and `pnpm` on your PATH (`dsh plugin` forwards to pnpm).

**Supported DSH versions:** `0.1.1-rc.2` (peer range).

**From npm** (once published):

```sh
dsh plugin --profile web add dsh-workspace-presets
```

**Straight from GitHub, without cloning:**

```sh
dsh plugin --profile web add github:YOUR_USERNAME/dsh-workspace-presets
```

**From a local checkout** (clone first):

```powershell
git clone https://github.com/YOUR_USERNAME/dsh-workspace-presets.git
cd dsh-workspace-presets
npm install          # ← required for local installs: see the note below
dsh plugin --profile web add .\dsh-workspace-presets   # or: dsh plugin --profile web add .
```

> Local-folder installs are `link:` installs: Node resolves the package's modules from the repo's real path, so the plugin's own runtime dependency (`@deepseek-ai/schemastery`) must be installed inside the repo (`npm install` / `pnpm install`) before the profile boots. Registry and git installs do not need this step.

All three forms do the same thing: pnpm installs the package into the profile and `dsh` reconciles `dsh.profile.bundles` automatically (the package declares `dsh.bundle.patch`), so no profile file edits are needed. Then **restart the profile** (`dsh web`) and **hard-refresh the browser** (Ctrl+Shift+R). Open **Settings → Workspace presets** — the page should be there.

**Or let an LLM install it for you** — paste this prompt into any DSH session (or your favorite agent):

```text
Install the dsh-workspace-presets plugin (per-workspace Agent preset bindings for DSH):
1. Pick ONE install source and run it:
   - npm:      dsh plugin --profile web add dsh-workspace-presets
   - GitHub:   dsh plugin --profile web add github:OWNER/dsh-workspace-presets
   - local:    git clone <repo-url> && cd dsh-workspace-presets && npm install --legacy-peer-deps
               dsh plugin --profile web add <absolute path to this folder>
   (Local installs MUST run npm install inside the repo first, or boot fails with
   ERR_MODULE_NOT_FOUND — see Troubleshooting below.)
2. Restart the profile (dsh web) and tell the user to hard-refresh the browser (Ctrl+Shift+R).
3. Verify: Settings shows the "Workspace presets" page; bind a preset to a workspace;
   a new session in that workspace boots with it (a toast confirms the apply).
If anything fails, check the Troubleshooting table in the README before retrying.
```

<details>
<summary><b>Troubleshooting</b></summary>

| Symptom | Cause & fix |
|---|---|
| `dsh plugin` says pnpm is not found | Install pnpm (`npm i -g pnpm`) and re-run. |
| Boot fails with `ERR_MODULE_NOT_FOUND … imported from …\host.js` | Local-folder install without the plugin's own deps: run `npm install` (or `pnpm install`) inside the repo, then restart. Registry/git installs never hit this. |
| Settings page doesn't show after install | The Host half activates on a profile restart — restart `dsh web`, then hard-refresh the browser. |
| A bound workspace's new session still starts with the default preset | The binding only applies to **blank** sessions, and a manual hero-chip choice always wins; subagent sessions are never touched. Already-started sessions are fixed by design. |
| Plugin mounts twice / namespace registration fails at boot | You combined the bundle channel with a manual `cordis.patch.yml` insert — keep only one. |

</details>

<details>
<summary><b>Updating</b></summary>

```sh
dsh plugin --profile web add dsh-workspace-presets@latest
```

or bump the version in `$DSH_HOME/profiles/web/package.json` and re-run `pnpm install`. Then restart / hard-refresh as above.

</details>

## Usage

1. Open **Settings → Workspace presets**.
2. Pick a preset for each workspace (or leave *Follow global default*).
3. Start a new session in that workspace — it boots with the bound preset; a small toast confirms each automatic apply.

Notes:

- The binding applies at session creation to blank sessions. Changing a binding affects future sessions (a still-blank session running a previous binding is updated too); already-started sessions are never touched.
- A manual preset choice made with the hero-screen chip on a blank session always overrides the workspace binding for that session.
- If a bound preset is deleted or broken, the apply is skipped and the page flags the workspace row; nothing crashes.

## Uninstall

```sh
dsh plugin --profile web remove dsh-workspace-presets
```

then restart the profile. To **disable temporarily** instead, append to the profile's `cordis.patch.yml`:

```yaml
- id: workspace-presets
  disabled: true
```

**Residue policy:** the plugin creates no files of its own — every runtime effect (slots, listeners, styles, the settings namespace) is removed with it. The only possible remainder is an **inert** `workspace-agent-presets:` section in DSH's own settings document: no namespace resolves it, so it affects nothing. To purge it cleanly, click **Settings → Workspace presets → Clear all bindings** before removing the plugin, or delete the section from the settings document afterwards.

## Compatibility

- **Non-invasive.** UI lives only in two additive slots with fresh ids (`settings.section` entry `workspace-presets`, `shell.overlay` entry `workspace-presets.overlay`); no shipped UI is patched or replaced.
- **Official APIs only.** Settings namespace + `settings.describe/update/replace`, `agentPresets.list/select`, the `slots`/`locale`/`connection`/`remote`/`timer` services, and the `sessions`/`workspaces` list stores.
- **No files written.** Bindings persist in DSH's own settings document; the plugin never creates or deletes preset directories, session logs, or its own storage.
- **Multi-tab safe.** Selects are idempotent and Host-serialized per session; settings writes are revision-guarded.

## Repository layout

```
dsh-workspace-presets/
├── host.js            # Host half: registers the settings namespace (≈40 lines)
├── client.js          # Web half: settings page + overlay reconciler + toast
├── cordis.patch.yml   # bundle patch: inserts the host row (id: workspace-presets)
├── package.json       # dual-face manifest (main → host.js, ./client → client.js)
├── .gitignore         # node_modules/ (local linked installs create it)
├── LICENSE            # MIT
├── README.md          # this file (English)
└── README.zh.md       # 中文版
```

No build step, no `lib/`, no generated files — the repository **is** the shipped package. (A local `npm install` for linked development creates `node_modules/`, which `.gitignore` excludes.)

`package.json` essentials:

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

(`dsh.client.inject` mirrors the shipped `ui-agent-preset` client package; adjust to the exact DSH version you target.)

## Development

Plain JavaScript (ESM), no build step, no bundler, no JSX — the repo is the shipped package. `client.js` is a hand-written `window.__ModuleLoader__.load(...)` module using `React.createElement`; the only Host import is `@deepseek-ai/schemastery`, the same fork DSH's own `settings` service validates schemas against.

## License

MIT
