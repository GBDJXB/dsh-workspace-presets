# dsh-workspace-presets

**Per-workspace Agent preset bindings for DeepSeek Harness.** Bind an Agent preset to a workspace once, and every new session started in that workspace automatically boots with that preset's full capabilities — deterministic, zero extra latency, zero extra model cost.

<div align="center">
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <img alt="Supported DSH versions: 0.1.5, 0.1.7 and 0.2.0" src="https://img.shields.io/badge/DSH-0.1.5%20%7C%200.1.7%20%7C%200.2.0-4d6bfe" />
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

- Adds a native **"Workspace presets"** page to the DSH settings panel: one row per workspace, each with a preset picker (presets the deployment ships / presets you declared, broken presets flagged). The page draws its own heading and intro — the settings panel only supplies the nav and content columns, and does not render a per-section title.
- **Applies the binding automatically** whenever a *blank* session belongs to a bound workspace — including the hidden reusable blank session the sidebar keeps per workspace, in every open tab.
- Falls back cleanly: a workspace without a binding keeps DSH's normal behavior (global default, hero-screen chip). An explicit chip choice on a blank session always wins over the binding.
- Sessions that have started, subagent sessions, or archived sessions will not be touched.

## Installation

**Prerequisites:** a DSH deployment that composes Agent presets (the standard install does), and `pnpm` on your PATH (`dsh plugin` forwards to pnpm).

**Supported DSH versions:** the `0.2.0` line, which is what the npm `dsh web` and DSH Desktop 2.x run today, the `0.1.7` line, which uses the same per-Loader-entry config settings, and the older `0.1.5` line (named settings namespaces). The `0.1.7` and `0.2.0` lines are the same settings generation — every API this plugin calls is identical on both, which is why the peer range declares both. Which settings generation you are on is decided by the `dsh` version, not by web-versus-desktop.

**From npm** (once published):

```sh
dsh plugin --profile web add dsh-workspace-presets
```

**Another profile** (DSH Desktop 2.x keeps its plugins in its own profile) installs the same way:

```powershell
dsh plugin --profile desktop add link:<absolute path to this folder>
```

Then read [DSH generations and agent presets](#dsh-generations-and-agent-presets): on the 0.1.7 line presets have to be declared in a composition, so the ones your `dsh web` profile uses may need the mirror script in each profile you run.

**Straight from GitHub, without cloning:**

```sh
dsh plugin --profile web add github:GBDJXB/dsh-workspace-presets
```

**From a local checkout** (clone first):

```powershell
git clone https://github.com/GBDJXB/dsh-workspace-presets.git
cd dsh-workspace-presets
npm install          # ← required for local installs: see the note below
dsh plugin --profile web add .\dsh-workspace-presets   # or: dsh plugin --profile web add .
```

> Local-folder installs are `link:` installs: Node resolves the package's modules from the repo's real path, so the plugin's own runtime dependency (`@deepseek-ai/schemastery`) must be installed inside the repo (`npm install` / `pnpm install`) before the profile boots. Registry and git installs do not need this step.

All three forms do the same thing: pnpm installs the package into the profile and `dsh` reconciles `dsh.profile.bundles` automatically (the package declares `dsh.bundle.patch`), so no profile file edits are needed. Then **restart the profile** (`dsh web`) and **hard-refresh the browser** (Ctrl+Shift+R). Open **Settings** from the sidebar footer and pick **Workspace presets** — the page should be there.

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
| The page shows "Could not load: …" or stays blank | That is an older client half talking to a newer DSH (or a Host half that never loaded). Upgrade with `dsh plugin --profile web add dsh-workspace-presets@latest` so the plugin matches your DSH version line, then restart + hard-refresh. |
| The page says the Host half is not loaded | `settings.describe()` returned none of the names this plugin looks for (`workspace-agent-presets`, then the package name, then `workspace-presets`). Either the plugin is not mounted in this profile (see the last row) or its `Config` schema declares no volatile field, in which case DSH does not offer the entry to a settings surface at all. |
| Saving shows `Config field "bindings" is not volatile` | The mounted Host half is not this build: it exports a section DSH will not write to. Reinstall the plugin and restart the profile. |
| A bound workspace's new session still starts with the default preset | The binding only applies to **blank** sessions, and a manual hero-chip choice always wins; subagent sessions are never touched. Already-started sessions are fixed by design. |
| Plugin mounts twice / namespace registration fails at boot | You combined the bundle channel with a manual `cordis.patch.yml` insert — keep only one. |
| A preset you authored is missing on the 0.1.7 line | That line has no filesystem preset roster; run `scripts/mirror-agent-presets.mjs --profile <name>` and restart the profile. |
| Boot fails with `ctx.settings.register is not a function` | A pre-0.2.0 build on the 0.1.7 line, where settings are per-entry config. Upgrade the plugin. |
| Boot warns `patch: entry "workspace-agent-presets" not found` | The plugin is not in that profile's `dsh.profile.bundles`; the bindings row is then inert. Install the plugin into the profile first. |

</details>

<details>
<summary><b>Updating</b></summary>

```sh
dsh plugin --profile web add dsh-workspace-presets@latest
```

or bump the version in `$DSH_HOME/profiles/web/package.json` and re-run `pnpm install`. Then restart / hard-refresh as above.

</details>

## Usage

1. Open **Settings** from the sidebar footer, then **Workspace presets**.
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
- id: workspace-agent-presets
  disabled: true
```

**Residue policy:** the plugin creates no files of its own — every runtime effect (slots, listeners, styles, the settings section) is removed with it. The only possible remainder is an **inert** section: the `workspace-agent-presets:` block of `settings.yaml` on 0.1.5-and-older, or that entry's `config` in the profile patch on 0.1.7-and-newer. Nothing resolves it, so it affects nothing. To purge it cleanly, click **Settings → Workspace presets → Clear all bindings** before removing the plugin, or delete the section afterwards.

## DSH generations and agent presets

**Where the bindings live.** The two DSH settings generations store a section differently, and the plugin covers both from one source:

| | DSH ≤ 0.1.5 | DSH ≥ 0.1.7 (current: npm `dsh web`, DSH Desktop 2.x) |
|---|---|---|
| Settings model | named namespaces | per-Loader-entry config |
| Bindings live in | the `workspace-agent-presets:` section of `$DSH_HOME/settings.yaml` | the `workspace-agent-presets` entry's `config` in `$DSH_HOME/profiles/<profile>/cordis.patch.yml` |
| Host half | calls `settings.register('workspace-agent-presets', …)` | exports a `Config` whose `bindings` field is marked volatile |

The section **name** is load-bearing on 0.1.7, where the Loader entry id *is* the settings name — which is why `cordis.patch.yml` mounts the row as `id: workspace-agent-presets`. The Web half resolves the section from `settings.describe()` by that name first, then by the package name, then by the shorter pre-0.1.7 id `workspace-presets`, and every read and write follows whichever name actually answered. Nothing else is version-sniffed: `settings.register` is simply called only where the service provides it.

**Where the presets come from.** This part is DSH's, not the plugin's, and the two lines differ:

- **≤ 0.1.5** scans the filesystem: one directory per preset under `$DSH_HOME/.agent-presets/<id>/`, each holding `agent.cordis.yml` and an optional `preset.yml`.
- **≥ 0.1.7** has no filesystem roster at all. A preset exists only as an `@deepseek-ai/dsh-agent-preset` row in a composition, whose `config.plugins` list *is* the composition.

So a preset authored for the older line is invisible to the newer one until it is declared. `scripts/mirror-agent-presets.mjs` writes those declarations for every preset in your user root, into a marked region the script owns:

```sh
# `--runtime-modules` is repeatable: name every tree the target profile
# resolves a preset row from. Without it, package rows go unchecked.
node scripts/mirror-agent-presets.mjs --profile web \
  --runtime-modules "$DSH_HOME/profiles/web/node_modules"

node scripts/mirror-agent-presets.mjs --profile web --dry-run   # print the plan, write nothing
node scripts/mirror-agent-presets.mjs --profile web --restore <workspaceId>:<presetId>,...
```

`--restore` additionally writes the plugin's settings row, which is how a binding recorded before 0.1.7 dropped the old `settings.yaml` section is carried across. An existing row is never overwritten — after the settings surface has written once, the bindings belong to you, not to the script.

Re-run it after editing any `agent.cordis.yml`. The marked region is rewritten in place; every other row of the profile patch — including the ones the settings surface writes — is preserved byte-for-byte.

> A declarative preset has no directory of its own: its rows resolve against the profile, not against the preset folder. The script therefore rewrites exactly the rows that cannot survive the move — a relative `./plugins/...` row name becomes a `file:///` URL, `skill-filesystem`'s `customSkillDirs` becomes the folder's absolute path, and a package the 0.1.7 line renamed becomes the newer name (`@deepseek-ai/dsh-workflow-worker-thread` → `@deepseek-ai/dsh-workflow-ptc`, the row the shipped 0.1.7 `standard` preset declares). Everything else is indentation only, so both editions mount the same composition.

> **Package rows are the sharp edge.** The two lines resolve a preset row from different trees, so a package that exists in some *other* profile's `node_modules` mounts nowhere on this one: DSH then reports the preset as broken (`PackageOverlayNotFoundError … never started` in the host log) rather than failing the boot, and new sessions can no longer use it. That is what `--runtime-modules` exists to catch, and why it wants every root, not the first one that answers.

## Compatibility

- **Non-invasive.** UI lives only in two additive slots with fresh ids (`settings.section` entry `workspace-presets`, `shell.overlay` entry `workspace-presets.overlay`); no shipped UI is patched or replaced. (Those are slot entry ids; the settings section the Host publishes is `workspace-agent-presets`, and the mount row carries the same id.)
- **Official APIs only.** `settings.describe/update/replace` and `agentPresets.list/select`, the `slots`/`locale`/`connection`/`remote`/`timer` services, and the `sessions`/`workspaces` list stores. The settings *section* is declared as this plugin's own `Config` on 0.1.7-and-newer and registered through `settings.register` on 0.1.5-and-older.
- **Remote contract.** Every call goes through `ctx.remote.<namespace>.<method>(positional args)` and answers with the `RemoteResult` branch (`{ok:true,value}` / `{ok:false,error}`); the removed `ctx.connection.api` object envelope (`{result:{ok,value}}`) is not used. Each Remote namespace is its own cordis service (`remote.<namespace>`), so `remote.agentPresets` and `remote.settings` are declared in the plugin's `inject` list — an undeclared `ctx.remote.<ns>` is refused with `cannot get property "remote.agentPresets" without inject`. A session's own preset is read from `session.projectionValues.agentPreset`. `agentPresets.select` answers with the preset the session now runs, or a refusal.
- **No files written.** Bindings persist in DSH's own settings document; the plugin never creates or deletes preset directories, session logs, or its own storage.
- **The section field is volatile, and that is what makes the page exist.** On 0.1.7-and-newer DSH builds every entry's settings page from `volatileForm(schema)` — the fields whose nearest ancestor is marked volatile. An entry that declares none is absent from `settings.describe()` and its writes are refused outright, so the mark is required, not decorative. It also selects the live-commit fast path: a change confined to volatile fields is committed into the references the running config already holds instead of re-initializing the plugin (`Entry.update` → `_commitVolatile`). Such a reference exists only when the schema wrapped the field in a cosmokit `Volatile`, which `@deepseek-ai/schemastery` started doing in **3.18.4** — the version this package depends on. With an older copy the resolved field is a plain value, the loader finds no reference, reports the commit as successful, and **keeps the old config**. The Host half therefore refuses to load beside a schemastery without `.volatile()` instead of accepting a save it cannot apply, and an existing install must be reinstalled (`dsh plugin --profile <name> add …@latest`) so the new dependency lands.
- **Preset rows carry no source field.** The roster reports `{id, isDefault, name?, description?, broken?}`; there is no "system versus user" flag. The picker therefore follows the shipped screen's convention — a preset that publishes no display name and whose id is one of the shipped ones is labelled built-in, everything else is shown under its own name.
- **Multi-tab safe.** Selects are idempotent and Host-serialized per session; settings writes are revision-guarded.

## Repository layout

```
dsh-workspace-presets/
├── host.js            # Host half: the bindings section (settings.register on ≤0.1.5, exported Config on ≥0.1.7)
├── client.js          # Web half: settings page + overlay reconciler + toast
├── cordis.patch.yml   # bundle patch: inserts the host row (id: workspace-agent-presets)
├── scripts/
│   └── mirror-agent-presets.mjs   # declares .agent-presets presets for DSH ≥ 0.1.7
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

(`dsh.client.inject` mirrors the client packages the shipped `ui-workspace` / `ui-agent-preset` / `ui-settings` bundles declare; when you target another DSH version, sync it with the `@deepseek-ai/*` client packages that version actually publishes. The field is module-graph ordering metadata, not Cordis service injection — the browser module-table baseline already carries `react`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-primitives`, and friends, so they need no declaration. A name with no matching bundle row only loses its graph edge; it is not an error.)

## Development

Plain JavaScript (ESM), no build step, no bundler, no JSX — the repo is the shipped package. `client.js` is a hand-written `window.__ModuleLoader__.load(...)` module using `React.createElement`; the only Host import is `@deepseek-ai/schemastery`, the same fork DSH's own `settings` service validates schemas against.

Editing `client.js` needs only a browser refresh once the Host side is mounted (the client module system rebuilds the graph from the bundle's mtime); editing `host.js` or `package.json` needs a profile restart.

## License

MIT
