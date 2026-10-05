/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W0, item 4 (decision D154 DN-3; finding F-3 of W65): the CLIP chip of the shared meter
// (`components/composed/dbfs-meter.tsx`) resets the latch through `settle` (rule 1), and a Live refusal
// reaches the refusal presenter first (rule 2). Before W0 the press ignored the result of
// `resetClip`, so a refused operation 52 showed nothing and left an unhandled rejection. Simulated
// mode is the meter's own test (`components/composed/__tests__/dbfs-meter.test.tsx`), unchanged.
//
// | Case | Where |
// |------|-------|
// | Success: one `resetMicClip` with the channel, nothing worded by the meter | "success" |
// | 403 FORBIDDEN (operation 52 needs a session only): the presenter's denied toast, no record of the meter | "refusal" |
// | The contract's 403 `originNotAllowed`: the presenter names the address to open | "refusal" |
// | Outage: the presenter's offline sentence | "outage" |
// | A refusal the presenter leaves (422): the generic sentence and one record with a fixed message | "left to the meter" |
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { refusal } from '@dems/shared/live/testing'
import type { AudioFrame } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, INVESTIGATOR_SESSION, LIVE_TEST_ORIGIN, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const DENIED = en.common.rbac.deniedTitle
const OFFLINE = en.common.coreErrors.offline
const GENERIC = en.common.errors.generic
const METER_SOURCE = 'components/composed.DbfsMeter.resetClip'

const originalMatchMedia = window.matchMedia
/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const toastWith = (text: string) => toastTexts().filter((entry) => entry.includes(text))

let bed: LiveTestBed | undefined
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const meterRecords = () => webErrorSink.records().filter((record) => record.source === METER_SOURCE)

const frame = (at: number, clip: boolean): AudioFrame => ({ seq: 0, at, dbfs: clip ? -0.2 : -24, peak: clip ? -0.2 : -21, clip, noSignal: false })

/** Devices & Inputs in Live mode; the Core's `meters` frame lights the CLIP latch of MIC 1's meter. */
async function liveMeterClipped(): Promise<{ bed: LiveTestBed; page: LivePage; reset: HTMLElement }> {
  const created = createLiveTestBed({ session: INVESTIGATOR_SESSION })
  bed = created
  const page = await created.load()
  await created.mount(page, '/devices')
  await screen.findByTestId('page-devices')
  const socket = page.sockets.filter((connection) => connection.principal === 'OPERATOR' && connection.state === 'OPEN').at(-1)
  if (!socket) throw new Error('the page holds no open operator socket')
  const t0 = created.fake.clock.now()
  act(() => {
    socket.meters({ channels: { 'AUDIO-01': frame(t0, true), 'AUDIO-02': frame(t0, false) } })
  })
  const card = await screen.findByTestId('audio-input-AUDIO-01')
  const meter = within(card).getByTestId('dbfs-meter')
  await waitFor(() => expect(meter).toHaveAttribute('data-clip', 'latched'))
  return { bed: created, page, reset: within(meter).getByRole('button', { name: /^Reset clip: / }) }
}

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})

beforeEach(() => {
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('success', () => {
  it('one `resetMicClip` with the channel; the meter words nothing and writes no record', async () => {
    const { bed } = await liveMeterClipped()
    bed.fake.answerFromExample('resetMicClip')
    fireEvent.click((await liveMeterReset()))
    await waitFor(() => expect(requests('resetMicClip')).toHaveLength(1))
    expect(requests('resetMicClip')[0]).toMatchObject({ method: 'POST', path: '/api/v1/audio/clip/reset' })
    expect(requests('resetMicClip')[0]?.body).toEqual({ channel: 'AUDIO-01' })
    await bed.flush()
    expect(toastWith(GENERIC)).toHaveLength(0)
    expect(meterRecords()).toHaveLength(0)
  })
})

describe('refusal (rule 2: the presenter first)', () => {
  it('a 403 FORBIDDEN is the presenter\'s denied toast; no generic sentence, no record of the meter', async () => {
    const { bed, reset } = await liveMeterClipped()
    bed.fake.answerOnce('resetMicClip', refusal(403, 'FORBIDDEN', 'Refused.'))
    fireEvent.click(reset)
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(GENERIC)).toHaveLength(0)
    expect(meterRecords()).toHaveLength(0)
    expect(requests('resetMicClip')).toHaveLength(1)
  })

  it('the contract\'s 403 `originNotAllowed` names the address to open (WT-2a)', async () => {
    const { bed, reset } = await liveMeterClipped()
    bed.fake.answerOnce('resetMicClip', bed.fake.example('resetMicClip', 403, 'originNotAllowed'))
    fireEvent.click(reset)
    const expected = en.common.coreErrors.originNotAllowed.replace('{{address}}', LIVE_TEST_ORIGIN)
    await waitFor(() => expect(toastWith(expected)).toHaveLength(1))
    expect(toastWith(GENERIC)).toHaveLength(0)
  })
})

describe('outage (LB-6)', () => {
  it('a request that gets no answer shows the presenter\'s offline sentence, and nothing of the meter', async () => {
    const { bed, reset } = await liveMeterClipped()
    bed.fake.failOnce('resetMicClip')
    fireEvent.click(reset)
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(GENERIC)).toHaveLength(0)
    expect(meterRecords()).toHaveLength(0)
  })
})

describe('left to the meter', () => {
  it('a 422 the presenter leaves: the generic sentence and ONE record with a fixed message and the cause\'s facts, never its text', async () => {
    const { bed, reset } = await liveMeterClipped()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    bed.fake.answerOnce('resetMicClip', bed.fake.example('resetMicClip', 422, 'invalidInput'))
    fireEvent.click(reset)
    await waitFor(() => expect(toastWith(GENERIC)).toHaveLength(1))
    const records = meterRecords()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', message: 'A clip latch reset from an audio meter was not carried out.' })
    expect(records[0]?.context).toMatchObject({ channel: 'AUDIO-01' })
    expect(records[0]?.context?.errorName).toEqual(expect.any(String))
    expect(records[0]?.stack).toBeUndefined()
    expect(JSON.stringify(records[0])).not.toMatch(/Invalid input|The request body/i)
  })
})

/** The reset button of the meter, read again (the chip re-renders when the latch frame repeats). */
async function liveMeterReset(): Promise<HTMLElement> {
  const meter = within(screen.getByTestId('audio-input-AUDIO-01')).getByTestId('dbfs-meter')
  return within(meter).findByRole('button', { name: /^Reset clip: / })
}
