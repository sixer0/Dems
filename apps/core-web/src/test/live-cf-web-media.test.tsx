/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Closing fix CF-W, O-RT-1 (test/08c_retest_tablet.md; decisions D212, D214): in Live mode the Media
// tab of an item without a DEMO package said "Its record comes from the simulator". The record is the
// Core server's, so the tab says what the preview card says since plan row W0 item 9 (D158), and, when
// the Core's media reference (operation 40) did not answer, what the header chip and the Metadata tab
// say (W83 ledger #95): the reference is unavailable, with no claim that no package exists. Simulated
// mode keeps its words (`features/evidence/__tests__/cf-web-custody-media.test.tsx`).
//
// | Case | Media tab, Live |
// |------|-----------------|
// | operation 40 answers NONE | "No DEMO media" · "No DEMO package for this item: the Core server's record only." |
// | operation 40 does not answer | "Media reference unavailable" (the chip's words), nothing else |
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { clearToasts, EV, findDetailBody, installJsdomStubs, openLiveEvidence, toastWith, type LiveEvidence } from '@/features/evidence/__tests__/live-evidence-bed'

vi.setConfig({ testTimeout: 40_000 })

const L = en.evidence.live
const UI = { timeout: 15_000 }

let opened: LiveEvidence | undefined

beforeEach(() => {
  resetMissingI18nKeys()
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
  expect(getMissingI18nKeys()).toEqual([])
})

async function openMedia(options: Parameters<typeof openLiveEvidence>[1] = {}): Promise<HTMLElement> {
  opened = await openLiveEvidence(`/evidence/${EV.sealed7}?tab=integrity`, options)
  await findDetailBody()
  fireEvent.click(screen.getByTestId('evidence-tab-media'))
  return screen.findByTestId('evidence-media-empty', {}, UI)
}

describe('O-RT-1: the Live Media tab of an item without a DEMO package', () => {
  it('operation 40 answers NONE: the record is the Core server\'s, and no word of a simulator', async () => {
    const empty = await openMedia()
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'core')
    expect(empty).toHaveAttribute('data-source', 'core')
    expect(within(empty).getByText(en.evidence.media.noMedia)).toBeInTheDocument()
    expect(within(empty).getByText(L.noPackage)).toBeInTheDocument()
    expect(L.noPackage).toMatch(/the Core server's record/)
    expect(empty.textContent ?? '').not.toMatch(/simulat/i)
    expect(within(empty).queryByText(en.evidence.media.noMediaBody)).not.toBeInTheDocument()
  })

  it('operation 40 does not answer: the tab says the reference is unavailable, as the chip does, and claims no absence', async () => {
    const empty = await openMedia({ before: (bed) => bed.fake.failOnce('getEvidence') })
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'unavailable')
    expect(empty).toHaveAttribute('data-source', 'unavailable')
    expect(within(empty).getByText(L.mediaUnavailable)).toBeInTheDocument()
    const words = empty.textContent ?? ''
    expect(words).not.toMatch(/simulat/i)
    expect(words).not.toContain(en.evidence.media.noMedia)
    expect(words).not.toMatch(/no DEMO package/i)
    await waitFor(() => expect(toastWith(en.common.coreErrors.offline)).toHaveLength(1))
  })
})
