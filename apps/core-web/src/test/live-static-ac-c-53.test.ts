// Plan row W87 (step 109): the app-wide static test of AC-C-53 for the web console
// (04_client_integration_spec §13.5 AC-C-53, §12.2 TS-15; decision D121 ruling 4).
//
// AC-C-53: "No production file under `apps/core-web/src/features` ... imports `useSimActions` or reads
// `.actions` from a `Sim`". Each page row proved it for its own folder (client gate CLG item (c)); this
// file proves it once for every folder under `src/features`, so that a folder added after its row, or a
// file a later round moved, is still covered.
//
// | Rule | How it is read |
// |------|----------------|
// | No `useSimActions` in a production file of `src/features/**` | The identifier, in code (comments and quoted text left out) |
// | No `.actions` read on a `Sim` | Any `<expression>.actions` or `<expression>?.actions` in code, and any `{ actions } = <expression>`. Quoted text is no read: `t('common.actions.retry')` names a translation |
// | The fake transport stays out of the pages (TS-15) | No production file of `src/features/**` imports `@dems/shared/live/testing` or the console's harness |
// | `src/runtime/testing/**` is a harness, not production (D121 ruling 4) | It is the one non-test file of `src` that imports the fake transport; it is never imported by a page |
//
// It reads source text: what a file names, not what it does at run time.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// `import.meta.dirname` (Node, through Vitest): jsdom replaces the global `URL`, so no file URL is built here.
const SRC = resolve(import.meta.dirname, '..')
const FEATURES = join(SRC, 'features')

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

const posix = (path: string): string => relative(SRC, path).split(sep).join('/')

/** A test, a test folder, or a harness folder (`testing/`, D121 ruling 4): not production. */
const isTestOrHarness = (file: string): boolean =>
  /\.test\.tsx?$/.test(file) || file.includes('/__tests__/') || file.startsWith('test/') || /(?:^|\/)testing\//.test(file)

interface Source {
  readonly file: string
  readonly text: string
}

const SOURCES: readonly Source[] = filesUnder(SRC)
  .filter((path) => /\.(ts|tsx)$/.test(path) && !path.endsWith('.d.ts'))
  .map((path) => ({ file: posix(path), text: readFileSync(path, 'utf8') }))
  .sort((a, b) => a.file.localeCompare(b.file))
const FEATURE_PRODUCTION = SOURCES.filter(({ file }) => file.startsWith('features/') && !isTestOrHarness(file))

/** Code without its comments, so that a rule can be worded in a doc comment. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
}
/** Quoted text is no code: a translation key or a test ID that holds `.actions` is a word. */
function unquoted(text: string): string {
  return text.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''")
}

/** The simulator's action hook, put together here so that this file does not hold the name it looks for. */
const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('')
const HOOK = new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`)
/** A read of `actions` on an object: `x.actions`, `x?.actions`, `x().actions`, `x[0].actions`. */
const ACTIONS_READ = /(?:[\w$\])]\??)\.actions\b/g
/** `actions` taken out of an object: `const { actions } = …`, `{ store, actions: a } = …`. */
const ACTIONS_DESTRUCTURED = /\{[^{}]*\bactions\b[^{}]*\}\s*=(?!=)/g

/** What a production file says that AC-C-53 forbids, as `file: text` lines. */
function violationsOf(source: Source): string[] {
  const text = unquoted(code(source.text))
  const found: string[] = []
  if (HOOK.test(text)) found.push(`${source.file}: ${SIM_ACTIONS_HOOK}`)
  for (const match of text.matchAll(ACTIONS_READ)) found.push(`${source.file}: ${match[0]}`)
  for (const match of text.matchAll(ACTIONS_DESTRUCTURED)) found.push(`${source.file}: ${match[0].replace(/\s+/g, ' ')}`)
  return found
}

describe('AC-C-53 over every folder of `src/features` (the app-wide static test of W87)', () => {
  it('reads every feature folder and its production files, sub-folders included', () => {
    const folders = readdirSync(FEATURES).filter((name) => statSync(join(FEATURES, name)).isDirectory()).sort()
    // Every folder holds production code that this test reads; none is skipped.
    expect([...new Set(FEATURE_PRODUCTION.map(({ file }) => file.split('/')[1]))].sort()).toEqual(folders)
    expect(folders.length).toBeGreaterThanOrEqual(15)
    expect(FEATURE_PRODUCTION.length).toBeGreaterThan(200)
    // A test or a harness file is never counted as production.
    expect(FEATURE_PRODUCTION.filter(({ file }) => isTestOrHarness(file))).toEqual([])
  })

  it('the matcher finds what it looks for, and leaves words and plain parameters alone', () => {
    const flagged = (text: string): string[] => violationsOf({ file: 'sample.tsx', text })
    for (const sample of [
      `const actions = ${SIM_ACTIONS_HOOK}()`,
      'sim.actions.archiveEvidence(id)',
      'live.sim.actions.verify(id)',
      'useSim().actions.touch()',
      'source?.actions.signOut()',
      'const { store, actions } = sim',
      'const { actions: a } = useSimInstance()',
      'useSimStore((s) => s.actions)',
    ]) {
      expect(flagged(sample), sample).not.toEqual([])
    }
    for (const sample of [
      "t('common.actions.retry')",
      't("evidence.detail.actions.play")',
      '<span className="evi-detail-actions" />',
      "actions: Pick<CoreActions, 'inject' | 'verify'>,",
      'const actions = useCoreActions()',
      'settle(() => actions.archiveEvidence(id), handlers)',
      '// sim.actions.verify() is what the predecessor called',
    ]) {
      expect(flagged(sample), sample).toEqual([])
    }
  })

  it(`no production file of \`src/features\` calls ${SIM_ACTIONS_HOOK} or reads \`.actions\` from a \`Sim\``, () => {
    expect(FEATURE_PRODUCTION.flatMap(violationsOf)).toEqual([])
  })

  it('the Core actions of the pages come from the light Live API: `useCoreActions` (CL-12), never from `@dems/shared/sim`', () => {
    const users = FEATURE_PRODUCTION.filter(({ text }) => /\buseCoreActions\b/.test(code(text))).map(({ file }) => file)
    // Every folder that holds a settle site of §8.2 to §8.4 (classes A to D) takes its commands from the light Live API.
    const SITE_FOLDERS = ['dashboard', 'devices', 'evidence', 'login', 'security-audit', 'session-monitor', 'session-new', 'storage', 'system']
    expect([...new Set(users.map((file) => file.split('/')[1]))]).toEqual(expect.arrayContaining(SITE_FOLDERS))
    // One import statement at a time: the names between `import` and its own `from '…'` (no quote can be crossed).
    const fromSim = (text: string): string[] =>
      [...code(text).matchAll(/^\s*import\s+(?:type\s+)?([^'"]*?)\s+from\s+['"]@dems\/shared\/sim['"]/gm)].flatMap(
        (match) => (match[1] ?? '').match(new RegExp(`\\b(?:${SIM_ACTIONS_HOOK}|coreActionsOf|useCoreActions)\\b`, 'g')) ?? [],
      )
    expect(fromSim(`import { ${SIM_ACTIONS_HOOK}, useSim } from '@dems/shared/sim'`)).toEqual([SIM_ACTIONS_HOOK])
    expect(fromSim("import { coreActionsOf } from '@dems/shared/live'\nimport { useSim } from '@dems/shared/sim'")).toEqual([])
    expect(FEATURE_PRODUCTION.flatMap(({ file, text }) => fromSim(text).map((name) => `${file}: ${name}`))).toEqual([])
  })
})

describe('the fake transport stays out of the pages (TS-15), and `src/runtime/testing/**` is a harness (D121 ruling 4)', () => {
  const importsTesting = (text: string): boolean => /['"]@dems\/shared\/live\/testing['"]|['"][^'"]*runtime\/testing(?:\/[^'"]*)?['"]/.test(code(text))

  it('no production file of `src/features` imports the fake transport or the console`s Live harness', () => {
    expect(FEATURE_PRODUCTION.filter(({ text }) => importsTesting(text)).map(({ file }) => file)).toEqual([])
  })

  it('the one non-test file of `src` that imports the fake transport is the harness under `runtime/testing/`', () => {
    const importers = SOURCES.filter(({ file, text }) => !/\.test\.tsx?$/.test(file) && !file.includes('/__tests__/') && /['"]@dems\/shared\/live\/testing['"]/.test(code(text))).map(
      ({ file }) => file,
    )
    expect(importers.length).toBeGreaterThan(0)
    expect(importers.filter((file) => !file.startsWith('runtime/testing/') && !file.startsWith('test/'))).toEqual([])
  })
})
