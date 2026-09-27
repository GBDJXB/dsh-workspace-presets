/**
 * dsh-workspace-presets — Host half.
 *
 * The whole Host responsibility is one durable, schema-validated bindings
 * section. It rides DSH's own configuration document, so this plugin owns no
 * files, writes no directories, and leaves nothing behind but an inert
 * (never-read) section after uninstall.
 *
 * The current DSH line (0.1.7) is the shape this module is written for:
 *
 *   • DSH ≥ 0.1.7 — settings are per-Loader-entry CONFIG. There is no
 *     `settings.register`: a plugin's exported `Config` schema IS its section,
 *     the section NAME is the Loader entry id, and the section lives in the
 *     profile's `cordis.patch.yml` as that entry's `config`.
 *     (@deepseek-ai/dsh-settings lib/types/index.js, `SettingsForms.describe`.)
 *
 *   • DSH ≤ 0.1.5 — settings were NAMESPACES registered by name
 *     (`settings.register(ns, schema, base)`), stored in
 *     `<dshHome>/settings.yaml`. `apply` below still covers that generation
 *     from the same source, and `Config` is simply inert there.
 *
 * `workspace-agent-presets` is the one name both generations publish, which is
 * why the row mounted by `cordis.patch.yml` must carry that exact id: on the
 * current line the Loader entry id IS the settings name, so a settings surface
 * — and the Web half — addresses the section by that id alone.
 */
import Schema from '@deepseek-ai/schemastery'

export const name = 'workspace-presets'

/**
 * Wire section name, shared with the Web half.
 *
 * Load-bearing on DSH ≥ 0.1.7, where the Loader entry id IS the section name:
 * the row inserted by `cordis.patch.yml` and this constant have to agree, or
 * the Web half finds no section to read or write.
 */
export const SETTINGS_NAMESPACE = 'workspace-agent-presets'

/**
 * One entry per bound workspace: the workspace registry id and the agent
 * preset id every new (blank) session of that workspace should boot with.
 *
 * A factory rather than one shared node: deriving a schema (`.default`,
 * `.volatile`) returns a copy, so the two section shapes below must not alias.
 */
function bindingsField() {
  return Schema.array(
    Schema.object({
      workspaceId: Schema.string(),
      agentPreset: Schema.string(),
    }),
  ).default([])
}

/**
 * Mark one node as settings-writable on DSH ≥ 0.1.7.
 *
 * This is not decoration, and it is not merely an optimization. Two separate
 * mechanisms on that generation depend on it:
 *
 *   • The form projection. `SettingsForms.describe` builds each entry's page
 *     from `volatileForm(schema)` — the subtree of fields whose nearest
 *     ancestor carries the `volatile` meta. An entry whose Config declares
 *     none is absent from `settings.describe()` entirely, and its writes are
 *     refused with `Plugin entry "…" has no volatile fields`. Without this
 *     wrapper there is no page to render and no write to accept.
 *
 *   • The live-commit fast path. `Entry.update` → `_commitVolatile` folds a
 *     change confined to schema-declared volatile paths into the references
 *     the running config already holds instead of re-initializing the plugin.
 *     Those references exist only when the schema wrapped the field in a
 *     cosmokit Volatile, which schemastery started doing in 3.18.4 (through
 *     cosmokit's `Symbol.for("cosmokit.volatile.write")` protocol, so the
 *     wrapper is recognized across module copies). With an older schemastery
 *     the resolved field is a plain value, the fast path finds no reference,
 *     reports success, and **silently keeps the old config** — a settings page
 *     then reads its own write back as unchanged until the next boot.
 *
 * A schemastery that cannot wrap is therefore a hard failure here rather than a
 * quietly broken save.
 *
 * @param schema - schema node to expose to a settings surface.
 * @returns the same node, marked volatile.
 */
function markVolatile(schema) {
  if (typeof schema.volatile !== 'function') {
    throw new Error(
      'dsh-workspace-presets requires @deepseek-ai/schemastery >= 3.18.4: on DSH >= 0.1.7 a settings ' +
      'section is projected into a page — and a save reaches the running plugin — only when its field is ' +
      'declared volatile, which older schemastery cannot produce (the page would be missing or the save ' +
      'accepted and then dropped). ' +
      'Reinstall the plugin so its own node_modules carries 3.18.4 or newer.',
    )
  }
  return schema.volatile()
}

/** DSH ≤ 0.1.5 section schema, registered by name in {@link apply}. */
const BindingsSchema = Schema.object({ bindings: bindingsField() })

/**
 * DSH ≥ 0.1.7 section schema: the same field, marked volatile because on that
 * generation only volatile fields are projected into the settings form and
 * persisted into the profile patch — an entry whose form would otherwise be
 * empty is not configurable at all.
 */
export const Config = Schema.object({ bindings: markVolatile(bindingsField()) })

export function apply(ctx) {
  // DSH ≤ 0.1.5 only. The service is taken lazily so a deployment whose
  // settings service never appears (or has no `register`, as on ≥ 0.1.7)
  // leaves this plugin applied instead of parked on an unsatisfied inject.
  ctx.inject(['settings'], (settingsCtx) => {
    if (typeof settingsCtx.settings.register !== 'function') return
    settingsCtx.settings.register(SETTINGS_NAMESPACE, BindingsSchema, { base: { bindings: [] } })
  })
}
