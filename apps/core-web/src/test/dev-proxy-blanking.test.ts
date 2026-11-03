// Review finding R93-09 (fix pass F-M8): the dev proxy prints the request URL of every proxy error,
// and for the media route and the export download route that URL ends in a signed bearer value.
// The entry's `configure` registers a listener BEFORE Vite's own; it blanks the path on the request
// Vite is about to print. This test plays Vite's part: `configure` first, then a listener that
// prints `res.req.url` as Vite does (`vite/dist/node/chunks/node.js`, "http proxy error").
import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { blankSignedPathOnProxyError } from '../../vite.config'

const TOKEN = 'mts_CANARYone7Qm4xZp0Lk2'

/** What Vite does with one proxy entry: `configure`, then its own error listener. Returns what it would print. */
function proxyErrorLine(url: string, configure: ((proxy: EventEmitter) => void) | null): string {
  const proxy = new EventEmitter()
  const printed: string[] = []
  configure?.(proxy)
  proxy.on('error', (_error: unknown, _request: unknown, response: { req: { url: string } }) => printed.push(`http proxy error: ${response.req.url}`))
  const request = { url }
  proxy.emit('error', new Error('socket hang up'), request, { req: request })
  return printed.join('\n')
}

describe('R93-09: a proxy error of a signed path is printed without the path', () => {
  it('CONTROL of the finding: without the listener the token is in the line Vite prints', () => {
    expect(proxyErrorLine(`/media/${TOKEN}`, null)).toContain(TOKEN)
  })

  it('the media path and the export download path are blanked; the route name stays', () => {
    const media = proxyErrorLine(`/media/${TOKEN}`, blankSignedPathOnProxyError as (proxy: EventEmitter) => void)
    expect(media).toBe('http proxy error: /media/[signed path not printed]')
    const download = proxyErrorLine('/exports/exs_CANARYtwo9Zx1vBn3Hd5', blankSignedPathOnProxyError as (proxy: EventEmitter) => void)
    expect(download).toBe('http proxy error: /exports/[signed path not printed]')
    for (const line of [media, download]) expect(line).not.toMatch(/CANARY|mts_|exs_/)
  })

  it('the live camera preview path is blanked; the route name stays (decisions D51 / D53)', () => {
    const preview = proxyErrorLine('/preview/cps_CANARYthree9Zx1vBn3Hd5', blankSignedPathOnProxyError as (proxy: EventEmitter) => void)
    expect(preview).toBe('http proxy error: /preview/[signed path not printed]')
    expect(preview).not.toMatch(/CANARY|cps_/)
  })

  it('a path that carries no signed value is printed as it is', () => {
    expect(proxyErrorLine('/api/v1/evidence/EV-20261009-0001', blankSignedPathOnProxyError as (proxy: EventEmitter) => void)).toBe('http proxy error: /api/v1/evidence/EV-20261009-0001')
  })
})
