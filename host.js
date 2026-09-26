/**
 * dsh-workspace-presets — Host half.
 *
 * The whole Host responsibility is one durable, schema-validated bindings
 * section. It rides DSH's own configuration document, so this plugin owns no
 * files, writes no directories, and leaves nothing behind but an inert
 * (never-read) section after uninstall.
 *
 * Two DSH generations store that section in two different ways, and this
 * module covers both from one source:
 *
 *   • DSH ≤ 0.1.5 — settings are NAMESPACES. The settings service owns
 *     registration (`settings.register(ns, schema, …)`) and the section lives
 *     in `<dshHome>/settings.yaml` under the registered name. There is no
 *     per-entry form, so `Config` below is inert on that generation.
 *
 *   • DSH ≥ 0.1.7 — settings are per-Loader-entry CONFIG. There is no
 *     `settings.register`: a plugin's exported `Config` schema IS its section,
 *     the section NAME is the Loader entry id, and only fields carrying the
 *     `volatile` meta are offered to a settings surface (an entry whose Config
 *     declares none is not configurable at all). The section lives in the
 *     profile's `cordis.patch.yml` as that entry's `config`.
 *
 * `workspace-agent-presets` is the one name both generations publish, which is
 * why the row mounted by `cordis.patch.yml` must carry that exact id: a
 * settings surface — and the Web half — addresses the section by name alone.
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
 * This is not decoration. That generation commits a section change into the
 * running plugin through the loader's volatile fast path: a change confined to
 * schema-declared volatile fields is applied to the references the live config
 * already holds instead of re-initializing the plugin
 * (`Entry.update` → `_commitVolatile`). Those references exist only when the
 * schema wrapped the field in a cosmokit Volatile, which schemastery started
 * doing in 3.18.4 (through cosmokit's
 * `Symbol.for("cosmokit.volatile.write")` protocol, so the wrapper is
 * recognized across module copies). With an older schemastery the resolved
 * field is a plain value, the fast path finds no reference, reports success,
 * and **silently keeps the old config** — a settings page then reads its own
 * write back as unchanged until the next boot.
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
      'section reaches the running plugin only when its volatile field resolves to a cosmokit Volatile, ' +
      'which older schemastery cannot produce (saves would be accepted and then dropped). ' +
      'Reinstall the plugin so its own node_modules carries 3.18.4 or newer.',
    )
  }
  return schema.volatile()
}

/** DSH ≤ 0.1.5 section schema, registered by name in {@link apply}. */
const BindingsSchema = Schema.object({ bindings: bindingsField() })

/**
 * DSH ≥ 0.1.7 section schema: the same field, marked volatile because that
 * generation persists only volatile fields into the profile patch — and hides
 * an entry whose form would otherwise be empty.
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
