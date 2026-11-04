/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Task 3 M4, blueprint row 67: the capture device selector of Devices & Inputs in Live mode, on the
// contract-checked fake transport (`masterplan/08_client_ux_spec.md` §2 flow 1, §11;
// `masterplan/03_api_contract.md` §2.2-§2.4 ops 76-80, §4 `409 CAPTURE_CONFIG_LOCKED`;
// `masterplan/10_test_strategy.md` M4-PC-1 and the client half of M4-SEL-W). The server module of
// operations 76-80 (blueprint row 66) is not part of this test: the fake answers by the shared
// registry, so what is proven is the console's side of the contract.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | WB-11 / E-17: the page reads operations 76 and 77 once each through the two factories; the rows are the Core's answer | "the read" |
// | ux §2.5, E-16: with the link down the selector waits ("Checking your permissions...", no edit control enabled) and asks nothing more | "the read" |
// | ux §2.5: a 403 is the forbidden state; a 503 NOT_READY is "Capture is not ready yet" with a Retry that asks again | "the read" |
// | ux §2.7: a republished `captureConfig` slice changes the rows with no further read | "the read" |
// | ux §2.2 step 4, C3 §2.3 op 79: one POST with `{ trackId }` for the chosen device (an added CAM-03, PE-127-07); nothing changes before the Core says so | "an edit" |
// | C3 §2.3 op 80: one POST to the input's path, no body | "an edit" |
// | ux §2.2 step 6: `409 CAPTURE_CONFIG_LOCKED` is the locked sentence on the field, no error toast, and the configuration is read again | "refusals" |
// | ux §2.4: a session without CAPTURE_CONFIG reads the selector and finds each edit disabled with the role sentence | "refusals" |
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionInfo } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { notReady, refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import { OPERATOR_IDS, OPERATORS, ROLE_PERMISSIONS } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const S = en.devices.selector
const sessionOf = (operatorId: string): Pick<AuthSessionInfo, 'operator' | 'permissions'> => {
  const operator = OPERATORS.find((entry) => entry.id === operatorId)!
  return {
    operator: {
      id: operator.id,
      username: operator.username,
      rank: operator.rank,
      name: operator.name,
      displayName: operator.displayName,
      initials: operator.initials,
      role: operator.role,
    },
    permissions: [...ROLE_PERMISSIONS[operator.role]],
  }
}
// REVOKED 2026-10-29 (0034): CAPTURE_CONFIG is held by TECHNICIAN alone, so the mounts that drive
// the control surface are the seeded TECHNICIAN (RINA). The seeded INVESTIGATOR never held
// CAPTURE_CONFIG (OD-10): it stays the mount of the refusal row.
const TECHNICIAN = sessionOf(OPERATOR_IDS.RINA)
const INVESTIGATOR = sessionOf(OPERATOR_IDS.BUDI)

const originalMatchMedia = window.matchMedia
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')

let bed: LiveTestBed | undefined

async function liveSelector(
  session: Pick<AuthSessionInfo, 'operator' | 'permissions'> = TECHNICIAN,
  prepare?: (created: LiveTestBed) => void,
): Promise<{ bed: LiveTestBed; page: LivePage; panel: HTMLElement }> {
  const created = createLiveTestBed({ session })
  bed = created
  prepare?.(created)
  const page = await created.load()
  await created.mount(page, '/devices')
  await screen.findByTestId('page-devices')
  const panel = await screen.findByTestId('panel-selector')
  return { bed: created, page, panel }
}

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
/** Adds a third registered camera to what the model Core serves (a camera added by the connect flow, PE-127-07). */
const withThirdCamera = (created: LiveTestBed): void => {
  const devices = created.core.served.captureDevices.devices
  created.core.served.captureDevices = { devices: [...devices, { ...devices[0]!, id: 'CAM-03', model: 'Added camera', host: '127.0.0.1:8559' }] }
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
  resetMissingI18nKeys()
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

describe('the read (WB-11, E-17; ux §2.5, §2.7)', () => {
  it('reads operations 76 and 77 once each and shows the Core\'s lines; an idle Core with CAPTURE_CONFIG enables the edit', async () => {
    const { panel } = await liveSelector()
    await within(panel).findByTestId('selector-ready')
    expect(requests('getCaptureConfig')).toHaveLength(1)
    expect(requests('getCaptureDevices')).toHaveLength(1)
    expect(requests('getCaptureConfig')[0]).toMatchObject({ method: 'GET', path: '/api/v1/capture/config' })
    expect(within(panel).getByTestId('selector-camera-VIDEO-01')).toHaveAttribute('data-device', 'CAM-01')
    expect(within(panel).getByTestId('selector-role-MIC-01')).toHaveTextContent(S.role.PRIMARY)
    expect(within(panel).queryByTestId('selector-checking')).not.toBeInTheDocument()
    expect(within(panel).getByTestId('selector-primary-MIC-02')).toBeEnabled()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('with the link down the selector waits: "Checking your permissions...", no edit control, and no further read', async () => {
    const { bed, panel } = await liveSelector()
    await within(panel).findByTestId('selector-ready')
    await act(async () => {
      bed.core.unreachable()
    })
    await within(panel).findByTestId('selector-pending')
    expect(within(panel).getByTestId('selector-pending')).toHaveAttribute('data-read', 'WAITING')
    expect(within(panel).getByTestId('selector-checking')).toHaveTextContent('Checking your permissions...')
    expect(within(panel).getByTestId('selector-read-state')).toHaveTextContent(S.waitingLink)
    // Never an instant enable: while unresolved no edit control exists to press.
    expect(within(panel).queryByTestId('selector-primary-MIC-02')).not.toBeInTheDocument()
    expect(within(panel).queryByTestId('selector-save-VIDEO-01')).not.toBeInTheDocument()
    expect(requests('getCaptureConfig')).toHaveLength(1)
  })

  it('a 403 on the read is the forbidden state, with no edit control', async () => {
    const { panel } = await liveSelector(TECHNICIAN, (created) => {
      created.fake.answer('getCaptureConfig', refusal(403, 'NOT_PERMITTED'))
    })
    expect(await within(panel).findByTestId('selector-forbidden')).toHaveTextContent(S.forbidden)
    expect(within(panel).queryByTestId('selector-ready')).not.toBeInTheDocument()
  })

  it('a 503 NOT_READY is "Capture is not ready yet" with a Retry that asks again and then shows the lines', async () => {
    let ready = false
    const { bed, panel } = await liveSelector(TECHNICIAN, (created) => {
      created.fake.answer('getCaptureDevices', () => (ready ? { status: 200, body: clone(created.core.served.captureDevices) } : notReady()))
    })
    const error = await within(panel).findByTestId('selector-error')
    expect(error).toHaveAttribute('data-kind', 'NOT_READY')
    expect(error).toHaveTextContent(S.notReady)
    const before = requests('getCaptureDevices').length
    ready = true
    fireEvent.click(within(panel).getByTestId('selector-retry'))
    await within(panel).findByTestId('selector-ready')
    expect(requests('getCaptureDevices').length).toBe(before + 1)
    void bed
  })

  it('a republished captureConfig slice changes the lines and locks the edit, with no further read', async () => {
    const { bed, page, panel } = await liveSelector()
    await within(panel).findByTestId('selector-ready')
    const served = clone(bed.core.served.captureConfig)
    // D61 (2026-11-04): the delta trades the transcription pair - channels 1 and 2 change places.
    const next = { ...served, locked: true, mics: served.mics.map((mic) => ({ ...mic, channel: mic.channel === 'MIC-01' ? 'MIC-02' : mic.channel === 'MIC-02' ? 'MIC-01' : mic.channel })) }
    await act(async () => {
      page.sockets.at(-1)!.delta([{ op: 'replace', slice: 'captureConfig', value: next }] as FakeCommandOptions['ops'])
    })
    await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(S.role.PRIMARY))
    expect(within(panel).getByTestId('selector-locked')).toHaveTextContent(S.locked)
    expect(within(panel).getByTestId('selector-primary-MIC-01')).toBeDisabled()
    expect(within(panel).getByTestId('selector-reason-MIC-01')).toHaveAttribute('data-block', 'LOCKED')
    expect(requests('getCaptureConfig')).toHaveLength(1)
  })
})

describe('an edit (C3 §2.3 ops 79, 80; ux §2.2 steps 4-5; PE-127-07)', () => {
  it('Save: one POST of operation 79 for the added CAM-03 with { trackId }; the line changes when the Core says so', async () => {
    const { bed, panel } = await liveSelector(TECHNICIAN, withThirdCamera)
    await within(panel).findByTestId('selector-ready')
    const served = clone(bed.core.served.captureConfig)
    const next = { ...served, updatedAt: served.updatedAt + 1, cameras: served.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-03' } : line)) }
    bed.fake.scriptCommand('setCaptureCameraSource', {
      ops: [{ op: 'replace', slice: 'captureConfig', value: next }] as FakeCommandOptions['ops'],
      order: 'answer-first',
      answer: { status: 200, body: next },
    })
    fireEvent.click(within(within(panel).getByTestId('selector-source-VIDEO-01')).getByRole('button'))
    fireEvent.click(await screen.findByRole('option', { name: /CAM-03/ }))
    const save = within(panel).getByTestId('selector-save-VIDEO-01')
    await waitFor(() => expect(save).toBeEnabled())
    // Not optimistic: a choice alone sends nothing and changes no line.
    expect(requests('setCaptureCameraSource')).toHaveLength(0)
    expect(within(panel).getByTestId('selector-camera-VIDEO-01')).toHaveAttribute('data-device', 'CAM-01')
    fireEvent.click(save)
    await waitFor(() => expect(within(panel).getByTestId('selector-camera-VIDEO-01')).toHaveAttribute('data-device', 'CAM-03'))
    expect(requests('setCaptureCameraSource')).toHaveLength(1)
    expect(requests('setCaptureCameraSource')[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/capture/cameras/CAM-03/source',
      params: { id: 'CAM-03' },
      body: { trackId: 'VIDEO-01' },
    })
    expect(requests('updateCaptureConfig')).toHaveLength(0)
    await waitFor(() => expect(toastTexts().join(' ')).toContain(S.saved))
  })

  it('Make transcribed channel 1: one POST of operation 81 to the input\'s path, without a body (D61)', async () => {
    const { bed, panel } = await liveSelector()
    await within(panel).findByTestId('selector-ready')
    const served = clone(bed.core.served.captureConfig)
    // D61 (2026-11-04): the answer trades the transcription pair - channels 1 and 2 change places.
    const next = { ...served, updatedAt: served.updatedAt + 1, mics: served.mics.map((mic) => ({ ...mic, channel: mic.channel === 'MIC-01' ? 'MIC-02' : mic.channel === 'MIC-02' ? 'MIC-01' : mic.channel })) }
    bed.fake.scriptCommand('setPrimaryMic', {
      ops: [{ op: 'replace', slice: 'captureConfig', value: next }] as FakeCommandOptions['ops'],
      order: 'delta-first',
      answer: { status: 200, body: next },
    })
    fireEvent.click(within(panel).getByTestId('selector-primary-MIC-02'))
    await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(S.role.PRIMARY))
    expect(requests('setPrimaryMic')).toHaveLength(1)
    expect(requests('setPrimaryMic')[0]).toMatchObject({ method: 'POST', path: '/api/v1/capture/mics/MIC-02/primary', params: { id: 'MIC-02' } })
    expect(requests('setPrimaryMic')[0]!.body ?? null).toBeNull()
  })
})

describe('refusals (ux §2.2 step 6, §2.4; C3 §4)', () => {
  it('409 CAPTURE_CONFIG_LOCKED: the locked sentence on the field, no error toast, no line changed, and the configuration is read again', async () => {
    const { bed, panel } = await liveSelector()
    await within(panel).findByTestId('selector-ready')
    bed.fake.answer('setPrimaryMic', bed.fake.example('setPrimaryMic', 409, 'locked'))
    fireEvent.click(within(panel).getByTestId('selector-primary-MIC-02'))
    expect(await within(panel).findByTestId('selector-message-MIC-02')).toHaveTextContent(S.locked)
    expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(S.role.STANDBY)
    expect(toastTexts()).toEqual([])
    await waitFor(() => expect(requests('getCaptureConfig')).toHaveLength(2))
    expect(requests('setPrimaryMic')).toHaveLength(1)
  })

  it('a session without CAPTURE_CONFIG reads the selector; each edit is disabled with the role sentence and sends nothing', async () => {
    const { panel } = await liveSelector(INVESTIGATOR)
    await within(panel).findByTestId('selector-ready')
    const sentence = en.common.rbac.requiresRole.replace('{{role}}', 'TECHNICIAN') // 0034: revoked from SUPERVISOR 2026-10-29; TECHNICIAN holds it alone
    expect(within(panel).getByTestId('selector-reason-VIDEO-01')).toHaveTextContent(sentence)
    expect(within(panel).getByTestId('selector-reason-MIC-02')).toHaveTextContent(sentence)
    expect(within(panel).getByTestId('selector-primary-MIC-02')).toBeDisabled()
    fireEvent.click(within(panel).getByTestId('selector-primary-MIC-02'))
    expect(requests('setPrimaryMic')).toHaveLength(0)
  })
})
