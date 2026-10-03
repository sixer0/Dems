// Step 100 (06_packaging_spec §3.3, §3.5; D104): the packaged-build Content-Security-Policy.
// The header form must equal the §3.3 text exactly (the step-95 launcher sends it); the meta form
// differs only where a meta tag must (no runtime port, no frame-ancestors). The Vite plugin emits
// the meta tag for `vite build` with VITE_DEMS_CORE_ORIGIN=same-origin and nothing otherwise.
import { describe, expect, it } from 'vitest'
import {
  CORE_ORIGIN_ENV_KEY,
  isPackagedBuild,
  packagedCsp,
  packagedCspDirectives,
  packagedCspPlugin,
  packagedCspTags,
  SAME_ORIGIN_CORE,
} from '../packaged-csp'

/** 06_packaging_spec.md §3.3 "Security headers on every response", with <port> = 4410. */
const SPEC_HEADER_4410 =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; worker-src 'self' blob:; " +
  "connect-src 'self' ws://127.0.0.1:4410 ws://localhost:4410; object-src 'none'; base-uri 'self'; " +
  "form-action 'self'; frame-ancestors 'none'"

const PACKAGED_ENV = { [CORE_ORIGIN_ENV_KEY]: SAME_ORIGIN_CORE }

describe('packagedCsp', () => {
  it('header delivery equals the spec text for the launcher port', () => {
    expect(packagedCsp({ delivery: 'header', port: 4410 })).toBe(SPEC_HEADER_4410)
    expect(packagedCsp({ delivery: 'header', port: 4417 })).toContain('ws://127.0.0.1:4417 ws://localhost:4417')
  })

  it('meta delivery: loopback WS on any port, and no frame-ancestors (ignored in meta)', () => {
    const meta = packagedCsp({ delivery: 'meta' })
    expect(meta).toBe(
      SPEC_HEADER_4410.replace(/:4410/g, ':*').replace("; frame-ancestors 'none'", ''),
    )
    expect(meta).not.toContain('frame-ancestors')
  })

  it('meta and header differ only in connect-src and frame-ancestors', () => {
    const header = new Map(packagedCspDirectives({ delivery: 'header', port: 4410 }))
    const meta = new Map(packagedCspDirectives({ delivery: 'meta' }))
    const differing = [...header.keys()].filter((name) => header.get(name) !== meta.get(name))
    expect(differing.sort()).toEqual(['connect-src', 'frame-ancestors'])
  })

  it('names no host outside loopback and no unsafe-eval (PK-13)', () => {
    for (const policy of [packagedCsp({ delivery: 'meta' }), packagedCsp({ delivery: 'header', port: 4410 })]) {
      expect(policy).not.toMatch(/https?:/)
      expect(policy).not.toContain('unsafe-eval')
      expect(policy).not.toMatch(/(^|\s)\*(\s|;|$)/) // no bare wildcard source
      const hosts = [...policy.matchAll(/wss?:\/\/([^\s:;]+)/g)].map((match) => match[1])
      expect(new Set(hosts)).toEqual(new Set(['127.0.0.1', 'localhost']))
    }
  })

  it('header delivery without a valid port is a programming error', () => {
    expect(() => packagedCsp({ delivery: 'header' })).toThrow(RangeError)
    expect(() => packagedCsp({ delivery: 'header', port: 0 })).toThrow(RangeError)
    expect(() => packagedCsp({ delivery: 'header', port: 70000 })).toThrow(RangeError)
    expect(() => packagedCsp({ delivery: 'header', port: 44.1 })).toThrow(RangeError)
  })
})

describe('packagedCspPlugin (Vite html transform)', () => {
  it('only `vite build` with VITE_DEMS_CORE_ORIGIN=same-origin is the packaged build', () => {
    expect(isPackagedBuild('build', PACKAGED_ENV)).toBe(true)
    expect(isPackagedBuild('serve', PACKAGED_ENV)).toBe(false) // dev server (5173) stays CSP-free
    expect(isPackagedBuild('build', {})).toBe(false) // default build: Core on 127.0.0.1:4400
    expect(isPackagedBuild('build', { [CORE_ORIGIN_ENV_KEY]: 'true' })).toBe(false)
  })

  it('packaged build: one CSP meta tag, prepended to <head> so it precedes every script', () => {
    expect(packagedCspTags('build', PACKAGED_ENV)).toEqual([
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: packagedCsp({ delivery: 'meta' }) },
        injectTo: 'head-prepend',
      },
    ])
  })

  it('dev server and default build: no tag', () => {
    expect(packagedCspTags('serve', PACKAGED_ENV)).toEqual([])
    expect(packagedCspTags('serve', {})).toEqual([])
    expect(packagedCspTags('build', {})).toEqual([])
  })

  it('the plugin applies to build only and returns the tags configResolved computed', () => {
    const run = (command: 'build' | 'serve', env: Record<string, unknown>) => {
      const plugin = packagedCspPlugin()
      const configResolved = plugin.configResolved as (config: { command: string; env: Record<string, unknown> }) => void
      const transform = plugin.transformIndexHtml as () => unknown
      configResolved({ command, env })
      return { plugin, tags: transform() }
    }
    const packaged = run('build', PACKAGED_ENV)
    expect(packaged.plugin.name).toBe('dems:packaged-csp')
    expect(packaged.plugin.apply).toBe('build')
    expect(packaged.tags).toEqual(packagedCspTags('build', PACKAGED_ENV))
    expect(run('build', {}).tags).toEqual([])
  })
})
