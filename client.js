/**
 * dsh-workspace-presets — Web half.
 *
 * Hand-written module-loader bundle (same shape the shipped client bundles
 * ship in: window.__ModuleLoader__.load with a factory). No build step, no
 * bundler, no JSX — React comes from the shared module graph.
 *
 * Two additive UI seats:
 *   1. settings.section "Workspace presets" — one row per workspace with a
 *      preset picker, backed by the official RPCs agentPresets.list /
 *      settings.describe / settings.update / settings.replace.
 *   2. shell.overlay reconciler — invisible, watches the session/workspace
 *      list stores and applies bindings to blank sessions through the same
 *      official RPC the shipped hero-screen chip uses
 *      (agentPresets.select). It never touches started sessions, subagent
 *      sessions, or sessions whose preset was chosen explicitly.
 *
 * Visuals follow the shipped settings UI: rows are 16px-padded flex rows on
 * --dsw-alias-border-l2, and the picker is the settings-native select recipe
 * the shipped settings pages use for their own native selects (32px height,
 * 8px radius, 1px --dsw-alias-border-l2 on --dsw-alias-bg-layer-1, tertiary
 * 12×12 chevron), so light/dark themes keep working through the DSH tokens.
 */
window.__ModuleLoader__.load({
  id: 'dsh-workspace-presets',
  factory: (require) => {
    const React = require('react')
    const { createElement, useEffect, useState } = React

    const SETTINGS_NS = 'workspace-agent-presets'
    const LOCALE_NS = 'workspacePresets'

    const en = {
      nav: 'Workspace presets',
      description: 'Bind an Agent preset to a workspace and every new session started there boots with it. Only blank sessions are switched; a preset you pick manually always wins.',
      followDefault: 'Follow global default ({preset})',
      userPreset: 'user',
      brokenPreset: 'broken',
      clearAll: 'Clear all bindings',
      cleared: 'All bindings cleared.',
      saved: 'Saved.',
      empty: 'No workspaces yet.',
      loading: 'Loading…',
      unavailable: 'The dsh-workspace-presets Host half is not loaded in this profile.',
      rosterEmpty: 'This deployment composes no agent presets.',
      saveError: 'Could not save: {error}',
      loadError: 'Could not load: {error}',
      toastApplied: 'Workspace preset applied: {preset} ({workspace})',
      none: 'none',
    }

    const zh = {
      nav: '工作区预设',
      description: '为工作区绑定 Agent 预设后,该工作区内新建的会话会自动以该预设启动。仅作用于尚未开始的空白会话;手动选择的预设始终优先。',
      followDefault: '跟随全局默认({preset})',
      userPreset: '用户',
      brokenPreset: '已损坏',
      clearAll: '清除全部绑定',
      cleared: '已清除全部绑定。',
      saved: '已保存。',
      empty: '还没有工作区。',
      loading: '加载中…',
      unavailable: '未在此 profile 中加载 dsh-workspace-presets 的 Host 半部分。',
      rosterEmpty: '此部署未配置任何 Agent 预设。',
      saveError: '保存失败:{error}',
      loadError: '读取失败:{error}',
      toastApplied: '已套用工作区预设:{preset}({workspace})',
      none: '无',
    }

    function fmt(text, args) {
      if (!text) return ''
      return String(text).replace(/\{(\w+)\}/g, (_, key) => (
        args !== undefined && key in args ? String(args[key]) : `{${key}}`
      ))
    }

    /** Minimal snapshot store: getSnapshot / subscribe / set. */
    function createStore(initial) {
      let snapshot = initial
      const listeners = new Set()
      return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        set: (next) => {
          snapshot = next
          for (const listener of [...listeners]) listener()
        },
      }
    }

    function useStore(store) {
      const [snapshot, setSnapshot] = useState(() => store.getSnapshot())
      useEffect(() => store.subscribe(() => setSnapshot(store.getSnapshot())), [store])
      return snapshot
    }

    /** Fold the RPC envelope shapes into one result. */
    async function call(operation) {
      try {
        const response = await operation()
        if (response && response.result && response.result.ok) {
          return { ok: true, value: response.result.value }
        }
        return {
          ok: false,
          error: response && response.result && response.result.error
            ? response.result.error.message
            : 'unknown error',
        }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }

    const META_INITIAL = {
      status: 'loading', // loading | ready | error | unavailable
      error: null,
      writable: true,
      revision: undefined,
      bindings: [],
      presets: [],
      defaultPresetId: undefined,
    }

    /**
     * Scoped class names. Geometry mirrors the shipped agent-preset settings
     * UI; every color rides DSH theme tokens with a neutral fallback.
     */
    const C = {
      box: 'wpres-box',
      description: 'wpres-description',
      row: 'wpres-row',
      rowMain: 'wpres-rowMain',
      title: 'wpres-title',
      sub: 'wpres-sub',
      selectWrap: 'wpres-selectWrap',
      select: 'wpres-select',
      chevron: 'wpres-chevron',
      button: 'wpres-button',
      notice: 'wpres-notice',
      error: 'wpres-error',
      toast: 'wpres-toast',
    }

    const stylesheet = `
.wpres-box{max-width:720px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:12px}
.wpres-description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.6;margin:0}
.wpres-row{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}
.wpres-rowMain{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}
.wpres-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.wpres-sub{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px;overflow-wrap:anywhere}
.wpres-selectWrap{position:relative;display:inline-flex;flex:none}
.wpres-select{appearance:none;-webkit-appearance:none;background:var(--dsw-alias-bg-layer-1);height:32px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 32px 0 10px;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);cursor:pointer;max-width:320px;outline:none}
.wpres-select:disabled{cursor:default;color:var(--dsw-alias-label-quaternary)}
.wpres-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.wpres-chevron{position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--dsw-alias-label-tertiary);display:inline-flex}
.wpres-button{margin-top:4px;align-self:flex-start;background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:8px 14px;font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer}
.wpres-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.wpres-button:disabled{opacity:.5;cursor:default}
.wpres-notice{color:var(--dsw-alias-state-success-primary);font-size:13px}
.wpres-error{color:var(--dsw-alias-state-error-primary);font-size:13px}
.wpres-toast{position:fixed;right:20px;bottom:20px;z-index:10000;max-width:70vw;padding:10px 14px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:13px;box-shadow:var(--dsw-shadow-lv3,0 6px 24px rgba(0,0,0,.35));pointer-events:none}
`

    function chevronElement() {
      return createElement(
        'span',
        { className: C.chevron, 'aria-hidden': true },
        createElement(
          'svg',
          { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none' },
          createElement('path', {
            d: 'M3 4.5l3 3 3-3',
            stroke: 'currentColor',
            strokeWidth: 1.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
        ),
      )
    }

    function defineClient(ctx) {
      const { api } = ctx.connection
      ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-workspace-presets: locale dictionaries')
      const t = ctx.locale.bind(LOCALE_NS)

      const styleEl = document.createElement('style')
      styleEl.textContent = stylesheet
      document.head.appendChild(styleEl)
      ctx.effect(() => () => { styleEl.remove() }, 'dsh-workspace-presets: scoped stylesheet')

      const meta = createStore(META_INITIAL)
      const inFlight = new Set()

      async function refreshMeta() {
        const roster = await call(() => api.agentPresets.list({}))
        const described = await call(() => api.settings.describe({}))
        if (!roster.ok || !described.ok) {
          meta.set({ ...meta.getSnapshot(), status: 'error', error: roster.ok ? described.error : roster.error })
          return
        }
        const presets = Array.isArray(roster.value.presets) ? roster.value.presets : []
        const defaultPreset = presets.find((preset) => preset.isDefault === true)
        const namespace = (described.value.namespaces ?? []).find((entry) => entry.ns === SETTINGS_NS)
        if (namespace === undefined) {
          meta.set({ ...meta.getSnapshot(), status: 'unavailable', error: null, presets, defaultPresetId: defaultPreset?.id })
          return
        }
        meta.set({
          status: 'ready',
          error: null,
          writable: described.value.writable !== false,
          revision: namespace.revision,
          bindings: namespace.value && Array.isArray(namespace.value.bindings) ? namespace.value.bindings : [],
          presets,
          defaultPresetId: defaultPreset?.id,
        })
      }

      async function writeBindings(nextBindings, attempt) {
        const before = meta.getSnapshot()
        const wrote = await call(() => api.settings.update({
          ns: SETTINGS_NS,
          patch: { bindings: nextBindings },
          ...(typeof before.revision === 'number' ? { expectedRevision: before.revision } : {}),
        }))
        if (wrote.ok) {
          await refreshMeta()
          return { ok: true }
        }
        // Another tab may have moved the revision. Refresh once and retry.
        if (attempt === 0) {
          await refreshMeta()
          const after = meta.getSnapshot()
          if (typeof after.revision === 'number' && after.revision !== before.revision) {
            return writeBindings(nextBindings, 1)
          }
        }
        return { ok: false, error: wrote.error }
      }

      async function clearAllBindings() {
        const cleared = await call(() => api.settings.replace({ ns: SETTINGS_NS, section: {} }))
        if (cleared.ok) await refreshMeta()
        return cleared
      }

      ctx.effect(() => {
        const disposers = [
          ctx.on('connection/reset', () => { void refreshMeta() }),
          ctx.remote.$on('settings/document-updated', (ns) => {
            if (ns === SETTINGS_NS) void refreshMeta()
          }),
        ]
        return () => { for (const dispose of disposers) dispose() }
      }, 'dsh-workspace-presets: settings refresh wiring')

      ctx.inject(['sessions', 'workspaces'], (scope) => {
        function WorkspacePresetsPage() {
          const snapshot = useStore(meta)
          const workspaces = useStore(scope.workspaces.list)
          const [saving, setSaving] = useState(false)
          const [notice, setNotice] = useState(null)
          const [errorText, setErrorText] = useState(null)

          if (snapshot.status === 'loading') return createElement('div', { className: C.box }, t('loading'))
          if (snapshot.status === 'error') return createElement('div', { className: C.box }, fmt(t('loadError'), { error: snapshot.error }))
          if (snapshot.status === 'unavailable') return createElement('div', { className: C.box }, t('unavailable'))
          if (snapshot.presets.length === 0) return createElement('div', { className: C.box }, t('rosterEmpty'))

          const items = workspaces && Array.isArray(workspaces.items) ? workspaces.items : []
          const selectable = snapshot.presets.filter((preset) => preset.broken === undefined)
          const defaultPreset = snapshot.presets.find((preset) => preset.isDefault === true)

          async function changeBinding(workspaceId, value) {
            setSaving(true)
            setErrorText(null)
            setNotice(null)
            const next = snapshot.bindings.filter((entry) => entry.workspaceId !== workspaceId)
            if (value !== '') next.push({ workspaceId, agentPreset: value })
            const wrote = await writeBindings(next, 0)
            setSaving(false)
            if (wrote.ok) setNotice(t('saved'))
            else setErrorText(fmt(t('saveError'), { error: wrote.error }))
          }

          async function handleClearAll() {
            setSaving(true)
            setErrorText(null)
            setNotice(null)
            const cleared = await clearAllBindings()
            setSaving(false)
            if (cleared.ok) setNotice(t('cleared'))
            else setErrorText(fmt(t('saveError'), { error: cleared.error }))
          }

          const rows = items.map((workspace) => {
            const current = snapshot.bindings.find((entry) => entry.workspaceId === workspace.workspaceId)
            const boundPresetMissing = current !== undefined && !selectable.some((preset) => preset.id === current.agentPreset)
            const options = [
              createElement(
                'option',
                { key: 'default', value: '' },
                fmt(t('followDefault'), { preset: defaultPreset ? (defaultPreset.name ?? defaultPreset.id) : t('none') }),
              ),
              ...selectable.map((preset) => createElement(
                'option',
                { key: preset.id, value: preset.id },
                `${preset.name ?? preset.id}${preset.trust === 'user' ? ` · ${t('userPreset')}` : ''}`,
              )),
            ]
            if (boundPresetMissing) {
              options.push(createElement(
                'option',
                { key: 'missing', value: current.agentPreset },
                `${current.agentPreset} · ${t('brokenPreset')}`,
              ))
            }
            return createElement(
              'div',
              { key: workspace.workspaceId, className: C.row },
              createElement(
                'div',
                { className: C.rowMain },
                createElement('div', { className: C.title }, workspace.title),
                createElement('div', { className: C.sub }, workspace.path),
              ),
              createElement(
                'div',
                { className: C.selectWrap },
                createElement(
                  'select',
                  {
                    className: C.select,
                    disabled: saving || !snapshot.writable,
                    value: current !== undefined ? current.agentPreset : '',
                    onChange: (event) => { void changeBinding(workspace.workspaceId, event.target.value) },
                  },
                  options,
                ),
                chevronElement(),
              ),
            )
          })

          return createElement(
            'div',
            { className: C.box },
            createElement('div', { className: C.description }, t('description')),
            rows.length === 0 ? createElement('div', { className: C.description }, t('empty')) : rows,
            notice !== null ? createElement('div', { className: C.notice }, notice) : null,
            errorText !== null ? createElement('div', { className: C.error }, errorText) : null,
            createElement(
              'button',
              {
                type: 'button',
                className: C.button,
                disabled: saving || !snapshot.writable || snapshot.bindings.length === 0,
                onClick: () => { void handleClearAll() },
              },
              t('clearAll'),
            ),
          )
        }

        function Reconciler() {
          const snapshot = useStore(meta)
          const sessions = useStore(scope.sessions.list)
          const workspaces = useStore(scope.workspaces.list)
          const [toast, setToast] = useState(null)

          useEffect(() => {
            if (snapshot.status !== 'ready' || snapshot.presets.length === 0) return
            const bindingByWorkspace = new Map()
            for (const binding of snapshot.bindings) {
              if (binding && typeof binding.workspaceId === 'string' && typeof binding.agentPreset === 'string') {
                bindingByWorkspace.set(binding.workspaceId, binding.agentPreset)
              }
            }
            if (bindingByWorkspace.size === 0) return
            const bindingValues = new Set(bindingByWorkspace.values())
            const archived = new Set(Array.isArray(workspaces?.archivedSessionIds) ? workspaces.archivedSessionIds : [])
            const byId = sessions && sessions.byId ? sessions.byId : {}
            for (const workspace of workspaces?.items ?? []) {
              const binding = bindingByWorkspace.get(workspace.workspaceId)
              if (binding === undefined) continue
              for (const sessionId of workspace.sessionIds ?? []) {
                if (archived.has(sessionId)) continue
                const session = byId[sessionId]
                if (session === undefined || session.blank !== true) continue
                // Subagents join their parent's composition; never re-link them.
                if (session.origin === 'subagent' || session.parentId !== undefined) continue
                if (session.agentPreset === binding) continue
                const runsDefault = snapshot.defaultPresetId === undefined
                  || session.agentPreset === undefined
                  || session.agentPreset === snapshot.defaultPresetId
                const runsStaleBinding = session.agentPreset !== undefined && bindingValues.has(session.agentPreset)
                if (!runsDefault && !runsStaleBinding) continue
                if (inFlight.has(sessionId)) continue
                inFlight.add(sessionId)
                void call(() => api.agentPresets.select({ sessionId, agentPreset: binding }))
                  .then((selected) => {
                    if (selected.ok) {
                      const preset = snapshot.presets.find((entry) => entry.id === selected.value.agentPreset)
                      setToast(fmt(t('toastApplied'), {
                        preset: preset ? (preset.name ?? preset.id) : selected.value.agentPreset,
                        workspace: workspace.title,
                      }))
                    }
                  })
                  .catch(() => {})
                  .finally(() => { inFlight.delete(sessionId) })
              }
            }
          }, [snapshot, sessions, workspaces])

          useEffect(() => {
            if (toast === null) return
            const dispose = ctx.timer.timeout(() => setToast(null), 4000)
            return dispose
          }, [toast])

          if (toast === null) return null
          return createElement('div', { className: C.toast }, toast)
        }

        const pageSeat = ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'workspace-presets',
          order: 25,
          label: () => t('nav'),
          locale: LOCALE_NS,
        }, WorkspacePresetsPage))

        const overlaySeat = ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'workspace-presets.overlay',
          locale: LOCALE_NS,
        }, Reconciler))

        return () => {
          pageSeat()
          overlaySeat()
        }
      })

      void refreshMeta()
    }

    return {
      name: 'dsh-workspace-presets',
      inject: ['slots', 'locale', 'connection', 'remote', 'timer'],
      apply: defineClient,
    }
  },
})
