// W12: is `./dev-probes` a dependency of `debug.ts` in a release bundle?
// Mirrors metro-transform-worker (node_modules/metro-transform-worker/src/index.js:176-212): Babel with
// the app's preset, then Metro's inlinePlugin ({ dev }), then, for a release build only, its
// constantFoldingPlugin; dependencies are collected from what is left.
//   node .cache/proof-harness/release_gate_w12.cjs
const path = require('node:path')
const fs = require('node:fs')
const root = path.resolve(__dirname, '../..')
const req = (name) => require(require.resolve(name, { paths: [path.join(root, 'apps/mobile'), root] }))
const babel = req('@babel/core')
const plugins = req('metro-transform-plugins')
const file = path.join(root, 'apps/mobile/src/runtime/debug.ts')
const source = fs.readFileSync(file, 'utf8')

function dependenciesOf(dev) {
  const first = babel.transformSync(source, {
    ast: true, code: false, babelrc: false, configFile: false, filename: file, cwd: path.join(root, 'apps/mobile'),
    caller: { name: 'metro', bundler: 'metro', platform: 'android', isDev: dev, isServer: false, supportsStaticESM: false },
    presets: [[require.resolve('babel-preset-expo', { paths: [path.join(root, 'apps/mobile'), root] }), {}]],
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
  const required = [...code.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((m) => m[2])
  return { required: [...new Set(required)], hasProbeModule: code.includes('dev-probes'), hasProbeHook: code.includes('runDevProbe('), hasParser: code.includes('devProbeFromUrl') }
}
for (const dev of [true, false]) console.log(dev ? 'debug build  (dev=true) ' : 'release build (dev=false)', JSON.stringify(dependenciesOf(dev)))
