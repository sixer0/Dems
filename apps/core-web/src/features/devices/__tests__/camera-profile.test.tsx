/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Task 4 row W5 (review `verification/060d` finding Q-02; decisions C36, C60, C111): NO CLIENT COULD ASSIGN A
// PRODUCTION CAMERA. The console sent operation 79 with a track alone; the Core refuses a production camera
// without a profile of its own (`CAMERA_PROFILE_NOT_STATED`) and never picks one.
//
// | Case | Where |
// |------|-------|
// | the rule: who needs a profile, what is preselected, what a profile is in words | "the rule (pure)" |
// | TWO stored profiles: both offered by what they are, none preselected, Save waits for the choice, the request carries it | "two stored profiles" |
// | ONE stored profile: preselected, still shown, the request carries it | "one stored profile" |
// | NO stored profile: nothing is offered and nothing is sent; the row says why | "no stored profile" |
// | a held line: the same camera with another of its profiles is an edit | "a held line" |
// | a refusal of the Core keeps its sentence | "a refused profile" |
// | a development source is assigned exactly as before (operation 79, no profile control) | "CONTROL" (and, unedited, `selector-microphones.test.tsx`) |
//
// THE DOUBLE, AND WHAT IT DOES NOT PROVE. The fake Core of the live harness serves the device list by the
// contract, and the contract's device entry has no `profiles` member today: the typed client refuses an answer
// that carries one (a strict schema), so the list cannot travel through operation 77 in a test either. The page
// cases therefore replace THE ONE READER of the list (`storedProfilesOf`, the seam of `camera-profile.ts`) by a
// table keyed by device id; what the reader does with a real device entry is the pure case. Proven here: the
// screen and the request, given the list. NOT proven: that a Core states the list (request lines of row W5).
// No browser session. Seen RED on the mutation "the row sends the assignment without the chosen profile"
// (operation 79 in the place of the camera line of operation 78): the four cases that read the request.
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { en } from '@dems/shared/i18n'
import { refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'
import { stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import * as cameraProfile from '../camera-profile'

const TABLE = vi.hoisted(() => ({ profiles: {} as Record<string, readonly string[]> }))

vi.mock('../camera-profile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../camera-profile')>()
  return {
    ...actual,
    // The seam: the list of a device by its id, from the test's table. A device the table does not name is read by the real reader.
    storedProfilesOf: (device: unknown) => {
      const id = (device as { readonly id?: unknown } | null | undefined)?.id
      return typeof id === 'string' && id in TABLE.profiles ? TABLE.profiles[id]! : actual.storedProfilesOf(device)
    },
  }
})

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const W = enWeb.web.cameraProfile
type Device = SimState['captureDevices']['devices'][number]
type Track = 'VIDEO-01' | 'VIDEO-02'

const TWO = ['HEVC_2560X1920P20', 'H264_720P30'] as const
const ONE = ['HEVC_2160P'] as const

let bed: LiveTestBed | undefined

/**
 * A Live console on a Core in real capture: CAM-01 and CAM-02 are PRODUCTION cameras (two and one stored profile),
 * CAM-03 a production camera the Core holds no profile for, CAM-04 a generated development source.
 */
async function liveSelector(held: readonly { readonly trackId: Track; readonly deviceId: string; readonly profile: string }[] = []) {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  const served = created.core.served
  const camera = served.captureDevices.devices.find((device) => device.kind === 'CAMERA')!
  const production = (id: string): Device => ({ ...camera, id, model: 'Adopted camera', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' }) as Device
  created.core.served = {
    ...served,
    captureDevices: {
      devices: [
        production('CAM-01'),
        production('CAM-02'),
        production('CAM-03'),
        { ...camera, id: 'CAM-04', model: 'Generated', adapter: 'FAKE', sourceClass: 'DEVELOPMENT' } as Device,
        ...served.captureDevices.devices.filter((device) => device.kind !== 'CAMERA').map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device),
      ],
    },
    captureConfig: {
      ...served.captureConfig,
      cameras: held.map((line) => ({ ...served.captureConfig.cameras[0]!, ...line })),
    } as SimState['captureConfig'],
  }
  TABLE.profiles = { 'CAM-01': TWO, 'CAM-02': ONE, 'CAM-03': [] }
  const page = await created.load()
  await created.mount(page, '/devices')
  await screen.findByTestId('page-devices')
  const panel = await screen.findByTestId('panel-selector')
  await within(panel).findByTestId('selector-ready')
  return { bed: created, panel, page }
}

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const rowOf = (panel: HTMLElement, track: Track) => within(panel).getByTestId(`selector-camera-${track}`)
const sourceOf = (panel: HTMLElement, track: Track) => within(within(panel).getByTestId(`selector-source-${track}`)).getByRole('button')
const saveOf = (panel: HTMLElement, track: Track) => within(panel).getByTestId(`selector-save-${track}`)
const profileOf = (panel: HTMLElement, track: Track) => within(panel).queryByTestId(`selector-profile-${track}`)
const hintOf = (panel: HTMLElement, track: Track) => within(panel).queryByTestId(`selector-profile-hint-${track}`)
async function pickCamera(panel: HTMLElement, track: Track, name: RegExp) {
  fireEvent.click(sourceOf(panel, track))
  fireEvent.click(await screen.findByRole('option', { name }))
}
async function profileOptions(panel: HTMLElement, track: Track): Promise<string[]> {
  fireEvent.click(within(profileOf(panel, track)!).getByRole('button'))
  const options = await screen.findAllByRole('option')
  return options.map((option) => option.textContent ?? '')
}

const originalMatchMedia = window.matchMedia
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

let restoreMedia: () => void = () => undefined
beforeAll(() => {
  restoreMedia = stubMediaForJsdom()
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => restoreMedia())
beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})
afterEach(async () => {
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  TABLE.profiles = {}
})

describe('row W5 (Q-02): the rule (pure)', () => {
  const t = ((key: string, options?: Record<string, unknown>) => {
    const text = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], enWeb as unknown)
    return String(text).replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name]))
  }) as unknown as TFunction
  const production = { id: 'CAM-01', kind: 'CAMERA', adapter: 'ONVIF_RTSP' }

  it('`storedProfilesOf` reads the member `profiles` of a device entry as untrusted data: codes only, each once, in the Core\'s order; anything else states nothing', async () => {
    const { storedProfilesOf, STORED_PROFILES_MAX } = await vi.importActual<typeof import('../camera-profile')>('../camera-profile')
    expect(storedProfilesOf({ ...production, profiles: ['HEVC_2160P', 'H264_720P30', 'HEVC_2160P'] })).toEqual(['HEVC_2160P', 'H264_720P30'])
    // Row V7: an entry of the contract is `{ code, codec, resolution, fps }` - its `code` is read; an object without a code states nothing.
    expect(storedProfilesOf({ ...production, profiles: ['H264_720P30', 7, null, 'rtsp://camera/stream', '', 'h264_720p30', { codec: 'HEVC' }, { code: 'rtsp://camera/2' }] })).toEqual(['H264_720P30'])
    expect(storedProfilesOf({ ...production, profiles: [{ code: 'HEVC_2560X1920P', codec: 'HEVC', resolution: '2560x1920', fps: null }, { code: 'H264_720P30', codec: 'H.264', resolution: '720p', fps: 30 }] })).toEqual(['HEVC_2560X1920P', 'H264_720P30'])
    // An entry without the member (a Core before row V7, a built-in device) states nothing.
    for (const entry of [production, { ...production, profiles: 'H264_720P30' }, { ...production, profiles: null }, null, undefined, 'CAM-01']) expect(storedProfilesOf(entry)).toEqual([])
    expect(storedProfilesOf({ profiles: Array.from({ length: 100 }, (_unused, index) => `P${String(index)}`) })).toHaveLength(STORED_PROFILES_MAX)
  })

  it('`cameraAssignmentOf`: a profile is asked only for a production camera on a Core in real capture; one stored profile is preselected, several are not, a held one is kept', () => {
    const { cameraAssignmentOf, isProductionCamera } = cameraProfile
    expect(isProductionCamera(production)).toBe(true)
    for (const device of [{ ...production, adapter: 'FAKE' }, { ...production, adapter: 'LOCAL_DEVICE' }, { ...production, adapter: undefined }, { ...production, kind: 'MIC' }, null, undefined]) {
      expect(isProductionCamera(device)).toBe(false)
      expect(cameraAssignmentOf({ realCapture: true, device, profiles: [...TWO], heldProfile: null })).toEqual({ kind: 'PLAIN' })
    }
    // Simulated mode and a Core in simulated capture: exactly as before, whatever the device says.
    expect(cameraAssignmentOf({ realCapture: false, device: production, profiles: [...TWO], heldProfile: null })).toEqual({ kind: 'PLAIN' })
    expect(cameraAssignmentOf({ realCapture: true, device: production, profiles: [], heldProfile: null })).toEqual({ kind: 'NO_PROFILE' })
    expect(cameraAssignmentOf({ realCapture: true, device: production, profiles: [...ONE], heldProfile: null })).toEqual({ kind: 'CHOOSE', profiles: [...ONE], preselected: 'HEVC_2160P' })
    expect(cameraAssignmentOf({ realCapture: true, device: production, profiles: [...TWO], heldProfile: null })).toEqual({ kind: 'CHOOSE', profiles: [...TWO], preselected: null })
    expect(cameraAssignmentOf({ realCapture: true, device: production, profiles: [...TWO], heldProfile: 'H264_720P30' })).toMatchObject({ preselected: 'H264_720P30' })
    // A held profile the camera no longer lists is never kept as the choice: no default stands in (C36).
    expect(cameraAssignmentOf({ realCapture: true, device: production, profiles: [...TWO], heldProfile: 'H264_1080P25' })).toMatchObject({ preselected: null })
    // NO held profile and a held one that is not listed, on a camera with one stored profile: its own one.
    expect(cameraAssignmentOf({ realCapture: true, device: production, profiles: [...ONE], heldProfile: 'H264_1080P25' })).toMatchObject({ preselected: 'HEVC_2160P' })
  })

  it('`profileWords`: the codec, the picture and the rate as the stream stated them; "not stated" where the code states none', () => {
    const { profileWords } = cameraProfile
    expect(profileWords(t, 'HEVC_2560X1920P20')).toBe('HEVC • 2560x1920 • 20 fps')
    expect(profileWords(t, 'H264_720P30')).toBe('H.264 • 720p • 30 fps')
    expect(profileWords(t, 'HEVC_2160P')).toBe(`HEVC • 2160p • ${W.rateNotStated}`)
    expect(profileWords(t, 'STANDARD')).toBe('Not stated (STANDARD)')
  })
})

describe('row W5 (Q-02): the capture selector assigns a production camera with one of its stored profiles', () => {
  it('two stored profiles: both are offered by what they are, none is preselected, Save waits for the choice, and the request carries the chosen profile', async () => {
    const { bed: created, panel } = await liveSelector()
    expect(rowOf(panel, 'VIDEO-01')).toHaveAttribute('data-state', 'NOT_ASSIGNED')
    expect(profileOf(panel, 'VIDEO-01')).toBeNull()
    await pickCamera(panel, 'VIDEO-01', /CAM-01/)
    await waitFor(() => expect(profileOf(panel, 'VIDEO-01')).not.toBeNull())
    expect(profileOf(panel, 'VIDEO-01')).not.toHaveAttribute('data-profile')
    expect(profileOf(panel, 'VIDEO-01')).toHaveTextContent(W.placeholder)
    expect(hintOf(panel, 'VIDEO-01')).toHaveTextContent(W.choose.replace('{{count}}', '2'))
    expect(hintOf(panel, 'VIDEO-01')).toHaveAttribute('data-profile-state', 'CHOOSE')
    // Nothing can be sent without a profile: the Core would refuse it and never picks one.
    expect(saveOf(panel, 'VIDEO-01')).toBeDisabled()
    expect(await profileOptions(panel, 'VIDEO-01')).toEqual(['HEVC • 2560x1920 • 20 fps', 'H.264 • 720p • 30 fps'])
    fireEvent.click(await screen.findByRole('option', { name: 'H.264 • 720p • 30 fps' }))
    await waitFor(() => expect(saveOf(panel, 'VIDEO-01')).toBeEnabled())
    expect(profileOf(panel, 'VIDEO-01')).toHaveAttribute('data-profile', 'H264_720P30')
    const served = JSON.parse(JSON.stringify(created.core.served.captureConfig)) as SimState['captureConfig']
    created.fake.answerOnce('updateCaptureConfig', { status: 200, body: { ...served, updatedAt: served.updatedAt + 1 } })
    fireEvent.click(saveOf(panel, 'VIDEO-01'))
    await waitFor(() => expect(requests('updateCaptureConfig')).toHaveLength(1))
    expect(requests('updateCaptureConfig')[0]).toMatchObject({ method: 'POST', path: '/api/v1/capture/config' })
    expect(requests('updateCaptureConfig')[0]!.body).toEqual({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P30' }] })
    // Never the request without a profile.
    expect(requests('setCaptureCameraSource')).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('one stored profile: it is preselected and still shown, and the request carries it', async () => {
    const { bed: created, panel } = await liveSelector()
    await pickCamera(panel, 'VIDEO-02', /CAM-02/)
    await waitFor(() => expect(profileOf(panel, 'VIDEO-02')).toHaveAttribute('data-profile', 'HEVC_2160P'))
    expect(profileOf(panel, 'VIDEO-02')).toHaveTextContent(`HEVC • 2160p • ${W.rateNotStated}`)
    expect(hintOf(panel, 'VIDEO-02')).toHaveTextContent(W.one)
    await waitFor(() => expect(saveOf(panel, 'VIDEO-02')).toBeEnabled())
    const served = JSON.parse(JSON.stringify(created.core.served.captureConfig)) as SimState['captureConfig']
    created.fake.answerOnce('updateCaptureConfig', { status: 200, body: { ...served, updatedAt: served.updatedAt + 1 } })
    fireEvent.click(saveOf(panel, 'VIDEO-02'))
    await waitFor(() => expect(requests('updateCaptureConfig')).toHaveLength(1))
    expect(requests('updateCaptureConfig')[0]!.body).toEqual({ cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'HEVC_2160P' }] })
    expect(requests('setCaptureCameraSource')).toHaveLength(0)
  })

  it('no stored profile: no profile is offered, nothing can be sent, and the row says why', async () => {
    const { panel } = await liveSelector()
    await pickCamera(panel, 'VIDEO-01', /CAM-03/)
    await waitFor(() => expect(hintOf(panel, 'VIDEO-01')).toHaveAttribute('data-profile-state', 'NO_PROFILE'))
    // Row W6 (C117, C126 (d)): EXPECTATION MOVED - the sentence now names the remedy the product has, "Test connection" (operation 108).
    expect(hintOf(panel, 'VIDEO-01')!.textContent).toBe(
      'This camera cannot be assigned yet: the Core holds no stream profile for it, and it does not pick one for a camera. Press "Test connection": when the test reads the camera\'s stream, the Core stores the profiles it states and they are offered here. Nothing was changed.',
    )
    expect(profileOf(panel, 'VIDEO-01')).toBeNull()
    expect(saveOf(panel, 'VIDEO-01')).toBeDisabled()
    fireEvent.click(saveOf(panel, 'VIDEO-01'))
    expect(requests('updateCaptureConfig')).toHaveLength(0)
    expect(requests('setCaptureCameraSource')).toHaveLength(0)
    // Another camera of the same row starts from its own list: the hint follows the choice.
    await pickCamera(panel, 'VIDEO-01', /CAM-02/)
    await waitFor(() => expect(hintOf(panel, 'VIDEO-01')).toHaveTextContent(W.one))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a held line: its profile is the one shown; the same camera with another of its profiles is an edit and is sent', async () => {
    const { bed: created, panel } = await liveSelector([{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P30' }])
    await waitFor(() => expect(profileOf(panel, 'VIDEO-01')).toHaveAttribute('data-profile', 'H264_720P30'))
    // Nothing changed yet.
    expect(saveOf(panel, 'VIDEO-01')).toBeDisabled()
    await profileOptions(panel, 'VIDEO-01')
    fireEvent.click(await screen.findByRole('option', { name: 'HEVC • 2560x1920 • 20 fps' }))
    await waitFor(() => expect(saveOf(panel, 'VIDEO-01')).toBeEnabled())
    const served = JSON.parse(JSON.stringify(created.core.served.captureConfig)) as SimState['captureConfig']
    created.fake.answerOnce('updateCaptureConfig', { status: 200, body: { ...served, updatedAt: served.updatedAt + 1 } })
    fireEvent.click(saveOf(panel, 'VIDEO-01'))
    await waitFor(() => expect(requests('updateCaptureConfig')).toHaveLength(1))
    expect(requests('updateCaptureConfig')[0]!.body).toEqual({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'HEVC_2560X1920P20' }] })
  })

  it('a refused profile keeps the Core\'s sentence at the field, and the slot stays empty', async () => {
    const { bed: created, panel } = await liveSelector()
    await pickCamera(panel, 'VIDEO-02', /CAM-02/)
    await waitFor(() => expect(saveOf(panel, 'VIDEO-02')).toBeEnabled())
    for (const reason of ['CAMERA_PROFILE_NOT_OF_DEVICE', 'CAMERA_PROFILE_NOT_STATED', 'PRODUCTION_SOURCE_NOT_ALLOWED'] as const) {
      created.fake.answerOnce('updateCaptureConfig', refusal(422, 'INVALID_INPUT', 'A production camera is assigned with a profile of its own.', { in: 'body', reason, deviceId: 'CAM-02', trackId: 'VIDEO-02' }))
      await waitFor(() => expect(saveOf(panel, 'VIDEO-02')).toBeEnabled())
      fireEvent.click(saveOf(panel, 'VIDEO-02'))
      const sentence = en.common.captureSlotRefusal[reason].replaceAll('{{source}}', en.common.captureSlotSource.CAMERA)
      await waitFor(async () => expect((await within(panel).findByTestId('selector-message-VIDEO-02')).textContent).toBe(sentence))
    }
    expect(rowOf(panel, 'VIDEO-02')).toHaveAttribute('data-state', 'NOT_ASSIGNED')
  })

  it('CONTROL - a development source of the same Core: no profile control, no hint, and operation 79 with the track alone, as before', async () => {
    const { bed: created, panel } = await liveSelector()
    await pickCamera(panel, 'VIDEO-01', /CAM-04/)
    await waitFor(() => expect(saveOf(panel, 'VIDEO-01')).toBeEnabled())
    expect(profileOf(panel, 'VIDEO-01')).toBeNull()
    expect(hintOf(panel, 'VIDEO-01')).toBeNull()
    const served = JSON.parse(JSON.stringify(created.core.served.captureConfig)) as SimState['captureConfig']
    created.fake.answerOnce('setCaptureCameraSource', { status: 200, body: { ...served, updatedAt: served.updatedAt + 1 } })
    fireEvent.click(saveOf(panel, 'VIDEO-01'))
    await waitFor(() => expect(requests('setCaptureCameraSource')).toHaveLength(1))
    expect(requests('setCaptureCameraSource')[0]).toMatchObject({ method: 'POST', path: '/api/v1/capture/cameras/CAM-04/source', body: { trackId: 'VIDEO-01' } })
    expect(requests('updateCaptureConfig')).toHaveLength(0)
  })
})

// Task 4 row W6 (decisions C117, C126 (d), C144; request line 526): OPERATION 108 WIRED - "Test connection" of an ADOPTED
// camera, the one step that stores its profiles so it can be assigned (the user's report "saya belum bisa assign save ke
// cam 1 / 2"). Since row V7 the device entry carries `profiles`, so these cases use THE REAL READER for CAM-03 (it is taken
// out of the seam's table): the list reaches the screen through operation 77 exactly as from a Core.
// Seen RED on: (a) "the control is not drawn under the NO_PROFILE sentence" (the PROFILES_STORED and the STREAM_PROFILE_DIFFERS
// page cases); (b) "PROFILES_STORED does not read the device list again" (the profile select never appears: the
// PROFILES_STORED case); (c) `adoptedTestResultOf` ignores STREAM_PROFILE_DIFFERS (the pure case).
describe('row W6: "Test connection" of an adopted camera (operation 108) stores its profiles, and the camera can then be assigned', () => {
  const A = enWeb.web.adoptedTest
  const answer = (over: Record<string, unknown> = {}) => ({ deviceId: 'CAM-03', outcome: 'REACHABLE', authenticated: true, testedAt: 1_791_000_000_000, usableProfileCount: 1, failedAttemptsRemaining: 3, ...over })
  const realReaderFor03 = () => {
    const { 'CAM-03': _none, ...rest } = TABLE.profiles
    TABLE.profiles = rest
  }

  it('the pure rules: what an answer says (the stored profiles first) and what a refusal is', async () => {
    const { adoptedTestResultOf, adoptedTestRefusal, adoptedTestPath } = await import('../adopted-camera-test')
    expect(adoptedTestPath('CAM-03')).toBe('/api/v1/capture/devices/CAM-03/test')
    expect(adoptedTestResultOf({ outcome: 'REACHABLE', profiles: 'PROFILES_STORED', failedAttemptsRemaining: 3 })).toEqual({ kind: 'PROFILES_STORED' })
    expect(adoptedTestResultOf({ outcome: 'REACHABLE', profiles: 'STREAM_PROFILE_DIFFERS', failedAttemptsRemaining: 3 })).toEqual({ kind: 'STREAM_PROFILE_DIFFERS' })
    expect(adoptedTestResultOf({ outcome: 'REACHABLE', failedAttemptsRemaining: 3 })).toEqual({ kind: 'OUTCOME', outcome: 'REACHABLE' })
    expect(adoptedTestResultOf({ outcome: 'AUTHENTICATION_FAILED', failedAttemptsRemaining: 2 })).toEqual({ kind: 'PASSWORD_REFUSED', attemptsLeft: 2 })
    expect(adoptedTestResultOf({ outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED', failedAttemptsRemaining: 3 })).toEqual({ kind: 'SCHEME_NOT_ALLOWED' })
    expect(adoptedTestResultOf({ outcome: 'NOT_H264', failedAttemptsRemaining: 3 })).toEqual({ kind: 'OUTCOME', outcome: 'NOT_H264' })
    const r = (status: number | null, code: string, reason: string | null = null, retryAfterSeconds: number | null = null) => adoptedTestRefusal({ status, code, reason, retryAfterSeconds })
    expect(r(409, 'CAPTURE_CONFIG_LOCKED')).toEqual({ kind: 'LOCKED' })
    for (const reason of ['CANDIDATE_NOT_TESTABLE', 'CREDENTIAL_REQUIRED', 'CONNECTION_TEST_IN_PROGRESS']) expect(r(409, 'INVALID_STATE', reason)).toEqual({ kind: 'REASON', reason })
    expect(r(404, 'NOT_FOUND')).toEqual({ kind: 'NOT_FOUND' })
    expect(r(503, 'NOT_READY', 'DISCOVERY_NOT_READY')).toEqual({ kind: 'NOT_READY' })
    expect(r(503, 'NOT_READY', 'CREDENTIAL_STORE_NOT_READY')).toEqual({ kind: 'STORE_NOT_READY' })
    expect(r(429, 'RATE_LIMITED', 'CONNECTION_TEST_LOCKOUT_GUARD', 30)).toEqual({ kind: 'LOCKOUT_GUARD', seconds: 30 })
    expect(r(429, 'RATE_LIMITED', 'CONNECTION_TEST_RATE_LIMITED', 5)).toEqual({ kind: 'RATE_LIMITED', seconds: 5 })
    expect(r(403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY')).toEqual({ kind: 'ROLE' })
    for (const [status, code] of [[500, 'INTERNAL'], [null, 'NETWORK'], [409, 'INVALID_STATE'], [422, 'INVALID_INPUT']] as const) expect(r(status, code)).toEqual({ kind: 'OTHER' })
  })

  it('PROFILES_STORED: the selector row offers "Test connection" under the NO_PROFILE sentence; one press is ONE body-less request; the stored profile appears without a reload and the camera can be assigned', async () => {
    const { bed: created, panel } = await liveSelector()
    realReaderFor03()
    await pickCamera(panel, 'VIDEO-01', /CAM-03/)
    await waitFor(() => expect(hintOf(panel, 'VIDEO-01')).toHaveAttribute('data-profile-state', 'NO_PROFILE'))
    expect(hintOf(panel, 'VIDEO-01')).toHaveTextContent('Press "Test connection"')
    const control = within(panel).getByTestId('adopted-test-selector-VIDEO-01')
    expect(control).toHaveAttribute('data-device', 'CAM-03')
    expect(within(control).getByTestId('adopted-test-hint-selector-VIDEO-01')).toHaveTextContent(A.hint)
    // No field of any kind: nothing is typed for this test.
    expect(control.querySelector('input, textarea')).toBeNull()
    // The Core stores what the stream states and its device entry carries it.
    created.fake.answerOnce('testCaptureDeviceConnection', () => {
      created.core.served = {
        ...created.core.served,
        captureDevices: {
          devices: created.core.served.captureDevices.devices.map((device) =>
            device.id === 'CAM-03' ? ({ ...device, profiles: [{ code: 'HEVC_2160P', codec: 'HEVC', resolution: '2160p', fps: null }] } as Device) : device,
          ),
        },
      }
      return { status: 200, body: answer({ profiles: 'PROFILES_STORED' }) }
    })
    fireEvent.click(within(control).getByTestId('adopted-test-button-selector-VIDEO-01'))
    await waitFor(() => expect(requests('testCaptureDeviceConnection')).toHaveLength(1))
    const sent = requests('testCaptureDeviceConnection')[0]!
    expect(sent).toMatchObject({ method: 'POST', path: '/api/v1/capture/devices/CAM-03/test' })
    // No body: no credential, no address, no profile is carried (the contract has no request schema).
    expect(sent.bodyText ?? null).toBeNull()
    // The stored profile is offered at once - one profile, preselected - and the camera can be assigned.
    await waitFor(() => expect(profileOf(panel, 'VIDEO-01')).toHaveAttribute('data-profile', 'HEVC_2160P'))
    expect(hintOf(panel, 'VIDEO-01')).toHaveTextContent(W.one)
    await waitFor(() => expect(saveOf(panel, 'VIDEO-01')).toBeEnabled())
    const served = JSON.parse(JSON.stringify(created.core.served.captureConfig)) as SimState['captureConfig']
    created.fake.answerOnce('updateCaptureConfig', { status: 200, body: { ...served, updatedAt: served.updatedAt + 1 } })
    fireEvent.click(saveOf(panel, 'VIDEO-01'))
    await waitFor(() => expect(requests('updateCaptureConfig')).toHaveLength(1))
    expect(requests('updateCaptureConfig')[0]!.body).toEqual({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-03', profile: 'HEVC_2160P' }] })
    // ONE press, one test: nothing repeated it.
    expect(requests('testCaptureDeviceConnection')).toHaveLength(1)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('STREAM_PROFILE_DIFFERS and the other answers: nothing stored is said, with what the operator can do; the refusals read their own words', async () => {
    const { bed: created, panel } = await liveSelector()
    realReaderFor03()
    await pickCamera(panel, 'VIDEO-01', /CAM-03/)
    const control = await within(panel).findByTestId('adopted-test-selector-VIDEO-01')
    const press = async (expectedCount: number) => {
      await waitFor(() => expect(within(control).getByTestId('adopted-test-button-selector-VIDEO-01')).toBeEnabled())
      fireEvent.click(within(control).getByTestId('adopted-test-button-selector-VIDEO-01'))
      await waitFor(() => expect(requests('testCaptureDeviceConnection')).toHaveLength(expectedCount))
    }
    const result = () => within(control).findByTestId('adopted-test-result-selector-VIDEO-01')
    const refused = () => within(control).findByTestId('adopted-test-refusal-selector-VIDEO-01')

    created.fake.answerOnce('testCaptureDeviceConnection', { status: 200, body: answer({ profiles: 'STREAM_PROFILE_DIFFERS' }) })
    await press(1)
    await waitFor(async () => expect(await result()).toHaveAttribute('data-result', 'STREAM_PROFILE_DIFFERS'))
    expect(await result()).toHaveTextContent(A.result.STREAM_PROFILE_DIFFERS)
    expect(A.result.STREAM_PROFILE_DIFFERS).toContain('Nothing was stored')
    expect(A.result.STREAM_PROFILE_DIFFERS).toContain('adopt the camera again')
    // Nothing was stored: the row still offers no profile.
    expect(profileOf(panel, 'VIDEO-01')).toBeNull()

    created.fake.answerOnce('testCaptureDeviceConnection', { status: 200, body: answer() })
    await press(2)
    await waitFor(async () => expect(await result()).toHaveAttribute('data-result', 'REACHABLE'))
    expect(await result()).toHaveTextContent(A.result.REACHABLE)

    created.fake.answerOnce('testCaptureDeviceConnection', { status: 200, body: answer({ outcome: 'AUTHENTICATION_FAILED', usableProfileCount: 0, failedAttemptsRemaining: 1 }) })
    await press(3)
    await waitFor(async () => expect(await result()).toHaveAttribute('data-result', 'PASSWORD_REFUSED'))
    expect(await result()).toHaveTextContent(A.result.PASSWORD_REFUSED)
    expect(await result()).toHaveTextContent('1 more attempt before testing this camera is paused.')

    created.fake.answerOnce('testCaptureDeviceConnection', { status: 200, body: answer({ outcome: 'UNREACHABLE', usableProfileCount: 0 }) })
    await press(4)
    await waitFor(async () => expect(await result()).toHaveAttribute('data-result', 'UNREACHABLE'))
    expect(await result()).toHaveTextContent(en.common.captureConnect.outcome.UNREACHABLE)
    expect(await result()).toHaveTextContent(A.nothingStored)

    created.fake.answerOnce('testCaptureDeviceConnection', refusal(409, 'INVALID_STATE', 'No password is stored for this camera. Set one first.', { reason: 'CREDENTIAL_REQUIRED' }))
    await press(5)
    await waitFor(async () => expect(await refused()).toHaveAttribute('data-reason', 'CREDENTIAL_REQUIRED'))
    expect(await refused()).toHaveTextContent('No password is stored for this camera. Set one first.')
    expect(within(control).queryByTestId('adopted-test-result-selector-VIDEO-01')).toBeNull()

    created.fake.answerOnce('testCaptureDeviceConnection', refusal(503, 'NOT_READY', 'The connection test of a registered camera is not ready.', { reason: 'DISCOVERY_NOT_READY' }))
    await press(6)
    await waitFor(async () => expect(await refused()).toHaveAttribute('data-refusal', 'NOT_READY'))
    expect(await refused()).toHaveTextContent('The connection test of a registered camera is not ready.')

    created.fake.answerOnce('testCaptureDeviceConnection', refusal(409, 'CAPTURE_CONFIG_LOCKED', 'A session is open.'))
    await press(7)
    await waitFor(async () => expect(await refused()).toHaveAttribute('data-refusal', 'LOCKED'))
    expect(await refused()).toHaveTextContent(A.refusal.LOCKED)
    expect(getMissingI18nKeys()).toEqual([])
  })

  // The drawer reads the REPLICATED `captureDevices` slice (`useRegisteredRoster`): the Core republishes it when the test
  // stores the profiles (row V7, database case 'row PR (a) then (c)'); the fake socket's delta stands for that republish.
  it('the device entry: a production camera\'s drawer states its stored profiles and offers the same test; the republished entry shows the stored profile', async () => {
    const { bed: created, page } = await liveSelector()
    realReaderFor03()
    fireEvent.click(await screen.findByTestId('registered-device-view-CAM-03'))
    const drawer = await screen.findByTestId('registered-device-drawer')
    const facts = within(drawer).getByTestId('registered-drawer-facts')
    expect(facts).toHaveTextContent(`${A.profilesLabel}${A.profilesNone}`)
    const control = within(drawer).getByTestId('adopted-test-drawer')
    created.fake.answerOnce('testCaptureDeviceConnection', () => {
      created.core.served = {
        ...created.core.served,
        captureDevices: {
          devices: created.core.served.captureDevices.devices.map((device) =>
            device.id === 'CAM-03' ? ({ ...device, profiles: [{ code: 'H264_720P30', codec: 'H.264', resolution: '720p', fps: 30 }] } as Device) : device,
          ),
        },
      }
      return { status: 200, body: answer({ profiles: 'PROFILES_STORED' }) }
    })
    fireEvent.click(within(control).getByTestId('adopted-test-button-drawer'))
    await waitFor(async () => expect(await within(control).findByTestId('adopted-test-result-drawer')).toHaveAttribute('data-result', 'PROFILES_STORED'))
    expect(within(control).getByTestId('adopted-test-result-drawer')).toHaveTextContent(A.result.PROFILES_STORED)
    await act(async () => {
      page.sockets.at(-1)!.delta([{ op: 'replace', slice: 'captureDevices', value: JSON.parse(JSON.stringify(created.core.served.captureDevices)) }] as FakeCommandOptions['ops'])
    })
    await waitFor(() => expect(within(drawer).getByTestId('registered-drawer-facts')).toHaveTextContent('H.264 • 720p • 30 fps'))
    // One press, one test.
    expect(requests('testCaptureDeviceConnection')).toHaveLength(1)
    expect(getMissingI18nKeys()).toEqual([])
  })
})
