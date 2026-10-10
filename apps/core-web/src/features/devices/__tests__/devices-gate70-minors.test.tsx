/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Wave H, driver D: the two MINOR items of gate 70 on Devices & Inputs.
//
// | Item | What is pinned here | What only a browser can show |
// |------|---------------------|------------------------------|
// | G70-07: the audio card title was cut to "MIC 1 - Inter..." once the development badge was drawn | the title carries the wrapping class, and the badge is drawn on its own line OUTSIDE the header row (so it takes no width from the title) | that the full title is readable at the lane's card width (the computed layout) |
// | M4-PC-1: "Checking your permissions..." was never observed by the gate (the read answered within 200 ms) | the state renders while operation 77 is not answered: the sentence, no edit control; it goes when the read answers | - |
import { act, cleanup, configure, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

type Device = SimState['captureDevices']['devices'][number]
let bed: LiveTestBed | undefined

async function liveDevices(prepare?: (created: LiveTestBed) => void) {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  // A Core in real capture: every source carries its class, so the badge is drawn.
  created.core.served.captureDevices = { devices: created.core.served.captureDevices.devices.map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device) }
  prepare?.(created)
  const page = await created.load()
  await created.mount(page, '/devices')
  return screen.findByTestId('page-devices', {}, { timeout: 15_000 })
}

let restoreMedia: () => void = () => undefined
beforeAll(() => {
  restoreMedia = stubMediaForJsdom()
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => restoreMedia())
beforeEach(() => {
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})
afterEach(() => {
  cleanup()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('G70-07 the audio card title with the development badge', () => {
  it('the title wraps instead of being cut, and the badge has its own line outside the header row', async () => {
    const page = await liveDevices()
    const card = await within(page).findByTestId('audio-input-AUDIO-01')
    const badge = await within(card).findByTestId('source-badge-AUDIO-01')
    expect(badge).toHaveTextContent(en.common.sourceClass.badge)
    const header = card.querySelector('header.dev-tile-head')!
    const title = header.querySelector('.dev-tile-name')!
    expect(title.textContent ?? '').not.toBe('')
    expect(title).toHaveClass('dev-tile-name-wrap')
    expect(header.contains(badge)).toBe(false)
    expect(badge.closest('.dev-tile-marks')).not.toBeNull()
    // The status chip keeps its place in the header.
    expect(header.contains(within(card).getByTestId('audio-status-AUDIO-01'))).toBe(true)
  })
})

describe('M4-PC-1 "Checking your permissions..." of the capture device selector', () => {
  it('renders while the device list is not answered, with no edit control, and goes when the read answers', async () => {
    let held: ReturnType<LiveTestBed['fake']['hold']> | undefined
    const page = await liveDevices((created) => (held = created.fake.hold('getCaptureDevices')))
    const panel = await within(page).findByTestId('panel-selector')
    const pending = await within(panel).findByTestId('selector-pending')
    expect(pending).toHaveAttribute('data-read', 'LOADING')
    expect(within(panel).getByTestId('selector-checking')).toHaveTextContent(en.devices.selector.checking)
    expect(within(panel).queryByTestId('selector-save-VIDEO-01')).not.toBeInTheDocument()
    expect(within(panel).queryByTestId('selector-primary-MIC-02')).not.toBeInTheDocument()
    await act(async () => {
      held!.release({ status: 200, body: JSON.parse(JSON.stringify(bed!.core.served.captureDevices)) })
    })
    await within(panel).findByTestId('selector-ready')
    await waitFor(() => expect(within(panel).queryByTestId('selector-checking')).not.toBeInTheDocument())
    expect(within(panel).getByTestId('selector-primary-MIC-02')).toBeEnabled()
  })
})
