// W15: what does Metro's RELEASE transform leave of the probe?
//  1. `debug.ts`: is `./dev-probes` (and through it the probe) still a dependency? (W12's check, repeated.)
//  2. `secure-credentials.ts`: is the probe-only export, with the probe item's name, still in the code?
// Mirrors metro-transform-worker (node_modules/metro-transform-worker/src/index.js): Babel with the
// app's preset, then Metro's inlinePlugin ({ dev }), then, for a release build only, its
// constantFoldingPlugin; dependencies are collected from what is left.
//   node docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/15_release_gate_w15.cjs
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

let failed = false
const check = (label, ok) => {
  if (!ok) failed = true
  return `${label}=${ok ? 'ok' : 'FAILED'}`
}
for (const dev of [true, false]) {
  const build = dev ? 'debug build  (dev=true) ' : 'release build (dev=false)'
  const debug = transform('src/runtime/debug.ts', dev)
  const wrapper = transform('src/runtime/secure-credentials.ts', dev)
  const debugFacts = { required: debug.required, hasProbeModule: debug.code.includes('dev-probes'), hasProbeHook: debug.code.includes('runDevProbe(') }
  const wrapperFacts = {
    required: wrapper.required,
    hasProbeItemName: wrapper.code.includes('dems.live.probe.v1'),
    hasProbePromptTitle: wrapper.code.includes('DEMS secure-store probe'),
    probeExport: /secureStoreDevProbe\s*=\s*null\b/.test(wrapper.code) ? 'null' : 'object',
    hasDeviceItemName: wrapper.code.includes('dems.live.device.v1'),
    hasUnprotectedRule: wrapper.code.includes('isUnprotectedBiometricItemAllowed'),
  }
  console.log(build, 'debug.ts             ', JSON.stringify(debugFacts))
  console.log(build, 'secure-credentials.ts', JSON.stringify(wrapperFacts))
  if (dev) {
    console.log('   ', check('debug build holds the probe', debugFacts.hasProbeModule && wrapperFacts.hasProbeItemName && wrapperFacts.probeExport === 'object'))
  } else {
    console.log(
      '   ',
      check('release build holds no probe', !debugFacts.hasProbeModule && !debugFacts.hasProbeHook && !wrapperFacts.hasProbeItemName && !wrapperFacts.hasProbePromptTitle && wrapperFacts.probeExport === 'null'),
      check('release build keeps the wrapper', wrapperFacts.hasDeviceItemName && wrapperFacts.hasUnprotectedRule),
    )
    const rule = /function isUnprotectedBiometricItemAllowed\(\)\s*\{([^}]*)\}/.exec(wrapper.code)
    console.log('    MB-6a rule as a release build holds it:', rule ? rule[1].trim().replace(/\s+/g, ' ') : '(not found)')
  }
}
process.exit(failed ? 1 : 0)
