// W51: what does Metro's RELEASE transform leave of the Live layer and of the debug hooks?
//  1. `sim-adapters.ts`: are the Live source, the typed client and the secure-store wrapper still
//     dependencies, and is `createMobileLive` still more than `return null`? (MD-6)
//  2. `debug.ts`: is the probe module still a dependency (W12's and W15's check, repeated), and is
//     the `core=` parameter still applied? (MD-7)
//  3. `sim-runtime-provider.tsx`, `core-errors.ts`, `use-health.ts`: which modules do they load?
// Mirrors metro-transform-worker (node_modules/metro-transform-worker/src/index.js): Babel with the
// app's preset, then Metro's inlinePlugin ({ dev }), then, for a release build only, its
// constantFoldingPlugin; dependencies are collected from what is left. The same method as
// `15_release_gate_w15.cjs`.
//   node docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/51_release_gate_w51.cjs
const path = require('node:path')
const fs = require('node:fs')
const root = path.resolve(__dirname, '../../../..')
const app = path.join(root, 'apps/mobile')
const req = (name) => require(require.resolve(name, { paths: [app, root] }))
const babel = req('@babel/core')
const plugins = req('metro-transform-plugins')

function transform(relative, dev) {
  const file = path.join(app, relative)
  const source = fs.readFileSync(file, 'utf8')
  const first = babel.transformSync(source, {
    ast: true, code: false, babelrc: false, configFile: false, filename: file, cwd: app,
    caller: { name: 'metro', bundler: 'metro', platform: 'android', isDev: dev, isServer: false, supportsStaticESM: false },
    presets: [[require.resolve('babel-preset-expo', { paths: [app, root] }), {}]],
  })
  let ast = babel.transformFromAstSync(first.ast, '', {
    ast: true, code: false, babelrc: false, configFile: false, cloneInputAst: true, filename: file,
    plugins: [[plugins.inlinePlugin, { dev, inlinePlatform: true, isWrapped: false, platform: 'android' }]],
  }).ast
  if (!dev) {
    ast = babel.transformFromAstSync(ast, '', {
      ast: true, code: false, babelrc: false, configFile: false, cloneInputAst: false, filename: file,
      plugins: [plugins.constantFoldingPlugin],
    }).ast
  }
  const code = babel.transformFromAstSync(ast, '', { code: true, comments: false, babelrc: false, configFile: false, filename: file }).code
  const required = [...new Set([...code.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((m) => m[2]))]
  return { code, required }
}

/** The body of a function declaration, without white space, or null. */
function bodyOf(code, name) {
  const start = code.search(new RegExp(`function ${name}\\(`))
  if (start < 0) return null
  const open = code.indexOf('{', code.indexOf(')', start))
  let depth = 0
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1
    else if (code[i] === '}') {
      depth -= 1
      if (depth === 0) return code.slice(open + 1, i).replace(/\s+/g, ' ').trim()
    }
  }
  return null
}

const HEAVY = ['@dems/shared/live/source', '@dems/shared/client', './secure-credentials', 'expo-device', 'expo-constants']
let failed = false
const check = (label, ok) => {
  if (!ok) failed = true
  return `${label}=${ok ? 'ok' : 'FAILED'}`
}
const short = (text) => (text === null ? '(not found)' : text.length > 120 ? `${text.slice(0, 117)}...` : text)

for (const dev of [true, false]) {
  const build = dev ? 'debug build  (dev=true) ' : 'release build (dev=false)'
  const adapters = transform('src/runtime/sim-adapters.ts', dev)
  const debug = transform('src/runtime/debug.ts', dev)
  const provider = transform('src/runtime/sim-runtime-provider.tsx', dev)
  const errors = transform('src/runtime/core-errors.ts', dev)
  const health = transform('src/features/home/use-health.ts', dev)

  const adapterFacts = {
    required: adapters.required,
    heavy: HEAVY.filter((name) => adapters.required.includes(name)),
    createMobileLive: short(bodyOf(adapters.code, 'createMobileLive')),
    hasCreateLiveSim: adapters.code.includes('createLiveSim'),
    hasCreateCoreClient: adapters.code.includes('createCoreClient'),
    hasBearer: adapters.code.includes('Bearer '),
    hasDevLogTag: adapters.code.includes('DEMS-LIVE'),
  }
  const debugFacts = {
    required: debug.required,
    hasProbeModule: debug.code.includes('dev-probes'),
    applyCoreSourceFromUrl: short(bodyOf(debug.code, 'applyCoreSourceFromUrl')),
    hasCoreParser: debug.code.includes('coreSourceFromUrl'),
  }
  console.log(build, 'sim-adapters.ts         ', JSON.stringify(adapterFacts))
  console.log(build, 'debug.ts                ', JSON.stringify(debugFacts))
  console.log(build, 'sim-runtime-provider.tsx', JSON.stringify({ required: provider.required }))
  console.log(build, 'core-errors.ts          ', JSON.stringify({ required: errors.required }))
  console.log(build, 'use-health.ts           ', JSON.stringify({ required: health.required }))
  const others = [...provider.required, ...errors.required, ...health.required, ...debug.required]
  if (dev) {
    console.log(
      '   ',
      check('debug build loads the Live source, the typed client and the wrapper', HEAVY.every((name) => adapters.required.includes(name)) && adapterFacts.hasCreateLiveSim && adapterFacts.hasCreateCoreClient),
      check('debug build applies core=', debugFacts.applyCoreSourceFromUrl !== '' && debugFacts.applyCoreSourceFromUrl !== null && /setCoreLinkSource\)\(_?source\)/.test(debug.code)),
    )
  } else {
    console.log(
      '   ',
      check('release: sim-adapters.ts loads none of the five modules', adapterFacts.heavy.length === 0),
      // What is left is the default of the unused parameter and `return null;`: no `require`, no call.
      check('release: createMobileLive is `return null`', /^(?:var options = [^;]*; )?return null;$/.test(bodyOf(adapters.code, 'createMobileLive') ?? '')),
      check('release: no createLiveSim, no createCoreClient, no bearer header, no request log', !adapterFacts.hasCreateLiveSim && !adapterFacts.hasCreateCoreClient && !adapterFacts.hasBearer && !adapterFacts.hasDevLogTag),
    )
    console.log(
      '   ',
      check('release: debug.ts holds no probe', !debugFacts.hasProbeModule),
      check('release: core= is not applied (empty function)', debugFacts.applyCoreSourceFromUrl === '' && !/setCoreLinkSource\)\(_?source\)/.test(debug.code)),
      check('release: no other file of the row loads the Live source or the typed client', !others.some((name) => name === '@dems/shared/live/source' || name === '@dems/shared/client' || name === './secure-credentials')),
    )
  }
}
process.exit(failed ? 1 : 0)
