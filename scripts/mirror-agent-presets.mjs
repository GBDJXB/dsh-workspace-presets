#!/usr/bin/env node
/**
 * Mirror the presets under `<dshHome>/.agent-presets` into a DSH >= 0.1.7
 * profile patch.
 *
 * The two generations that have to carry the same preset read it from
 * different places:
 *
 *   * DSH <= 0.1.5 discovers presets on the filesystem — one directory per id
 *     under `<dshHome>/.agent-presets`, holding `agent.cordis.yml` and an
 *     optional `preset.yml`. Nothing else is needed.
 *   * DSH >= 0.1.7 has no filesystem roster: a preset exists only as an
 *     `@deepseek-ai/dsh-agent-preset` row declared in a composition, whose
 *     `config.plugins` list IS the composition. The folder is ignored.
 *
 * So a preset authored for the older line is invisible to the newer one until
 * its composition is declared. This script writes that declaration into the
 * profile's `cordis.patch.yml`, which is also the settings document on
 * 0.1.7: the generated rows live in a marked region the script owns and
 * rewrites in place, and everything else in the file — including the rows the
 * settings surface writes — is copied through byte-for-byte.
 *
 * Two rows cannot be copied verbatim, because a declarative preset has no
 * directory of its own and its rows resolve against the profile rather than
 * against the preset folder:
 *
 *   * a relative `./plugins/...` row name becomes a `file:///` URL (the same
 *     spelling the older filesystem roster accepts for a file row);
 *   * `skill-filesystem`'s `customSkillDirs` entry becomes that folder's
 *     absolute path instead of `new URL('skills/', baseUrl)`.
 *
 * Everything else — personas, groups, `isolate` realms, `!!js` platform
 * guards, block scalars — is indentation-only, so the two editions mount the
 * same composition.
 *
 * Usage:
 *   node scripts/mirror-agent-presets.mjs --profile desktop
 *   node scripts/mirror-agent-presets.mjs --profile desktop --dry-run
 *
 * Re-run it after editing any preset's `agent.cordis.yml`.
 */
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Begin/end of the region this script owns in the profile patch. */
const BEGIN = '# >>> dsh-workspace-presets: presets mirrored for DSH >= 0.1.7 (generated)'
const END = '# <<< dsh-workspace-presets: end generated region'
/** Settings section this plugin reads, which on 0.1.7 is its Loader entry id. */
const SETTINGS_ENTRY_ID = 'workspace-agent-presets'
const PACKAGE_NAME = 'dsh-workspace-presets'
const COMPOSITION_FILE = 'agent.cordis.yml'
const METADATA_FILE = 'preset.yml'
/** First roster order handed to a mirrored preset; shipped ones use 1..9. */
const FIRST_ORDER = 10
/**
 * Packages the newer line renamed, keyed by the spelling a preset authored on
 * the older line still carries.
 *
 * Such a row cannot simply be dropped: the two runtimes install different
 * packages under the two names, and a preset that has to mount on both cannot
 * name only one of them. Mirroring rewrites the package name to the newer
 * spelling and leaves the row's `id` and `config` alone, because the rename
 * kept both — the shipped 0.1.7 `standard` preset declares `workflow-ptc` with
 * the same `provider: spawn` the older line wrote for its worker-thread row.
 */
const RENAMED_PACKAGES = new Map([
  ['@deepseek-ai/dsh-workflow-worker-thread', '@deepseek-ai/dsh-workflow-ptc'],
])

function parseArgs(argv) {
  const args = { profile: undefined, dshHome: process.env.DSH_HOME, dryRun: false, restore: [], runtimeModules: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--profile') args.profile = argv[++index]
    else if (arg === '--dsh-home') args.dshHome = argv[++index]
    else if (arg === '--restore') parseRestore(argv[++index], args.restore)
    else if (arg === '--out') args.out = argv[++index]
    else if (arg === '--runtime-modules') args.runtimeModules.push(argv[++index])
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (!args.help && args.profile === undefined) throw new Error('--profile <name> is required')
  return args
}

/** Preset ids: every directory under the user root that carries a composition. */
function discoverPresets(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, COMPOSITION_FILE)))
    .map((entry) => entry.name)
    .sort()
}

/** Minimal `key: value` reader for a preset's metadata file. */
function readMetadata(file) {
  if (!existsSync(file)) return {}
  const meta = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z0-9]*):\s?(.*)$/.exec(line)
    if (match !== null) meta[match[1]] = match[2].trim()
  }
  return meta
}

/**
 * The composition body only. The leading comment block describes the file for
 * someone opening it directly and would land as noise inside the generated
 * `plugins:` list; comments below the first row carry per-section intent and are
 * kept, and block scalars are never touched — only the leading contiguous
 * comment/blank run is dropped.
 */
function compositionBody(text) {
  const lines = text.split(/\r?\n/)
  let start = 0
  while (start < lines.length) {
    const trimmed = lines[start].trim()
    if (trimmed !== '' && !trimmed.startsWith('#')) break
    start += 1
  }
  return lines.slice(start)
}

/**
 * Rewrite the rows that do not survive a move to a declarative preset.
 *
 * A declarative preset has no directory of its own — its rows resolve against
 * the profile — so a name relative to the preset folder becomes an absolute
 * `file:///` URL (the spelling the older filesystem roster also accepts for a
 * file row), and `skill-filesystem`'s `customSkillDirs` expression, which reads
 * `baseUrl` to find the folder, becomes that folder's absolute path. Rows the
 * newer line renamed are rewritten to the newer package name. Nothing else is
 * touched: indentation, comments, `!!js` guards and block scalars copy through.
 */
function rewriteRows(lines, folder) {
  const absoluteRow = (specifier) => `file:///${resolve(folder, specifier).replace(/\\/g, '/')}`
  const skillsDir = resolve(folder, 'skills').replace(/\\/g, '/')
  const out = []
  let insideSkillDirs = false
  for (const line of lines) {
    const name = /^(\s*name:\s*)'([^']*)'\s*$/.exec(line)
    if (name !== null) {
      const specifier = name[2]
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        out.push(`${name[1]}'${absoluteRow(specifier)}'`)
        continue
      }
      const renamed = RENAMED_PACKAGES.get(specifier)
      if (renamed !== undefined) {
        out.push(`${name[1]}'${renamed}'`)
        // Keep the row's own label in step with its package: the id is what the
        // settings surface lists, and a row called `workflow-worker-thread`
        // that loads `dsh-workflow-ptc` reads like a mistake.
        for (let index = out.length - 2; index >= 0; index -= 1) {
          const id = /^(\s*-\s*id:\s*)\S+\s*$/.exec(out[index])
          if (id !== null) {
            out[index] = `${id[1]}${renamed.split('/').pop()}`
            break
          }
        }
        continue
      }
    }
    if (/^\s*customSkillDirs:\s*$/.test(line)) {
      out.push(line)
      insideSkillDirs = true
      continue
    }
    if (insideSkillDirs && /^\s*-\s*!!js\s/.test(line)) {
      out.push(`${/^(\s*)/.exec(line)[1]}- ${skillsDir}`)
      insideSkillDirs = false
      continue
    }
    if (line.trim() !== '') insideSkillDirs = false
    out.push(line)
  }
  return out
}

/** One preset declaration, as a patch `insert` block. */
function presetBlock(id, order, root) {
  const folder = join(root, id)
  const meta = readMetadata(join(folder, METADATA_FILE))
  const body = rewriteRows(compositionBody(readFileSync(join(folder, COMPOSITION_FILE), 'utf8')), folder)
  const lines = [
    `# ${id}: mirrors ${COMPOSITION_FILE} from ${folder.replace(/\\/g, '/')}.`,
    '# The 0.1.5 line still loads that folder; this row is what 0.1.7 sees.',
    '- insert:',
    `    - id: preset-${id}`,
    "      name: '@deepseek-ai/dsh-agent-preset'",
    '      config:',
    `        id: ${id}`,
  ]
  if (meta.name !== undefined) lines.push(`        name: '${meta.name.replace(/'/g, "''")}'`)
  if (meta.description !== undefined) {
    lines.push('        description: |-')
    for (const line of meta.description.split(/\r?\n/)) lines.push(`          ${line}`)
  }
  lines.push(`        order: ${order}`, '        plugins:')
  // Ten spaces puts each copied row under `plugins:` at the depth the shipped
  // preset patches use, without reflowing any nested content.
  for (const line of body) lines.push(line === '' ? '' : `          ${line}`)
  return lines
}

/** Remove the previously generated region, if the file carries one. */
function stripRegion(text) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === BEGIN)
  if (start === -1) return lines
  const end = lines.findIndex((line, index) => index > start && line.trim() === END)
  return end === -1 ? lines.slice(0, start) : [...lines.slice(0, start), ...lines.slice(end + 1)]
}

/**
 * Ensure the plugin's settings row exists, so a binding recorded before 0.1.7
 * (when the section lived in `settings.yaml`) is not simply lost. An existing
 * row is never rewritten — after the first write from the settings surface the
 * bindings belong to the user, not to this script.
 */
function ensureSettingsRow(lines, bindings) {
  if (bindings.length === 0) return { lines, added: false }
  const hasRow = lines.some((line) => new RegExp(`^-\\s+id:\\s*${SETTINGS_ENTRY_ID}\\s*$`).test(line))
  if (hasRow) return { lines, added: false }
  const regionStart = lines.findIndex((line) => line.trim() === BEGIN)
  const block = [
    '',
    "# Restores the workspace -> preset bindings that lived in the section",
    '# `workspace-agent-presets` of the removed settings.yaml. On DSH >= 0.1.7',
    '# the section name is the Loader entry id, so the value rides this row.',
    `- id: ${SETTINGS_ENTRY_ID}`,
    `  name: '${PACKAGE_NAME}'`,
    '  config:',
    '    bindings:',
    ...bindings.flatMap((binding) => [
      `      - workspaceId: ${binding.workspaceId}`,
      `        agentPreset: ${binding.agentPreset}`,
    ]),
    '',
  ]
  const at = regionStart === -1 ? lines.length : regionStart
  return { lines: [...lines.slice(0, at), ...block, ...lines.slice(at)], added: true }
}

/** Bindings to restore, from `settings.yaml.imported`, as `--restore <w>:<p>` pairs. */
function parseRestore(value, out) {
  for (const pair of (value ?? '').split(',')) {
    if (pair.trim() === '') continue
    const [workspaceId, agentPreset] = pair.split(':')
    if (workspaceId === undefined || agentPreset === undefined) throw new Error(`--restore expects <workspaceId>:<presetId>, got "${pair}"`)
    out.push({ workspaceId: workspaceId.trim(), agentPreset: agentPreset.trim() })
  }
  return out
}

/** Drop the blank run a hand-maintained patch file tends to end with. */
function trimTrailingBlanks(lines) {
  let end = lines.length
  while (end > 0 && lines[end - 1].trim() === '') end -= 1
  return lines.slice(0, end)
}

function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  if (args.help) {
    console.log('usage: mirror-agent-presets.mjs --profile <name> [--dsh-home <dir>] [--restore <workspaceId>:<presetId>,...] [--dry-run]')
    return
  }
  const bindings = args.restore

  const dshHome = args.dshHome ?? join(homedir(), '.dsh')
  const presetRoot = join(dshHome, '.agent-presets')
  const patchPath = join(dshHome, 'profiles', args.profile, 'cordis.patch.yml')
  if (!existsSync(patchPath)) throw new Error(`no profile patch at ${patchPath}`)

  const presets = discoverPresets(presetRoot)
  if (presets.length === 0) throw new Error(`no presets with ${COMPOSITION_FILE} under ${presetRoot}`)

  const before = readFileSync(patchPath, 'utf8')
  const ensured = ensureSettingsRow(trimTrailingBlanks(stripRegion(before)), bindings)
  const region = [
    '',
    BEGIN,
    '# Written by scripts/mirror-agent-presets.mjs. DSH >= 0.1.7 reads presets',
    '# from declarations like these, not from the filesystem, so every preset',
    '# under ~/.dsh/.agent-presets is repeated here with its composition inlined.',
    '# Re-run the script instead of editing this region by hand.',
    '',
  ]
  presets.forEach((id, index) => {
    region.push(...presetBlock(id, FIRST_ORDER + index, presetRoot), '')
  })
  region.push(END)

  const regionText = region.join('\n')

  /*
   * Self-check the generated rows, because the realistic way this script
   * produces a broken preset is silently: a row name that resolves against the
   * profile instead of the preset folder mounts nothing, and DSH reports the
   * preset as broken in the roster rather than failing the boot. Only the
   * generated region is checked — a hand-written `./` row elsewhere in the
   * profile patch is legitimate and resolves against the profile on purpose.
   */
  const problems = []
  for (const match of regionText.matchAll(/name: '(file:\/\/\/[^']+)'/g)) {
    const path = fileURLToPath(match[1])
    if (!existsSync(path)) problems.push(`row names a file that does not exist: ${path}`)
  }
  for (const match of regionText.matchAll(/name: '\.\/[^']*'/g)) {
    problems.push(`profile-relative row name left in the generated region: ${match[0]}`)
  }
  // A preset id is also the directory name and the roster id; anything the
  // filesystem or the roster would reject must not reach the declaration.
  for (const match of regionText.matchAll(/^ {8}id: (.+?)\s*$/gm)) {
    if (!/^[a-z][a-z0-9-]*$/.test(match[1])) problems.push(`preset id is not a usable roster name: ${match[1]}`)
  }

  /*
   * Package rows, checked only against the roots the caller names. This one
   * cannot be guessed: the two DSH lines resolve a preset row from different
   * trees (an edition's own installation, its active profile), and a package
   * visible in some other profile's tree is exactly the trap — the row mounts
   * nowhere and the preset is reported broken, with the mistake visible only in
   * the host log. Pass every root the target profile can resolve from.
   */
  // Plugin rows only. The preset's own display `name:` sits at eight spaces and
  // is a label, not a specifier; a row's `name:` sits at twelve (ten for the
  // list item plus its key), and deeper inside a group.
  const packageRows = [...new Set([...regionText.matchAll(/^ {12,}name: '([^']*)'/gm)]
    .map((match) => match[1])
    .filter((name) => !name.startsWith('file:') && !name.includes(':'))
    .map((name) => name.split('/').slice(0, name.startsWith('@') ? 2 : 1).join('/')))]
  if (args.runtimeModules.length === 0) {
    console.log(`note: ${packageRows.length} package rows were NOT checked — pass --runtime-modules <dir> (repeatable) with the roots this profile resolves from`)
  } else {
    for (const name of packageRows) {
      const found = args.runtimeModules.some((root) => existsSync(join(root, name, 'package.json')))
      if (!found) problems.push(`package row cannot resolve from any --runtime-modules root: ${name}`)
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`error: ${problem}`)
    console.error('nothing written — fix the composition and re-run')
    process.exitCode = 1
    return
  }

  const next = `${[...ensured.lines, ...region].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
  const summary = [
    `profile patch: ${patchPath}`,
    `presets mirrored: ${presets.join(', ')}`,
    `settings row added: ${ensured.added ? 'yes' : 'already present'}`,
    `changed: ${next === before ? 'no' : 'yes'}`,
  ].join('\n')
  console.log(summary)
  if (args.dryRun || next === before) return
  // Atomic replace: the file is the settings document, and 0.1.7 watches it.
  const target = args.out ?? patchPath
  const temporary = `${target}.tmp-${process.pid}`
  writeFileSync(temporary, next, 'utf8')
  renameSync(temporary, target)
  console.log(`wrote ${next.length} bytes to ${target}`)
}

main()
