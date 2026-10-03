/**
 * Content-Security-Policy of the packaged web build (06_packaging_spec §3.3, §3.5; D104).
 *
 * The packaged launcher (step 95) sends the policy as a response header on every response. The
 * build adds the same policy as a `<meta http-equiv>` tag, so the page is held to it even when the
 * dist is opened from another static server. Both are enforced together (the stricter wins), so
 * any later widening must change this module and the launcher header together.
 *
 * Header vs meta (the only two differences):
 * - `connect-src`: the header pins the launcher's runtime port (`ws://127.0.0.1:<port>`); the meta
 *   tag cannot know it at build time, so it allows the loopback WS on any port (`:*`). The
 *   intersection is the header's port.
 * - `frame-ancestors 'none'` is header-only: browsers ignore it in a meta tag (with a console
 *   warning), so the meta tag leaves it out.
 *
 * Why each source is there:
 * - `style-src 'unsafe-inline'`: Motion and React write inline `style` attributes; Scalar and the
 *   kit inject `<style>` elements.
 * - `img-src blob:`: the Login backdrop's baked still (`features/login/graded-still.ts`);
 *   `img-src data:`: SVG data URLs (`@dems/shared/brand` emblem). `media-src blob:` as specified.
 * - `font-src data:`: the bundled @fontsource-variable woff2 files are same-origin; `data:` covers
 *   fonts a library inlines.
 * - `worker-src blob:`: Scalar's blob-URL web worker (F-47).
 * - No host outside loopback appears anywhere (PK-13).
 *
 * The meta tag is emitted only by `vite build` with `VITE_DEMS_CORE_ORIGIN=same-origin`. Dev mode
 * (5173, with Vite's inline React-refresh preamble) and the default build (Core on
 * 127.0.0.1:4400, a different origin) get no meta tag.
 *
 * Node-safe and DOM-free: `vite.config.ts` imports it. Type-only Vite imports are erased.
 */
import type { HtmlTagDescriptor, Plugin } from 'vite'

/** The env key and its one meaningful value (06 §3.4). `core-endpoint.ts` reads the same pair. */
export const CORE_ORIGIN_ENV_KEY = 'VITE_DEMS_CORE_ORIGIN'
export const SAME_ORIGIN_CORE = 'same-origin'

export type CspDelivery = 'header' | 'meta'

export interface PackagedCspOptions {
  delivery: CspDelivery
  /** The launcher's listening port. Header delivery only; required there. */
  port?: number
}

/** The directives in the order of 06 §3.3, as `[name, sources]`. */
export function packagedCspDirectives({ delivery, port }: PackagedCspOptions): ReadonlyArray<readonly [string, string]> {
  if (delivery === 'header' && (port === undefined || !Number.isInteger(port) || port < 1 || port > 65535)) {
    throw new RangeError(`packagedCsp: header delivery needs the launcher port (1-65535), got ${String(port)}`)
  }
  const wsPort = delivery === 'header' ? String(port) : '*'
  const directives: Array<readonly [string, string]> = [
    ['default-src', "'self'"],
    ['script-src', "'self'"],
    ['style-src', "'self' 'unsafe-inline'"],
    ['img-src', "'self' data: blob:"],
    ['media-src', "'self' blob:"],
    ['font-src', "'self' data:"],
    ['worker-src', "'self' blob:"],
    ['connect-src', `'self' ws://127.0.0.1:${wsPort} ws://localhost:${wsPort}`],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
  ]
  if (delivery === 'header') directives.push(['frame-ancestors', "'none'"])
  return directives
}

/** The policy as one header or meta `content` value. */
export function packagedCsp(options: PackagedCspOptions): string {
  return packagedCspDirectives(options)
    .map(([name, sources]) => `${name} ${sources}`)
    .join('; ')
}

/** True only for `vite build` with `VITE_DEMS_CORE_ORIGIN=same-origin`. */
export function isPackagedBuild(command: 'build' | 'serve', env: Readonly<Record<string, unknown>>): boolean {
  return command === 'build' && env[CORE_ORIGIN_ENV_KEY] === SAME_ORIGIN_CORE
}

/** The tags the plugin injects: the CSP meta first in `<head>`, or nothing. */
export function packagedCspTags(command: 'build' | 'serve', env: Readonly<Record<string, unknown>>): HtmlTagDescriptor[] {
  if (!isPackagedBuild(command, env)) return []
  return [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: packagedCsp({ delivery: 'meta' }) },
      injectTo: 'head-prepend',
    },
  ]
}

/** Vite plugin: adds the CSP meta tag to index.html in the packaged build only. */
export function packagedCspPlugin(): Plugin {
  let tags: HtmlTagDescriptor[] = []
  return {
    name: 'dems:packaged-csp',
    apply: 'build',
    configResolved(config) {
      tags = packagedCspTags(config.command, config.env)
    },
    transformIndexHtml() {
      return tags
    },
  }
}
