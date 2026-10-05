// Plan row W50: what holds for the source text of the console (backend task
// 04_client_integration_spec §2 "two subpaths", MD-6, TS-15, WT-2; AC-C-102; brief list rows 1 and
// 21 of implementation/44_live_source.md §17.4).
//
// | Rule | Why |
// |------|-----|
// | The typed client and the Live source are loaded as VALUES by one file, `runtime/live-start.ts` | A page never builds a typed client: a request sent around the Live source is not seen by it (row 21) |
// | `runtime/live-start.ts` is reached by ONE dynamic import, in `runtime/boot.ts`, behind `import.meta.env.DEV` | MD-6: a production or packaged build carries no client and no socket code path that can run |
// | `main.tsx` imports nothing statically that builds a zod schema | The packaged CSP: zod's JIT is switched off before the first schema is built |
// | No production file imports the fake transport or the test harness | TS-15 |
// | The proxy block of `vite.config.ts` sets `target` (and `ws`) and nothing else | WT-2, AC-C-102: the Core server's Origin guard must see what the browser sent |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// `import.meta.dirname` (Node, through Vitest): jsdom replaces the global `URL`, so no file URL is built here.
const SRC = resolve(import.meta.dirname, '..')
const WEB = resolve(import.meta.dirname, '../..')

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

const posix = (path: string): string => relative(SRC, path).split(sep).join('/')

const isTestFile = (file: string): boolean =>
  /\.test\.tsx?$/.test(file) || file.includes('/__tests__/') || file.startsWith('test/') || file.startsWith('runtime/testing/')

const SOURCES = filesUnder(SRC)
  .filter((path) => /\.(ts|tsx)$/.test(path) && !path.endsWith('.d.ts'))
  .map((path) => ({ file: posix(path), text: readFileSync(path, 'utf8') }))
const PRODUCTION = SOURCES.filter(({ file }) => !isTestFile(file))

/** Comments removed, so a rule can be worded in a doc comment without tripping the test of that rule. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
}

interface ImportUse {
  specifier: string
  kind: 'value' | 'type' | 'dynamic'
}

function importsOf(text: string): ImportUse[] {
  const source = code(text)
  const found: ImportUse[] = []
  for (const match of source.matchAll(/^\s*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
    found.push({ specifier: match[3] ?? '', kind: match[2] ? 'type' : 'value' })
  }
  for (const match of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    // `typeof import('…')` is a type query: it loads nothing.
    const before = source.slice(Math.max(0, (match.index ?? 0) - 8), match.index ?? 0)
    found.push({ specifier: match[1] ?? '', kind: /typeof\s*$/.test(before) ? 'type' : 'dynamic' })
  }
  return found
}

const usesOf = (specifier: string | RegExp, kinds: readonly ImportUse['kind'][]): string[] =>
  PRODUCTION.filter(({ text }) =>
    importsOf(text).some((use) => kinds.includes(use.kind) && (typeof specifier === 'string' ? use.specifier === specifier : specifier.test(use.specifier))),
  )
    .map(({ file }) => file)
    .sort()

describe('the scan itself', () => {
  it('reads the console\'s sources and tells production files from tests', () => {
    expect(PRODUCTION.length).toBeGreaterThan(150)
    expect(PRODUCTION.map(({ file }) => file)).toEqual(expect.arrayContaining(['main.tsx', 'router.tsx', 'routes/__root.tsx', 'runtime/boot.ts', 'runtime/live-start.ts', 'lib/core-errors.ts']))
    expect(PRODUCTION.filter(({ file }) => file.startsWith('runtime/testing/') || file.includes('.test.'))).toEqual([])
    expect(importsOf("import type { A } from 'x'\nimport { type B, c } from 'y'\nconst z = await import('./z')\ntype T = typeof import('./t')\n// import 'commented'")).toEqual([
      { specifier: 'x', kind: 'type' },
      { specifier: 'y', kind: 'value' },
      { specifier: './z', kind: 'dynamic' },
      { specifier: './t', kind: 'type' },
    ])
  })
})

describe('the heavy modules have one way in (MD-6; brief list rows 1, 21)', () => {
  it('`@dems/shared/client` and `@dems/shared/live/source` are loaded as values only by `runtime/live-start.ts`', () => {
    expect(usesOf('@dems/shared/client', ['value', 'dynamic'])).toEqual(['runtime/live-start.ts'])
    expect(usesOf('@dems/shared/live/source', ['value', 'dynamic'])).toEqual(['runtime/live-start.ts'])
  })

  it('no typed client is built anywhere else: `createCoreClient` and `createLiveSim` are named in that one file', () => {
    for (const name of ['createCoreClient', 'createLiveSim']) {
      const named = PRODUCTION.filter(({ text }) => new RegExp(`\\b${name}\\b`).test(code(text))).map(({ file }) => file)
      expect(named, name).toEqual(['runtime/live-start.ts'])
    }
  })

  it('`runtime/live-start.ts` is reached by one dynamic import, in `runtime/boot.ts`, and that import stands behind `import.meta.env.DEV`', () => {
    const liveStart = /(^|\/)live-start$/
    expect(usesOf(liveStart, ['value'])).toEqual([])
    expect(usesOf(liveStart, ['dynamic'])).toEqual(['runtime/boot.ts'])
    const boot = code(PRODUCTION.find(({ file }) => file === 'runtime/boot.ts')?.text ?? '')
    const dynamicImports = [...boot.matchAll(/\(\)\s*=>\s*import\(\s*['"]\.\/live-start['"]\s*\)/g)]
    expect(dynamicImports).toHaveLength(1)
    // The one expression: `import.meta.env.DEV ? () => import('./live-start') : null`.
    expect(boot).toMatch(/import\.meta\.env\.DEV\s*\?\s*\(\)\s*=>\s*import\(\s*['"]\.\/live-start['"]\s*\)\s*:\s*null/)
  })

  it('`main.tsx` loads its data source after `z.config`: its static imports are the ones it has always had, plus the i18n provider', () => {
    const main = PRODUCTION.find(({ file }) => file === 'main.tsx')?.text ?? ''
    expect(
      importsOf(main)
        .filter((use) => use.kind === 'value')
        .map((use) => use.specifier),
    ).toEqual([
      '@fontsource-variable/orbitron',
      '@fontsource-variable/inter',
      '@fontsource-variable/jetbrains-mono',
      './index.css',
      'react',
      'react-dom/client',
      '@tanstack/react-query',
      '@tanstack/react-router',
      'react-i18next',
      'zod',
    ])
    const afterConfig = code(main).split('z.config({ jitless: true })')[1] ?? ''
    expect(importsOf(main).filter((use) => use.kind === 'dynamic').map((use) => use.specifier)).toEqual([
      './runtime/boot',
      './i18n',
      './router',
      './runtime/live-host-refusal',
    ])
    // Every one of them stands after the call.
    for (const specifier of ['./runtime/boot', './i18n', './router', './runtime/live-host-refusal']) {
      expect(afterConfig, specifier).toContain(`import('${specifier}')`)
    }
  })
})

describe('test doubles stay out of production files (TS-15)', () => {
  it('no production file imports the fake transport or the test harness', () => {
    expect(usesOf('@dems/shared/live/testing', ['value', 'type', 'dynamic'])).toEqual([])
    expect(usesOf(/(^|\/)testing\/live-harness$/, ['value', 'type', 'dynamic'])).toEqual([])
    expect(usesOf(/^@testing-library\//, ['value', 'type', 'dynamic'])).toEqual([])
  })

  it('the harness is the one non-test file that imports the fake transport', () => {
    const importers = SOURCES.filter(({ file, text }) => !/\.test\.tsx?$/.test(file) && importsOf(text).some((use) => use.specifier === '@dems/shared/live/testing')).map(
      ({ file }) => file,
    )
    expect(importers).toEqual(['runtime/testing/live-harness.ts'])
  })
})

describe('the dev proxy passes the request through (WT-2; AC-C-102, the static half)', () => {
  const config = readFileSync(join(WEB, 'vite.config.ts'), 'utf8')
  const source = code(config)
  const start = source.indexOf('function coreDevProxy')
  const end = source.indexOf('\n}\n', start)
  const body = source.slice(start, end)

  it('the block is found, and it is the only place of the file that names a proxy', () => {
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(body).toContain('proxy:')
    expect(source.slice(0, start) + source.slice(end)).not.toMatch(/\bproxy\s*:/)
  })

  it('no `headers`, no `changeOrigin`, no rewrite hook: an entry holds `target` (and `ws`) and nothing else', () => {
    for (const forbidden of ['headers', 'changeOrigin', 'rewriteWsOrigin', 'rewrite', 'configure', 'bypass', 'xfwd', 'autoRewrite', 'cookieDomainRewrite', 'cookiePathRewrite', 'selfHandleResponse', 'auth']) {
      expect(body, forbidden).not.toMatch(new RegExp(`\\b${forbidden}\\b`))
    }
    const entries = [...body.matchAll(/'(\/[^']*)'\s*:\s*\{([^}]*)\}/g)].map((match) => ({
      path: match[1],
      keys: (match[2] ?? '')
        .split(',')
        .map((part) => part.split(':')[0]?.trim() ?? '')
        .filter((key) => key !== ''),
    }))
    expect(entries).toEqual([
      { path: '/api/v1', keys: ['target'] },
      { path: '/ws', keys: ['target', 'ws'] },
    ])
    // The dev server's own CORS layer is off while the proxy is on (decisions D29, D34).
    expect(body).toMatch(/cors:\s*false/)
    // The target is the loopback address of the Core server, by its port.
    expect(body).toContain('const target = `http://127.0.0.1:${port}`')
  })
})
