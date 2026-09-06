# dsh-workspace-presets

**Per-workspace Agent preset bindings for DeepSeek Harness.** Bind an Agent preset
to a workspace once, and every new session started in that workspace automatically
boots with that preset's full capabilities — no per-session clicking, no extra
model call, deterministic.

> 中文简介:为 DeepSeek Harness 提供「工作区 → Agent 预设」绑定。在设置页为每个工作区选一次预设,之后该工作区内新建的会话自动以该预设启动(完整工具、提示词与能力),无需每次手动选择,零延迟、零额外模型调用、结果确定。

---

## The problem

DSH sessions pick their Agent preset in two places today: a global default
(Settings → General) and the per-session chip on the new-session hero screen.
Neither is per-workspace. If you keep a Python workspace and a research
workspace, every new session starts on whatever the global default happens to
be, and remembering to switch the chip every time is exactly the kind of
friction that gets forgotten.

This plugin adds the missing middle layer: **a default that lives on the
workspace, not on the user and not on the session.**

## What it does

- Adds a native **"Workspace presets"** page to the DSH settings panel: one
  row per workspace, each with a preset picker (system presets, user presets,
  broken presets flagged — the same roster the shipped settings UI shows).
- **Applies the binding automatically** whenever a *blank* session belongs to
  a bound workspace — including the hidden reusable blank session the sidebar
  keeps per workspace, in every open tab.
- Falls back cleanly: a workspace without a binding keeps DSH's normal
  behavior (global default, hero-screen chip). An explicit chip choice on a
  blank session always wins over the binding.
- Never touches a session that has started, a subagent session, or an
  archived session: the official blank-only lock is the same one the shipped
  preset picker enforces.

## How it differs from existing projects

| Project | Approach | Trade-off |
| --- | --- | --- |
| [dsh-preset-switch](https://github.com/aorucshiea/dsh-preset-switch) | Manual mid-session preset switching | Per-session, manual every time; nothing is remembered per workspace |
| [dsh-preset-switcher](https://github.com/jeffcwj/dsh-preset-switcher) | Preset hot-switching | Same class: explicit switching, no workspace memory |
| [dsh-session-manager](https://github.com/hkkz9522/dsh-session-manager) | Session archive/delete/move + migrate one conversation's preset | Broad session tooling; preset migration is per-conversation, not a per-workspace policy |
| [dsh-agent-preset-router](https://github.com/CTWCTW9999/dsh-agent-preset-router) | A flash model judges the "best" preset per new session | Automatic but non-deterministic, costs an extra model call and latency, decisions can surprise |
| [dsh-model-presets](https://github.com/Zding89/dsh-model-presets) | Save/switch model + reasoning-effort presets | Proves the settings-namespace + RPC pattern, but targets models, not Agent presets |
| Shipped `ui-agent-preset` | Global default + per-session hero chip | The two layers this plugin inserts itself between |

**This plugin's position:** deterministic, zero-latency, zero-cost, user-bound
policy. It changes no shipped behavior; it only fills the one case where the
session would otherwise boot with the global default.

## How it works

The plugin is a **dual-face package** (one npm package, one Host half, one Web
half), and it uses **only official, additive seams**:

```
┌──────────────────────────────  Host (Node)  ──────────────────────────────┐
│  registers settings namespace `workspace-agent-presets`                    │
│  schema: { bindings: [{ workspaceId, agentPreset }] }                      │
│  → persisted by DSH's own settings document; no plugin-owned files         │
└────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────  Web client  ───────────────────────────────┐
│  1. settings.section "Workspace presets" (new id, order 25)                │
│     - workspace list  → client `workspaces` service (list store)           │
│     - preset roster   → official RPC `agentPresets.list({})`               │
│     - bindings        → official RPC `settings.describe()`                 │
│     - edits           → official RPC `settings.update()` (revision-guarded)│
│     - reset           → official RPC `settings.replace()`                  │
│  2. shell.overlay reconciler (renders no chrome, just an apply toast)      │
│     - watches the client `sessions` / `workspaces` list stores,            │
│       `connection/reset` and the forwarded `settings/document-updated`     │
│       event                                                                │
│     - for each bound workspace, for each **blank** session in it:          │
│         current preset is the deployment default (or a stale binding)      │
│         → official RPC `agentPresets.select({ sessionId, agentPreset })`   │
└────────────────────────────────────────────────────────────────────────────┘
```

Why this shape:

- `agentPresets.select` is **the same call the shipped hero chip makes**. The
  Host enforces the blank-only lock, serializes concurrent selects per
  session, re-links the agent to the preset's standing composition, and
  durably logs the `agent-preset/selected` session event — so the
  model-visible toolset stays reconstructable from the session log, exactly
  as the core requires. This plugin inherits all of that for free and adds no
  hook into session creation.
- The reconciler runs on state changes instead of intercepting "new session"
  actions, so it cannot race session creation: if the user instantly starts
  typing, the session stops being blank and the select is skipped (with the
  same graceful behavior the chip shows).
- Only sessions listed under a workspace are candidates, and sessions marked
  `origin: 'subagent'` (or with a `parentId`) are skipped, so subagents keep
  the composition they inherited from their parent.

## Compatibility & safety guarantees

- **No invasive changes.** No patching of the workspace ⋯ menu, the sidebar
  tree, the hero screen, or session creation. UI lives only in two additive
  slots with fresh ids (`settings.section` entry `workspace-presets`,
  `shell.overlay` entry `workspace-presets.overlay`).
- **No private APIs.** Every capability used is a shipped service/event/RPC:
  the `settings` service (namespace registration), `settings.describe/update/
  replace`, `agentPresets.list/select`, the `slots`/`locale`/`connection`/
  `remote`/`timer` services, the `sessions`/`workspaces` list stores, and the
  forwarded `connection/reset` + `settings/document-updated` events.
- **No files written.** Bindings live inside DSH's own settings document via
  the settings namespace. The plugin never creates, edits, or deletes preset
  directories, session logs, or its own storage files.
- **Coexists with other plugins.** It occupies no slot, namespace, or route
  another plugin could need, and it works alongside sidebar/theme/other
  plugins (e.g. `dsh-better-sidebar`), which use different seats.
- **Multi-tab safe.** Selects are idempotent and Host-serialized per session;
  settings writes carry the expected revision and retry once on conflict
  instead of silently overwriting a concurrent edit.
- **Version-pinned.** `peerDependencies` mirror the DSH runtime versions the
  package was built against; see the compatibility matrix below.

## Installation

Requirements: a DSH deployment that composes Agent presets (the standard
install does), and `pnpm` on your PATH (`dsh plugin` forwards to pnpm).

### From npm (once published)

```sh
dsh plugin --profile web add dsh-workspace-presets
```

### Straight from GitHub, without cloning

```sh
dsh plugin --profile web add github:YOUR_USERNAME/dsh-workspace-presets
```

### From a local checkout (clone first)

```powershell
git clone https://github.com/YOUR_USERNAME/dsh-workspace-presets.git
cd dsh-workspace-presets
npm install          # ← required for local installs: see the note below
dsh plugin --profile web add .\dsh-workspace-presets   # or: dsh plugin --profile web add .
```

> Local-folder installs are `link:` installs: Node resolves the package's
> modules from the repo's real path, so the plugin's own runtime dependency
> (`@deepseek-ai/schemastery`) must be installed inside the repo
> (`npm install` / `pnpm install`) before the profile boots. Registry and
> git installs do not need this step.

All three forms do the same thing: pnpm installs the package into the profile
and `dsh` reconciles `dsh.profile.bundles` against the installed packages.
Because the package declares `dsh.bundle.patch`, it joins the profile's
bundle stack automatically — no `cordis.patch.yml` edits needed. A
local-folder install is linked (not copied), so edits you make to `host.js`
or `client.js` while testing are picked up on the next restart.

Then restart the profile:

```sh
dsh web
```

Open **Settings → Workspace presets** — the new page should be there.

> **Manual mount** (no bundle channel): `pnpm add dsh-workspace-presets` in
> `$DSH_HOME/profiles/web`, then append to that profile's `cordis.patch.yml`:
>
> ```yaml
> - insert:
>     - id: workspace-presets
>       name: 'dsh-workspace-presets'
> ```
>
> Do not combine this with the bundle channel in the same profile — two rows
> mount the package twice and the settings namespace fails loud at boot.

## Usage

1. Open **Settings → Workspace presets**.
2. Pick a preset for each workspace (or leave *Follow global default*).
3. Start a new session in that workspace — it boots with the bound preset.
   A small toast confirms each automatic apply.

Notes:

- The binding applies at session creation to blank sessions. Changing a
  binding affects future sessions (a still-blank session running a previous
  binding is updated too); already-started sessions are never touched (same
  rule as the shipped picker).
- A manual preset choice made with the hero-screen chip on a blank session
  always overrides the workspace binding for that session.
- If a bound preset is deleted or broken, the apply is skipped and the page
  flags the workspace row; nothing crashes.

## Disable & uninstall

- **Disable temporarily** — add to the profile's `cordis.patch.yml`:

  ```yaml
  - id: workspace-presets
    disabled: true
  ```

  then restart. (Everything is fiber-owned, so stopping the row removes both
  slot registrations, all listeners, and the namespace registration.)

- **Uninstall** — from either install channel:

  ```sh
  dsh plugin --profile web remove dsh-workspace-presets
  ```

  then restart.

**Residue policy:** the plugin creates no files of its own, so uninstall
removes everything it ever added at runtime. The only possible remainder is
an **inert** `workspace-agent-presets:` section in DSH's own settings
document: no namespace resolves it, so it affects nothing. To purge it
cleanly, click **Settings → Workspace presets → Clear all bindings** before
removing the plugin (it calls `settings.replace` with an empty section), or
delete the section from the settings document afterwards.

## Repository layout

```
dsh-workspace-presets/
├── host.js            # Host half: registers the settings namespace (≈40 lines)
├── client.js          # Web half: settings page + overlay reconciler + toast
├── cordis.patch.yml   # bundle patch: inserts the host row (id: workspace-presets)
├── package.json       # dual-face manifest (main → host.js, ./client → client.js)
├── .gitignore         # node_modules/ (local linked installs create it)
├── LICENSE            # MIT
└── README.md
```

No build step, no `lib/`, no generated files — the repository **is** the
shipped package. (A local `npm install` for linked development creates
`node_modules/`, which `.gitignore` excludes.)

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
  "peerDependencies": {
    "@deepseek-ai/cordis": "^4.0.1",
    "@deepseek-ai/dsh-api-remotes": "^0.1.1-rc.2",
    "@deepseek-ai/dsh-client-connection": "^0.1.1-rc.2",
    "@deepseek-ai/dsh-client-locale": "^0.1.1-rc.2",
    "@deepseek-ai/dsh-client-runtime": "^0.1.1-rc.2",
    "@deepseek-ai/dsh-client-ui-settings": "^0.1.1-rc.2",
    "@deepseek-ai/dsh-settings": "^0.1.1-rc.2",
    "react": "^18.2.0"
  },
  "dependencies": { "@deepseek-ai/schemastery": "^3.18.1" }
}
```

(`dsh.client.inject` mirrors the shipped `ui-agent-preset` client package;
adjust to the exact DSH version you target. The host half additionally
`inject`s the `settings` service; the web half injects `slots`, `locale`,
`connection`, `remote`, `timer`, `sessions`, `workspaces` — all provided by
the packages listed above plus the DSH core.)

## Language & build

**Plain JavaScript (ESM), no build step.**

- The DSH host loads the package's `main` as an ordinary Node ESM module, and
  the web plugin table serves `./client` straight to the browser — shipping
  JavaScript directly means zero toolchain drift: what runs is what the repo
  contains.
- No TypeScript, no JSX, no bundler. `client.js` is a hand-written
  `window.__ModuleLoader__.load(...)` module (the same shape the official
  packages ship after their bundler runs), using `React.createElement` and
  pulling React from the shared module graph. The only runtime import on the
  Host side is `@deepseek-ai/schemastery` — the same fork DSH's own
  `settings` service validates schemas against, so the schema classes can
  never drift from the runtime.
- Why not TypeScript? The core ships TS compiled through `tsdown`; a third
  party may follow that, but it adds a build step and generated `lib/` that
  can lag the runtime. For a two-file plugin, plain JS keeps review,
  patching, and installation trivially auditable. Upgrading later is
  mechanical: add `tsconfig`, rename to `.ts`, build to `lib/` — the
  `package.json` surface stays identical.

## Version compatibility

| Plugin | DSH (runtime packages) | Node |
| --- | --- | --- |
| 0.1.x | `^0.1.1-rc.2` (peer range) | ≥ 20 |

## Roadmap

- v0.2 — richer apply toast, `sidebar.footer.action` quick entry showing the
  active workspace's binding, more locale packs.
- v0.3 — optional Host-side fallback for non-web entry points (TUI/ACP),
  gated on the same blank-only rule.
- Considered and rejected: patching the workspace ⋯ menu (no extensible slot
  exists there; replacing `sidebar.workspaces` would shadow shipped UI and
  collide with other sidebar plugins), taking over the hero preset chip
  (single seat, shadows shipped UI), intercepting session creation (no public
  seam; the reconciler achieves the same result safely).

## FAQ

**`dsh plugin` says pnpm is not found.** Install pnpm (`npm i -g pnpm`) and
re-run; the command is a thin forwarder to pnpm in the profile directory.

**`dsh web` fails at boot with `ERR_MODULE_NOT_FOUND: Cannot find package … imported from …\host.js`.** You installed from a local folder without installing
the plugin's own dependencies first — run `npm install` (or `pnpm install`)
inside the repo, then restart the profile. Registry/git installs never hit
this.

**I installed it but the settings page doesn't show.** The Host half only
activates on a profile restart — restart `dsh web`, then hard-refresh the
browser tab (the client bundle graph changed).

**Why not an item in each workspace's ⋯ menu?** The sidebar exposes no slot
for per-workspace menu items; the only way in would be replacing the whole
`sidebar.workspaces` region, which shadows shipped UI and conflicts with
other sidebar plugins. The settings page is the additive, upgrade-safe seat,
and "set once, applies forever" needs fewer clicks than a per-workspace menu
anyway.

**What happens to sessions that already started?** Nothing, ever — the Host
refuses preset switches on non-blank sessions, and the plugin never asks it
to.

**Does this touch subagents?** No. Subagent sessions carry `origin:
'subagent'` / a parent id and are filtered out, so they keep the composition
they inherited from their parent.

## Related projects

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — the platform; `packages/client/ui-agent-preset` is the shipped preset UI this plugin builds beside.
- [dsh-preset-switch](https://github.com/aorucshiea/dsh-preset-switch) · [dsh-preset-switcher](https://github.com/jeffcwj/dsh-preset-switcher) · [dsh-session-manager](https://github.com/hkkz9522/dsh-session-manager) · [dsh-agent-preset-router](https://github.com/CTWCTW9999/dsh-agent-preset-router) · [dsh-model-presets](https://github.com/Zding89/dsh-model-presets)
- Ecosystem catalogs: [kingselyjoe/awesome-dsh-list](https://github.com/kingselyjoe/awesome-dsh-list) · [0xsline/awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness)

## License

MIT
