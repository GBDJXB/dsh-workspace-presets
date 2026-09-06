/**
 * dsh-workspace-presets — Host half.
 *
 * The whole Host responsibility is one durable, schema-validated settings
 * namespace. Bindings ride DSH's own settings document, so this plugin owns
 * no files, writes no directories, and leaves nothing behind but an inert
 * (never-resolved) section after uninstall.
 */
import Schema from '@deepseek-ai/schemastery'

export const name = 'workspace-presets'
export const inject = ['settings']

/** Wire namespace; the Web half looks the same name up via settings.describe. */
export const SETTINGS_NAMESPACE = 'workspace-agent-presets'

/**
 * One entry per bound workspace: the workspace registry id and the agent
 * preset id every new (blank) session of that workspace should boot with.
 */
const BindingsSchema = Schema.object({
  bindings: Schema.array(
    Schema.object({
      workspaceId: Schema.string(),
      agentPreset: Schema.string(),
    }),
  ).default([]),
})

export function apply(ctx) {
  ctx.settings.register(SETTINGS_NAMESPACE, BindingsSchema, { base: { bindings: [] } })
}
