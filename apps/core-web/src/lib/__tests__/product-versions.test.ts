// Fix wave J round three, driver J3-W (finding JW-26; `contract_wave_j.md` J2-S 2): the rule of
// `lib/product-versions.ts` and the console's one version constant. The pages that draw the rows are
// proven in `test/live-system-settings.test.tsx` ("JW-26") and `test/live-login-page.test.tsx`.
import { describe, expect, it } from 'vitest'
import manifest from '../../../package.json' with { type: 'json' }
import { SYSTEM_COMPONENTS_EXAMPLE } from '@dems/shared/api'
import { SOFTWARE_VERSION, UPDATE_VERSION } from '@dems/shared/sim'
import { productVersionsOf, WEB_CONSOLE_VERSION } from '../product-versions'

describe('WEB_CONSOLE_VERSION', () => {
  it('equals the version of the workspace manifest, and is not the model\'s', () => {
    expect(manifest.name).toBe('@dems/core-web')
    expect(manifest.version).toBe(WEB_CONSOLE_VERSION)
    expect(WEB_CONSOLE_VERSION).not.toBe(SOFTWARE_VERSION)
    expect(WEB_CONSOLE_VERSION).not.toBe(UPDATE_VERSION)
  })
})

describe('productVersionsOf', () => {
  it('a Core in its own capture with the exported example: four rows by name, no model version', () => {
    const versions = productVersionsOf({ ownCore: true, components: SYSTEM_COMPONENTS_EXAMPLE, modelVersion: SOFTWARE_VERSION })
    expect(versions.modelVersion).toBeNull()
    expect(versions.coreVersion).toBe(SYSTEM_COMPONENTS_EXAMPLE.core.version)
    expect(versions.rows).toEqual([
      { id: 'core', version: SYSTEM_COMPONENTS_EXAMPLE.core.version },
      { id: 'captureWorker', version: SYSTEM_COMPONENTS_EXAMPLE.captureWorker.version },
      { id: 'apiContract', version: SYSTEM_COMPONENTS_EXAMPLE.apiContract.version },
      { id: 'webConsole', version: WEB_CONSOLE_VERSION },
    ])
    expect(JSON.stringify(versions)).not.toContain(SOFTWARE_VERSION)
  })

  it('no capture worker stated: no such row', () => {
    const { captureWorker: _none, ...components } = SYSTEM_COMPONENTS_EXAMPLE
    expect(productVersionsOf({ ownCore: true, components, modelVersion: SOFTWARE_VERSION }).rows.map((row) => row.id)).toEqual(['core', 'apiContract', 'webConsole'])
  })

  it('a Core in its own capture that has not stated its components: the two Core rows are null (never the model\'s value), the console states its own', () => {
    const versions = productVersionsOf({ ownCore: true, components: null, modelVersion: SOFTWARE_VERSION })
    expect(versions.modelVersion).toBeNull()
    expect(versions.coreVersion).toBeNull()
    expect(versions.rows).toEqual([
      { id: 'core', version: null },
      { id: 'apiContract', version: null },
      { id: 'webConsole', version: WEB_CONSOLE_VERSION },
    ])
  })

  it('CONTROL - the demonstration keeps the model\'s version; without a statement of a Core only the console has a row', () => {
    const versions = productVersionsOf({ ownCore: false, components: undefined, modelVersion: SOFTWARE_VERSION })
    expect(versions.modelVersion).toBe(SOFTWARE_VERSION)
    expect(versions.rows).toEqual([{ id: 'webConsole', version: WEB_CONSOLE_VERSION }])
  })
})
