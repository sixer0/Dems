// W56: what does Metro's RELEASE transform leave of the auth layer of LIVE mode?
//  1. Every production file of `apps/mobile/src/auth`: which modules does it load?
//  2. `live-auth-provider.tsx`: is the token storage (`./live-biometric`, and through it the
//     secure-store wrapper and `expo-device`) still a dependency, and is `biometricStoreOf` still
//     more than `return null`? (MD-6)
// The method of `51_release_gate_w51.cjs` and `15_release_gate_w15.cjs`: Babel with the app's
// preset, then Metro's inlinePlugin ({ dev }), then, for a release build only, its
// constantFoldingPlugin; dependencies are collected from what is left. Nothing is written.
//   node docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/56_release_gate_w56.cjs
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

// What a release bundle must not load through the auth layer: the token storage, the secure-store
// wrapper, the device module, the Live source, the typed client.
const HEAVY = ['./live-biometric', '@/runtime/secure-credentials', 'expo-device', '@dems/shared/live/source', '@dems/shared/client']
const TOKEN_STORE = 'live-biometric.ts'
const files = fs
  .readdirSync(path.join(app, 'src/auth'))
  .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
  .sort()

let failed = false
const check = (label, ok) => {
  if (!ok) failed = true
  return `${label}=${ok ? 'ok' : 'FAILED'}`
}

for (const dev of [true, false]) {
  const build = dev ? 'debug build  ' : 'release build'
  const loaded = {}
  for (const name of files) loaded[name] = transform(`src/auth/${name}`, dev)
  for (const name of files) console.log(build, name.padEnd(24), 'required:', JSON.stringify(loaded[name].required))
  const provider = loaded['live-auth-provider.tsx']
  const body = bodyOf(provider.code, 'biometricStoreOf')
  console.log(build, 'biometricStoreOf:', JSON.stringify(body === null ? null : body.length > 160 ? `${body.slice(0, 157)}...` : body))
  // Every file but the token storage itself: the token storage is reached through the provider alone.
  const shipped = files.filter((name) => name !== TOKEN_STORE)
  const heavyOf = (name) => HEAVY.filter((module) => loaded[name].required.includes(module))
  if (dev) {
    console.log(
      '   ',
      check('debug build: the provider loads the token storage', provider.required.includes('./live-biometric')),
      check('debug build: the token storage loads the wrapper and the device module', ['@/runtime/secure-credentials', 'expo-device'].every((module) => loaded[TOKEN_STORE].required.includes(module))),
      check('debug build: no other file loads them', shipped.filter((name) => name !== 'live-auth-provider.tsx').every((name) => heavyOf(name).length === 0)),
    )
  } else {
    console.log(
      '   ',
      check('release: no file of the auth layer that is part of the bundle loads the token storage, the wrapper, the device module, the Live source or the typed client', shipped.every((name) => heavyOf(name).length === 0)),
      check('release: biometricStoreOf is `return null`', body === 'return null;'),
      check('release: the provider names no secure item and no token storage', !/live-biometric|secure-credentials|createLiveBiometricStore/.test(provider.code)),
    )
  }
}
process.exit(failed ? 1 : 0)
