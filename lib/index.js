/**
 * Host plugin that contributes the `grill-me` skill to DeepSeek Harness.
 *
 * The skill body and routing metadata live in `skills/grill-me/SKILL.md`, so the
 * file stays the single source of truth: `list()` re-reads it for the catalog and
 * `get()` re-reads it for every load. A directory watcher invalidates the skill
 * catalog when that file changes.
 *
 * @module dsh-grill-me-faht
 */

import { readFile } from 'node:fs/promises'
import { watch } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'grill-me'
export const inject = ['skills']

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_DIR = join(PACKAGE_ROOT, 'skills', 'grill-me')
const SKILL_FILE = join(SKILL_DIR, 'SKILL.md')
const SKILL_NAME = 'grill-me'
const PROVIDER_NAME = 'grill-me'
/** Same precedence bucket as other packaged skill roots. */
const RANK = 600
const DEFAULT_DESCRIPTION = 'Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when the user wants to stress-test a plan, get grilled on their design, or says "grill me".'

/** Register the skill provider and its file watcher. */
export function apply(ctx) {
  let provider
  ctx.skills.registerProvider((control) => {
    provider = new GrillMeProvider(ctx, control)
    return provider
  })
  ctx.effect(function* () {
    yield () => provider?.dispose()
  }, 'grill-me skill watcher')
}

/** Provider that serves one skill from this package's SKILL.md. */
class GrillMeProvider {
  constructor(ctx, control) {
    this.ctx = ctx
    this.name = PROVIDER_NAME
    this.control = control
    this.disposed = false
    this.watcher = undefined
    this.timer = undefined
    this.startWatching()
  }

  /** Return the current catalog: one skill when its file is readable and valid. */
  async list(options) {
    const parsed = await this.read(options)
    if (parsed === undefined) return []
    return [this.candidate(parsed)]
  }

  /** Return the full skill body for a previously listed candidate. */
  async get(_candidate, options) {
    const parsed = await this.read(options)
    if (parsed === undefined) return undefined
    return { ...this.candidate(parsed), content: parsed.body }
  }

  candidate(parsed) {
    return {
      name: SKILL_NAME,
      description: parsed.description,
      ...(parsed.whenToUse === undefined ? {} : { whenToUse: parsed.whenToUse }),
      invocation: parsed.invocation,
      provider: PROVIDER_NAME,
      source: 'bundled',
      rank: RANK,
      locator: SKILL_FILE,
      path: SKILL_FILE,
      resourceBase: { kind: 'directory', path: SKILL_DIR },
    }
  }

  async read(options) {
    const signal = options?.signal
    if (this.disposed) return undefined
    let text
    try {
      text = await readFile(SKILL_FILE, { encoding: 'utf8', signal })
    } catch (error) {
      if (signal?.aborted) throw error
      this.ctx.logger?.warn?.(`grill-me: cannot read ${SKILL_FILE}: ${String(error)}`)
      return undefined
    }
    signal?.throwIfAborted()
    const parsed = parseSkillText(text)
    if (parsed === undefined) {
      this.ctx.logger?.warn?.(`grill-me: ${SKILL_FILE} has no usable frontmatter; the skill is not offered`)
      return undefined
    }
    return parsed
  }

  startWatching() {
    this.control.signal.addEventListener('abort', () => this.dispose(), { once: true })
    try {
      this.watcher = watch(SKILL_DIR, { persistent: false }, () => this.queueInvalidate())
      this.watcher.on('error', () => {})
    } catch (error) {
      this.ctx.logger?.warn?.(`grill-me: skill file watch unavailable: ${String(error)}`)
      this.watcher = undefined
    }
  }

  queueInvalidate() {
    if (this.disposed) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (!this.disposed) this.control.invalidate()
    }, 100)
    this.timer.unref?.()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    clearTimeout(this.timer)
    this.watcher?.close()
    this.watcher = undefined
  }
}

/**
 * Parse the small frontmatter subset this skill uses.
 * @param {string} text raw SKILL.md content.
 * @returns {{ description: string, whenToUse?: string, invocation: { modelInvocable: boolean, userInvocable: boolean }, body: string } | undefined}
 */
function parseSkillText(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (match === null) return undefined
  const fields = {}
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const colon = line.indexOf(':')
    if (colon < 1) continue
    const key = line.slice(0, colon).trim()
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) continue
    fields[key] = unquote(line.slice(colon + 1).trim())
  }
  if (fields.name !== undefined && fields.name !== SKILL_NAME) return undefined
  const body = text.slice(match[0].length).trim()
  if (body.length === 0) return undefined
  return {
    description: fields.description?.length > 0 ? fields.description : DEFAULT_DESCRIPTION,
    ...(fields.whenToUse?.length > 0 ? { whenToUse: fields.whenToUse } : {}),
    invocation: {
      modelInvocable: readBoolean(fields['disable-model-invocation']) !== true,
      userInvocable: readBoolean(fields['user-invocable']) !== false,
    },
    body,
  }
}

function readBoolean(value) {
  if (value === undefined) return undefined
  const lowered = value.toLowerCase()
  if (lowered === 'true' || lowered === 'yes' || lowered === 'on' || lowered === '1') return true
  if (lowered === 'false' || lowered === 'no' || lowered === 'off' || lowered === '0') return false
  return undefined
}

function unquote(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value)
    } catch {
      return value.slice(1, -1)
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'")
  }
  const comment = value.indexOf(' #')
  return (comment >= 0 ? value.slice(0, comment) : value).trim()
}
