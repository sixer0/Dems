/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// FXR-W, finding W92-3 (`verification/11_code_review_shared_web.md`; decision D242): the media
// reference of an evidence item (operation 40 `getEvidence`, `features/evidence/use-evidence-media.ts`)
// is read only while an operator is signed in (decision D176, finding F75-2). When the session ends
// the query bridge removes every `['core', …]` entry in the same turn; the detail page, still on
// screen until the shell leaves it, re-renders and rebuilds the entry. Before the fix the query's
// `enabled` was `live !== null` alone, so the rebuilt entry was fetched again: a read the Core can
// only answer 401.
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import {
  clearToasts,
  EV,
  findDetailBody,
  installJsdomStubs,
  openLiveEvidence,
  type LiveEvidence,
} from '@/features/evidence/__tests__/live-evidence-bed'

vi.setConfig({ testTimeout: 40_000 })

let opened: LiveEvidence | undefined

beforeEach(() => {
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  installJsdomStubs()
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  opened?.bed.dispose()
  opened = undefined
  vi.restoreAllMocks()
})

describe('W92-3: no media-reference read after a sign-out', () => {
  it.each([
    ['a sign-out of this console', 'signOut'],
    ['the Core ending the session (another tab signed out)', 'end'],
  ] as const)('%s: operation 40 is not asked again while the detail page is still on screen, and never answered 401', async (_case, how) => {
    opened = await openLiveEvidence(`/evidence/${EV.sealed}`)
    const { bed, page, router } = opened
    await findDetailBody()
    const reads = () => bed.fake.log.requestsOf('getEvidence')
    expect(reads()).toHaveLength(1)
    await act(async () => {
      if (how === 'signOut') await page.live.actions.signOut('USER')
      else bed.core.end('SIGNED_OUT')
    })
    await bed.flush()
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 15_000 })
    await bed.elapse(5_000, 500)
    expect(reads()).toHaveLength(1)
    expect(reads().filter((call) => call.status === 401)).toEqual([])
  })
})
