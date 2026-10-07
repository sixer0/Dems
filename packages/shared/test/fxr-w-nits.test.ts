// FXR-W, Nits W92-20 and W92-24 of `verification/11_code_review_shared_web.md` (decision D242).
//
// | Nit | Held here |
// |-----|-----------|
// | W92-20: the unused key `apiReference.realtime.live.everySlice` is gone | "W92-20" |
// | W92-24: `WEB_SESSION_REFUSED` has one definition (`operation-parts.ts`), and the identity and pairing operations still carry its text | "W92-24" |
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CORE_API_OPERATIONS } from '../src/api'
import { WEB_SESSION_REFUSED } from '../src/api/operation-parts'
import { en } from '../src/i18n'

describe('W92-20: no dead key in the API Reference words', () => {
  it('`apiReference.realtime.live` has no `everySlice`', () => {
    expect(Object.keys(en.apiReference.realtime.live)).not.toContain('everySlice')
  })
})

describe('W92-24: one copy of the web-session refusal text', () => {
  it('defined once under src/api', () => {
    const dir = resolve(import.meta.dirname, '../src/api')
    const definers = readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .filter((name) => /const WEB_SESSION_REFUSED\s*=/.test(readFileSync(resolve(dir, name), 'utf8')))
    expect(definers).toEqual(['operation-parts.ts'])
  })

  it('the device-only operations of identity and pairing still name it in their 403', () => {
    const carrying = CORE_API_OPERATIONS.filter((operation) => JSON.stringify(operation).includes(WEB_SESSION_REFUSED)).map((operation) => operation.operationId)
    expect(carrying.length).toBeGreaterThanOrEqual(5)
  })
})
