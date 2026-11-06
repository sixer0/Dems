/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Wave H, driver D (gate 70, finding G70-02, MAJOR; ruling D196: "the selector offers every
// registered microphone on both lines"), widened by D61 (2026-11-04): FOUR simultaneous channels
// MIC-01..MIC-04 — the roles became the numbered channels and the pair replacement of decision
// D133 (1) became the per-channel line of operation 78: ONE line per named channel, `deviceId ==
// inputId`, the slots a change does not name keeping what they hold.
//
// | Rule | Where it is proven |
// |------|--------------------|
// | Every registered microphone is offered on EACH of the four channels; a Save is ONE operation 78 line by channel | "Simulated mode", "Live mode" |
// | The simulator (the Core's own rules) takes the line and writes its `CAPTURE_CONFIG_CHANGED` row with `operationId: updateCaptureConfig` | "Simulated mode" |
// | R-FLEX row 133 (T-14), superseded by audit row 156 (D22(3); AC-4.5): a microphone another pair holds is an ENABLED swap option that says so; its Save asks (`devices.pairs.swapConfirm`) and is ONE operation 78 edit of two lines by channel (no `unassign`), so no pair loses its mic | "Simulated mode", "Live mode" |
// | The controls keep the selector's gates: the role sentence, the lock sentence, disabled - never hidden | "Simulated mode: gates" |
// | Development wording in real capture: the option says "Development source", this Mac's microphone is named, and its limit sentence stands at the choice | "Live mode" |
// | A refusal of the Core is worded as the selector words it (409 locked, 422 development only, 422 not accepted) | "Live mode" |
// | A registered camera (`CAM-03`) can be put on EACH video track from the web (one camera on both tracks at once needs two profiles: a rule of the contract, so each track has its own case) | "cameras" |
import { cleanup, configure, fireEvent, render, screen, waitFor, within, act } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionInfo } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, OPERATORS, ROLE_PERMISSIONS, type ScenarioName, type Sim, type SimState } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { createLiveTestBed, type LiveTestBed } from '@/runtime/testing/live-harness'
import { stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import { enWeb } from '@/i18n-web'
import { micLineFor, micMoveBody, micMoveFor, micPairLabel, selectorPairRows, selectorSlotRows } from '../capture-selector' // D61 (2026-11-04): the pair builder became the line builder
import { slotRefusalWording, wordedSlotRefusalReasons } from '../slot-refusal'

describe("the capture selector: every registered microphone and camera on its lines (G70-02; D61: four channels)", () => {
  configure({ asyncUtilTimeout: 8_000 })
  vi.setConfig({ testTimeout: 30_000 })

  const S = en.devices.selector
  /** Audit row 156 (D5; N-40): the pair words of the selector. */
  const P = en.devices.pairs
  /** Audit row 156 (U-13): every microphone slot is named by its pair, "Mic N (Camera N)". */
  const PAIR_MIC = (n: number) => P.micOfCamera.replaceAll('{{n}}', String(n))
  const ON_PAIR = (n: number) => P.onOtherPair.replace('{{n}}', String(n))
  type Device = SimState['captureDevices']['devices'][number]

  class SilentSocket implements SocketLike {
    readyState = 0
    onopen: SocketLike['onopen'] = null
    onmessage: SocketLike['onmessage'] = null
    onclose: SocketLike['onclose'] = null
    onerror: SocketLike['onerror'] = null
    close() {
      this.readyState = 3
    }
  }

  const sims: Sim[] = []
  let bed: LiveTestBed | undefined

  const withThird = (devices: readonly Device[], kind: 'CAMERA' | 'MIC', extra: Partial<Device> = {}): Device[] => {
    const like = devices.find((device) => device.kind === kind)!
    // D60 (2026-11-04): CAM-03/CAM-04 are built-ins of the four-track surface; D61 (2026-11-04):
    // MIC-03/MIC-04 are built-ins of the four-channel plane. An adopted device is minted above the
    // built-ins (capture-registry: highest + 1), so the added one is CAM-05 / MIC-05.
    return [...devices, { ...like, id: kind === 'CAMERA' ? 'CAM-05' : 'MIC-05', model: kind === 'CAMERA' ? 'Added camera' : 'Added microphone', ...extra } as Device]
  }

  async function simSelector(scenario: ScenarioName, operatorId: string, kind: 'CAMERA' | 'MIC' = 'MIC') {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId, issuedAt: Date.now() })
    const sim = createSim({ scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    sim.store.setState({ captureDevices: { devices: withThird(sim.store.getState().captureDevices.devices, kind) } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/devices'] }) })
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-devices', undefined, { timeout: 8_000 })
    const panel = await screen.findByTestId('panel-selector')
    return { sim, panel }
  }

  function sessionOf(operatorId: string): Pick<AuthSessionInfo, 'operator' | 'permissions'> {
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

  /** A Live console on a Core in real capture: every device carries its class, MIC-03 is this Mac's microphone. */
  async function liveSelector(prepare?: (created: LiveTestBed) => void) {
    // The rows below drive the edit controls: the seeded TECHNICIAN, the only role holding
    // CAPTURE_CONFIG since the 2026-10-29 revocation (migration 0034).
    const created = createLiveTestBed({ session: sessionOf(OPERATOR_IDS.RINA) })
    bed = created
    const devices = created.core.served.captureDevices.devices.map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device)
    created.core.served.captureDevices = { devices: withThird(devices, 'MIC', { adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' } as Partial<Device>) }
    prepare?.(created)
    const page = await created.load()
    await created.mount(page, '/devices')
    await screen.findByTestId('page-devices')
    const panel = await screen.findByTestId('panel-selector')
    await within(panel).findByTestId('selector-ready')
    return { bed: created, panel }
  }

  const captureAudit = (sim: Sim) => sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED')
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
  // D61 (2026-11-04): the microphone rows are keyed by CHANNEL (MIC-01..MIC-04), not by role.
  type MicSlot = 'MIC-01' | 'MIC-02' | 'MIC-03' | 'MIC-04'
  const trigger = (panel: HTMLElement, slot: MicSlot) => within(within(panel).getByTestId(`selector-mic-source-${slot}`)).getByRole('button')
  const save = (panel: HTMLElement, slot: MicSlot) => within(panel).getByTestId(`selector-mic-save-${slot}`)
  async function choose(panel: HTMLElement, slot: MicSlot, name: RegExp) {
    fireEvent.click(trigger(panel, slot))
    fireEvent.click(await screen.findByRole('option', { name }))
    await waitFor(() => expect(save(panel, slot)).toBeEnabled())
  }

  const originalMatchMedia = window.matchMedia
  async function clearToasts() {
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
    toast.clear()
    window.matchMedia = originalMatchMedia
    const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
    if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
  }

  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
    HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
    HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
    Element.prototype.scrollTo ??= function scrollTo() {}
    window.scrollTo = (() => undefined) as typeof window.scrollTo
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
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  })
  afterEach(async () => {
    cleanup()
    await clearToasts()
    for (const sim of sims.splice(0)) sim.stop()
    bed?.dispose()
    bed = undefined
    vi.restoreAllMocks()
  })

  describe('G70-02 Simulated mode: every registered microphone on its channel (operation 78, the line by channel; D61)', () => {
    it('channel 1 (transcribed): MIC-05 is offered, a Save puts it on channel 1 alone, and ONE audit row names operation 78', async () => {
      // 2026-10-29 revocation (`sim/auth.ts`, migration 0034): SUPERVISOR lost CAPTURE_CONFIG; the
      // seeded TECHNICIAN writes the selector. This row drives the edit controls, so it mounts RINA.
      const { sim, panel } = await simSelector('idle', OPERATOR_IDS.RINA)
      // Row 156 (U-13): the select of a channel is labelled by its pair.
      expect(within(panel).getByTestId('selector-mic-source-MIC-01')).toHaveTextContent(PAIR_MIC(1))
      expect(within(panel).getByTestId('selector-mic-source-MIC-02')).toHaveTextContent(PAIR_MIC(2))
      expect(save(panel, 'MIC-01')).toBeDisabled()
      await choose(panel, 'MIC-01', /MIC-05/)
      // Not optimistic: the lines name the Core's inputs until the answer (D61: four of them).
      expect(sim.store.getState().captureConfig.mics.map((mic) => mic.inputId)).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'])
      fireEvent.click(save(panel, 'MIC-01'))
      await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-05')).toHaveTextContent(PAIR_MIC(1)))
      expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(PAIR_MIC(2))
      expect(within(panel).queryByTestId('selector-mic-MIC-01')).not.toBeInTheDocument()
      // D61: the Save names channel 1 ALONE — channels 2..4 keep their lines.
      expect(sim.store.getState().captureConfig.mics).toEqual(
        expect.arrayContaining([expect.objectContaining({ inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-01' }), expect.objectContaining({ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' })]),
      )
      const rows = captureAudit(sim)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.details).toMatchObject({ operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-01', inputId: 'MIC-05', from: 'MIC-01', to: 'MIC-05' })
      await waitFor(() => expect(save(panel, 'MIC-01')).toBeDisabled())
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('channel 2: MIC-05 becomes the channel 2 input; the transcribed channel stays (D61: a line assigns its channel alone)', async () => {
      const { sim, panel } = await simSelector('idle', OPERATOR_IDS.RINA)
      await choose(panel, 'MIC-02', /MIC-05/)
      fireEvent.click(save(panel, 'MIC-02'))
      await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-05')).toHaveTextContent(PAIR_MIC(2)))
      expect(within(panel).getByTestId('selector-role-MIC-01')).toHaveTextContent(PAIR_MIC(1))
      const rows = captureAudit(sim)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.details).toMatchObject({ operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-02', inputId: 'MIC-05', from: 'MIC-02', to: 'MIC-05' })
    })

    it('AC-4.5 (row 156; D22(3)): a microphone another pair holds is an ENABLED swap option; Save asks first, and the confirm SWAPS the two microphones in ONE operation 78 edit - no pair is left without its mic', async () => {
      // The swap is an edit: mounted on the TECHNICIAN since the 2026-10-29 CAPTURE_CONFIG revocation.
      const { sim, panel } = await simSelector('idle', OPERATOR_IDS.RINA)
      fireEvent.click(trigger(panel, 'MIC-01'))
      const other = await screen.findByRole('option', { name: /MIC-02/ })
      expect(other).not.toHaveAttribute('aria-disabled', 'true')
      expect(other).toHaveTextContent(ON_PAIR(2))
      fireEvent.click(other)
      await waitFor(() => expect(save(panel, 'MIC-01')).toBeEnabled())
      // Not optimistic: nothing moved before the Save - and the Save itself only asks.
      expect(captureAudit(sim)).toHaveLength(0)
      fireEvent.click(save(panel, 'MIC-01'))
      const dialog = await screen.findByTestId('selector-mic-swap-dialog-MIC-01')
      expect(dialog).toHaveAttribute('data-kind', 'SWAP')
      expect(within(dialog).getByTestId('selector-mic-swap-text-MIC-01').textContent).toBe('Microphone MIC-02 moves to Pair 1; microphone MIC-01 moves to Pair 2.')
      expect(captureAudit(sim)).toHaveLength(0)
      // Cancel sends nothing; the second Save asks again and the confirm sends the swap.
      fireEvent.click(within(dialog).getByTestId('selector-mic-swap-cancel-MIC-01'))
      await waitFor(() => expect(screen.queryByTestId('selector-mic-swap-dialog-MIC-01')).not.toBeInTheDocument())
      expect(captureAudit(sim)).toHaveLength(0)
      fireEvent.click(save(panel, 'MIC-01'))
      fireEvent.click(within(await screen.findByTestId('selector-mic-swap-dialog-MIC-01')).getByTestId('selector-mic-swap-confirm-MIC-01'))
      await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(PAIR_MIC(1)))
      expect(within(panel).getByTestId('selector-role-MIC-01')).toHaveTextContent(PAIR_MIC(2))
      expect(within(panel).queryByTestId('selector-not-assigned-MIC-02')).not.toBeInTheDocument()
      const mics = sim.store.getState().captureConfig.mics
      // D22(3): channel 1 names MIC-02, channel 2 names MIC-01, channels 3 and 4 keep their lines - four lines, every pair complete.
      expect(mics).toHaveLength(4)
      expect(mics.find((mic) => mic.channel === 'MIC-01')).toMatchObject({ inputId: 'MIC-02', deviceId: 'MIC-02' })
      expect(mics.find((mic) => mic.channel === 'MIC-02')).toMatchObject({ inputId: 'MIC-01', deviceId: 'MIC-01' })
      for (const n of [1, 2, 3, 4]) expect(within(panel).queryByTestId(`selector-pair-incomplete-${n}`)).toBeNull()
      // Row 155 (D30 K-6) decides how many audit rows the swap writes (ONE channel-swap row); this row pins only that it is audited, as operation 78, scope MIC.
      const rows = captureAudit(sim)
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) expect(row.details).toMatchObject({ operationId: 'updateCaptureConfig', scope: 'MIC' })
      expect(getMissingI18nKeys()).toEqual([])
    })
  })

  describe('G70-02 Simulated mode: gates of the new controls (OD-10)', () => {
    it('a role without CAPTURE_CONFIG sees every channel select and Save disabled with the role sentence, none hidden', async () => {
      const { sim, panel } = await simSelector('idle', OPERATOR_IDS.BUDI)
      // 2026-10-29 revocation (migration 0034): TECHNICIAN is the only holder; the sentence names it alone.
      const sentence = en.common.rbac.requiresRole.replace('{{role}}', 'TECHNICIAN')
      for (const slot of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const) {
        // D61 (2026-11-04): four channel rows, each with its select and Save.
        expect(trigger(panel, slot)).toBeDisabled()
        expect(save(panel, slot)).toBeDisabled()
      }
      for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) {
        expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveTextContent(sentence)
        expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveAttribute('data-block', 'ROLE')
      }
      expect(captureAudit(sim)).toHaveLength(0)
    })

    it('with a session open both selects are disabled with the lock sentence', async () => {
      // The lock is only said to a holder (the role gate speaks first): mounted on the TECHNICIAN
      // since the 2026-10-29 CAPTURE_CONFIG revocation stripped the SUPERVISOR's grant.
      const { panel } = await simSelector('recording', OPERATOR_IDS.RINA)
      for (const slot of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const) expect(trigger(panel, slot)).toBeDisabled() // D61: four channels
      for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) {
        expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveTextContent(S.locked)
        expect(within(panel).getByTestId(`selector-reason-${id}`)).toHaveAttribute('data-block', 'LOCKED')
      }
    })
  })

  describe('G70-02 Live mode (a Core in real capture): wording, the one request, refusals', () => {
    it('the option of this Mac\'s microphone says so and "Development source"; choosing it shows the limit sentence; Save is ONE operation 78 line by channel (D61)', async () => {
      const { bed: created, panel } = await liveSelector()
      fireEvent.click(trigger(panel, 'MIC-01'))
      const option = await screen.findByRole('option', { name: /MIC-05/ }) // D61: the added microphone is MIC-05 (MIC-03/04 are built-ins now)
      expect(option).toHaveTextContent(en.common.sourceClass.kind.localMicrophone)
      expect(option).toHaveTextContent(en.common.sourceClass.badge)
      fireEvent.click(option)
      await waitFor(() => expect(save(panel, 'MIC-01')).toBeEnabled())
      expect(within(panel).getByTestId('source-limit-choice-MIC-01')).toHaveTextContent(en.common.localSourceNotice.microphoneLimit)
      expect(requests('updateCaptureConfig')).toHaveLength(0)

      const served = clone(created.core.served.captureConfig)
      const next = {
        ...served,
        updatedAt: served.updatedAt + 1,
        mics: served.mics.map((mic) => (mic.channel === 'MIC-01' ? { ...mic, inputId: 'MIC-05', deviceId: 'MIC-05' } : mic)),
      }
      created.fake.scriptCommand('updateCaptureConfig', {
        ops: [{ op: 'replace', slice: 'captureConfig', value: next }] as FakeCommandOptions['ops'],
        order: 'answer-first',
        answer: { status: 200, body: next },
      })
      fireEvent.click(save(panel, 'MIC-01'))
      await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-05')).toHaveTextContent(PAIR_MIC(1)))
      expect(requests('updateCaptureConfig')).toHaveLength(1)
      // D61 (2026-11-04): ONE line by channel — the pair replacement of D133 (1) is superseded.
      expect(requests('updateCaptureConfig')[0]).toMatchObject({
        method: 'POST',
        path: '/api/v1/capture/config',
        body: {
          mics: [{ inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-01' }],
        },
      })
      expect(requests('setPrimaryMic')).toHaveLength(0)
      // The saved line carries the badge and the limit, as built.
      expect(within(panel).getByTestId('selector-badge-MIC-05')).toHaveTextContent(en.common.sourceClass.badge)
      expect(within(panel).getByTestId('source-limit-selector-MIC-05')).toHaveTextContent(en.common.localSourceNotice.microphoneLimit)
    })

    it('refusals keep the selector\'s words: 409 locked, 422 development only, another 422 "not accepted"; no line changes', async () => {
      const { bed: created, panel } = await liveSelector()
      const message = () => within(panel).findByTestId('selector-mic-message-MIC-02')
      await choose(panel, 'MIC-02', /MIC-05/) // D61: the added microphone is MIC-05; the row is channel 2
      created.fake.answerOnce('updateCaptureConfig', created.fake.example('updateCaptureConfig', 409, 'locked'))
      fireEvent.click(save(panel, 'MIC-02'))
      expect(await message()).toHaveTextContent(S.locked)
      created.fake.answerOnce('updateCaptureConfig', refusal(422, 'INVALID_INPUT', 'Refused.', { in: 'body', reason: 'DEVELOPMENT_SOURCE_NOT_ALLOWED', deviceId: 'MIC-05' }))
      await waitFor(() => expect(save(panel, 'MIC-02')).toBeEnabled())
      fireEvent.click(save(panel, 'MIC-02'))
      await waitFor(async () => expect(await message()).toHaveTextContent(S.developmentOnly))
      created.fake.answerOnce('updateCaptureConfig', refusal(422, 'INVALID_INPUT'))
      await waitFor(() => expect(save(panel, 'MIC-02')).toBeEnabled())
      fireEvent.click(save(panel, 'MIC-02'))
      await waitFor(async () => expect(await message()).toHaveTextContent(S.invalid))
      expect(requests('updateCaptureConfig')).toHaveLength(3)
      expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(PAIR_MIC(2))
      expect(within(panel).queryByTestId('selector-mic-MIC-05')).not.toBeInTheDocument()
    })

    it('AC-4.5 (row 156; D22(3)): choosing on Pair 1 the mic Pair 2 holds sends, after the confirm, ONE operation 78 request of the two-line swap body - no `unassign`', async () => {
      const { bed: created, panel } = await liveSelector()
      fireEvent.click(trigger(panel, 'MIC-01'))
      const other = await screen.findByRole('option', { name: /MIC-02/ })
      expect(other).not.toHaveAttribute('aria-disabled', 'true')
      expect(other).toHaveTextContent(ON_PAIR(2))
      fireEvent.click(other)
      await waitFor(() => expect(save(panel, 'MIC-01')).toBeEnabled())
      const served = clone(created.core.served.captureConfig)
      // S5 §2.2: the two microphones trade channels; channels 3 and 4 keep their lines.
      const one = served.mics.find((mic) => mic.channel === 'MIC-01')!
      const two = served.mics.find((mic) => mic.channel === 'MIC-02')!
      const next = {
        ...served,
        updatedAt: served.updatedAt + 1,
        mics: [{ ...two, channel: 'MIC-01' as const }, { ...one, channel: 'MIC-02' as const }, ...served.mics.filter((mic) => mic.channel === 'MIC-03' || mic.channel === 'MIC-04')],
      }
      created.fake.scriptCommand('updateCaptureConfig', {
        ops: [{ op: 'replace', slice: 'captureConfig', value: next }] as FakeCommandOptions['ops'],
        order: 'answer-first',
        answer: { status: 200, body: next },
      })
      fireEvent.click(save(panel, 'MIC-01'))
      // The Save asks first; nothing is sent before the confirm.
      const dialog = await screen.findByTestId('selector-mic-swap-dialog-MIC-01')
      expect(within(dialog).getByTestId('selector-mic-swap-text-MIC-01').textContent).toBe(
        P.swapConfirm.replace('{{deviceId}}', 'MIC-02').replace('{{to}}', '1').replace('{{other}}', one.deviceId).replace('{{from}}', '2'),
      )
      expect(requests('updateCaptureConfig')).toHaveLength(0)
      fireEvent.click(within(dialog).getByTestId('selector-mic-swap-confirm-MIC-01'))
      await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(PAIR_MIC(1)))
      expect(within(panel).queryByTestId('selector-not-assigned-MIC-02')).not.toBeInTheDocument()
      expect(requests('updateCaptureConfig')).toHaveLength(1)
      expect((requests('updateCaptureConfig')[0] as { body: unknown }).body).toEqual({
        mics: [
          { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' },
          { inputId: one.deviceId, deviceId: one.deviceId, channel: 'MIC-02' },
        ],
      })
      expect(requests('setPrimaryMic')).toHaveLength(0)
    })
  })

  describe('cameras: a registered camera on EACH video track from the web (gate 70 did it live; pinned here)', () => {
    it.each([
      ['VIDEO-01', 'CAM-01'],
      ['VIDEO-02', 'CAM-02'],
    ] as const)('CAM-05 is saved on %s: one row of operation 79 for that track, the other track untouched', async (trackId, from) => { // D60: the added camera is CAM-05 now
      // Saving a track is an edit: mounted on the TECHNICIAN since the 2026-10-29 CAPTURE_CONFIG revocation.
      const { sim, panel } = await simSelector('idle', OPERATOR_IDS.RINA, 'CAMERA')
      fireEvent.click(within(within(panel).getByTestId(`selector-source-${trackId}`)).getByRole('button'))
      fireEvent.click(await screen.findByRole('option', { name: /CAM-05/ })) // D60 (2026-11-04): the added camera
      const button = within(panel).getByTestId(`selector-save-${trackId}`)
      await waitFor(() => expect(button).toBeEnabled())
      fireEvent.click(button)
      await waitFor(() => expect(within(panel).getByTestId(`selector-camera-${trackId}`)).toHaveAttribute('data-device', 'CAM-05')) // D60
      const other = trackId === 'VIDEO-01' ? 'VIDEO-02' : 'VIDEO-01'
      expect(within(panel).getByTestId(`selector-camera-${other}`)).toHaveAttribute('data-device', other === 'VIDEO-01' ? 'CAM-01' : 'CAM-02')
      expect(captureAudit(sim).map((row) => row.details)).toEqual([expect.objectContaining({ operationId: 'setCaptureCameraSource', trackId, from, to: 'CAM-05' })]) // D60
    })
  })

  // Task 4 row 31 (WP-13a; row 27 sites W1, W2; decisions C18 (3), C21 (8); names register section 6).
  // The double is a hand-built selector slice with 0, 1 and 2 lines per kind: the simulator's store in
  // Simulated mode, the served slice of the fake Core in Live mode. No browser session.
  //
  // | State of a slot | Where it is proven |
  // |-----------------|--------------------|
  // | assigned: drawn as before; "Not assigned" is one more option of its select | "one row per slot", "a held slot can be cleared" |
  // | not assigned: the row is drawn, says so, and offers the sources with "Assign" | "one row per slot" |
  // | assigning: the row is busy until the Core answers; nothing is optimistic | "an empty slot is assigned" |
  // | refused: the field keeps the Core's reason in the selector's words | "a refused assignment" |
  describe('task 4 row 31 (D61: eight slots): one row per SLOT - an empty slot is drawn with its offer, a held one can be cleared', () => {
    const SLOT = en.common.captureSlot
    type Config = SimState['captureConfig']
    // D60 (2026-11-04): four video slots. D61 (2026-11-04): EIGHT slots — four video tracks and
    // four microphone channels.
    const SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const
    type Slot = (typeof SLOTS)[number]
    /** The seeded selector with only the lines of `keep`. */
    const only = (config: Config, keep: readonly Slot[]): Config => ({
      ...config,
      cameras: config.cameras.filter((line) => keep.includes(line.trackId as Slot)),
      mics: config.mics.filter((line) => keep.includes(line.channel as Slot)),
    })
    const rowOf = (panel: HTMLElement, slot: Slot) => panel.querySelector<HTMLElement>(`[data-selector-slot="${slot}"]`)!
    const isVideo = (slot: Slot) => (slot as string).startsWith('VIDEO-') // D60: any of the four video slots
    const selectOf = (panel: HTMLElement, slot: Slot) => within(within(panel).getByTestId(isVideo(slot) ? `selector-source-${slot}` : `selector-mic-source-${slot}`)).getByRole('button')
    const saveOf = (panel: HTMLElement, slot: Slot) => within(panel).getByTestId(isVideo(slot) ? `selector-save-${slot}` : `selector-mic-save-${slot}`)
    async function pick(panel: HTMLElement, slot: Slot, name: RegExp | string) {
      fireEvent.click(selectOf(panel, slot))
      fireEvent.click(await screen.findByRole('option', { name }))
      await waitFor(() => expect(saveOf(panel, slot)).toBeEnabled())
    }
    async function simSlots(keep: readonly Slot[], operatorId: string = OPERATOR_IDS.RINA) {
      // Default mount: the seeded TECHNICIAN — these rows drive the slot edits, whose
      // CAPTURE_CONFIG the SUPERVISOR lost on 2026-10-29 (migration 0034).
      const authStorage = createMemoryAuthStorage()
      authStorage.save({ operatorId, issuedAt: Date.now() })
      const sim = createSim({ scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
      sims.push(sim)
      sim.store.setState({ captureConfig: only(sim.store.getState().captureConfig, keep) })
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/devices'] }) })
      render(<RouterProvider router={router} />)
      await screen.findByTestId('page-devices', undefined, { timeout: 8_000 })
      return { sim, panel: await screen.findByTestId('panel-selector') }
    }
    const liveSlots = (keep: readonly Slot[]) => liveSelector((created) => (created.core.served.captureConfig = only(created.core.served.captureConfig, keep)))

    it.each([
      ['0 lines of each kind', [] as readonly Slot[]],
      ['1 line of each kind (the second camera, channel 2 alone)', ['VIDEO-02', 'MIC-02'] as readonly Slot[]],
      ['1 line of each kind (the first camera, channel 1 alone)', ['VIDEO-01', 'MIC-01'] as readonly Slot[]],
      ['all lines of the seeded selector (four cameras, four microphones — D61, 2026-11-04)', SLOTS as readonly Slot[]],
    ])('one row per slot with %s: 8 rows, each empty one says "Not assigned" and offers "Assign"', async (_name, keep) => { // D61 (2026-11-04): eight slots
      const { panel } = await simSlots(keep)
      const rows = [...panel.querySelectorAll<HTMLElement>('[data-selector-slot]')]
      // D61 (2026-11-04): one row per slot — four video tracks and four microphone channels.
      expect(rows).toHaveLength(8)
      expect(rows.map((row) => row.getAttribute('data-selector-slot')).sort()).toEqual([...SLOTS].sort())
      for (const slot of SLOTS) {
        const row = rowOf(panel, slot)
        const held = keep.includes(slot)
        expect(row).toHaveAttribute('data-state', held ? 'ASSIGNED' : 'NOT_ASSIGNED')
        if (held) {
          expect(within(row).queryByTestId(`selector-not-assigned-${slot}`)).toBeNull()
          expect(saveOf(panel, slot)).toHaveTextContent(S.save)
          continue
        }
        // The empty row: the slot's name, the words, no device, no state chip, and the offer.
        // Row 156 (U-13): a microphone slot is named by its pair ("Mic N (Camera N)"), a video slot by the shared slot list.
        const slotName = slot.startsWith('MIC-') ? PAIR_MIC(Number(slot.slice(-2))) : SLOT[slot]
        expect(row).toHaveTextContent(slotName)
        expect(within(row).getByTestId(`selector-not-assigned-${slot}`)).toHaveTextContent(SLOT.notAssigned)
        expect(row).not.toHaveAttribute('data-device')
        expect(row).not.toHaveTextContent(S.online)
        expect(row).not.toHaveTextContent(S.offline)
        // (The head of the row: the select below it lists the registered sources, which is the offer.)
        expect(row.querySelector('.dev-sel-head')!.textContent ?? '').not.toMatch(/CAM-0\d|MIC-0\d/)
        expect(within(row).getByText(SLOT.assignLabel.replace('{{slot}}', slotName))).toBeInTheDocument()
        expect(selectOf(panel, slot)).toBeEnabled()
        expect(selectOf(panel, slot)).toHaveTextContent(SLOT.notAssigned)
        // "Assign" waits for a source, as Save waits for a different choice.
        expect(saveOf(panel, slot)).toHaveTextContent(SLOT.assign)
        expect(saveOf(panel, slot)).toBeDisabled()
        expect(within(row).queryByTestId(`selector-reason-${slot}`)).toBeNull()
      }
      // A lone channel 2 line is not drawn as the transcribed one, and "Make transcribed channel 1" belongs to a held channel other than 1 (D61).
      if (keep.includes('MIC-02') && !keep.includes('MIC-01')) {
        expect(within(rowOf(panel, 'MIC-02')).getByTestId('selector-role-MIC-02')).toHaveTextContent(PAIR_MIC(2))
        expect(within(rowOf(panel, 'MIC-01')).queryByRole('button', { name: S.makePrimary })).toBeNull()
      }
      expect(within(panel).queryByTestId('selector-empty')).toBeNull()
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('AC-4.5 (row 156): four "Camera N <-> Mic N" pair rows in pair order, also after two channels traded places; "Transcribed" only on Pair 1', async () => {
      const { sim, panel } = await simSlots(SLOTS)
      const order = () => [...panel.querySelectorAll<HTMLElement>('[data-selector-slot]')].map((row) => row.getAttribute('data-testid'))
      const PAIRS = ['selector-camera-VIDEO-01', 'selector-mic-MIC-01', 'selector-camera-VIDEO-02', 'selector-mic-MIC-02', 'selector-camera-VIDEO-03', 'selector-mic-MIC-03', 'selector-camera-VIDEO-04', 'selector-mic-MIC-04']
      // Row 156 (D27): the pairing is by number - each pair row holds its camera and its mic, in pair order.
      expect(order()).toEqual(PAIRS)
      for (const n of [1, 2, 3, 4]) {
        const pair = within(panel).getByTestId(`selector-pair-${n}`)
        expect(within(pair).getByTestId(`selector-pair-label-${n}`).textContent).toBe(`Camera ${n} <-> Mic ${n}`)
        expect(within(pair).getByTestId(`selector-camera-VIDEO-0${n}`)).toBeInTheDocument()
        expect(pair.querySelector(`[data-selector-slot="MIC-0${n}"]`)).not.toBeNull()
        expect(pair).toHaveAttribute('data-complete', 'true')
        expect(within(pair).queryByTestId(`selector-pair-incomplete-${n}`)).toBeNull()
        if (n === 1) expect(within(pair).getByTestId('selector-pair-transcribed-1')).toHaveTextContent(P.transcribed)
        else expect(within(pair).queryByTestId(`selector-pair-transcribed-${n}`)).toBeNull()
      }
      const config = sim.store.getState().captureConfig
      await act(async () => {
        sim.store.setState({ captureConfig: { ...config, mics: config.mics.map((mic) => ({ ...mic, channel: mic.channel === 'MIC-01' ? 'MIC-02' : mic.channel === 'MIC-02' ? 'MIC-01' : mic.channel })) } })
      })
      await waitFor(() => expect(within(panel).getByTestId('selector-role-MIC-02')).toHaveTextContent(PAIR_MIC(1)))
      // The mic rows are the slots of their pairs: the traded microphones changed rows, the pairs kept their order.
      expect(order()).toEqual(['selector-camera-VIDEO-01', 'selector-mic-MIC-02', 'selector-camera-VIDEO-02', 'selector-mic-MIC-01', 'selector-camera-VIDEO-03', 'selector-mic-MIC-03', 'selector-camera-VIDEO-04', 'selector-mic-MIC-04'])
    })

    it('AC-4.5 (row 156): a pair with an empty side says it is incomplete; a complete pair does not', async () => {
      const { panel } = await simSlots(['VIDEO-01', 'MIC-01', 'VIDEO-02', 'MIC-03', 'VIDEO-04'])
      expect(within(panel).queryByTestId('selector-pair-incomplete-1')).toBeNull()
      for (const n of [2, 3, 4]) {
        expect(within(panel).getByTestId(`selector-pair-${n}`)).toHaveAttribute('data-complete', 'false')
        expect(within(panel).getByTestId(`selector-pair-incomplete-${n}`).textContent).toBe(P.incomplete.replace('{{n}}', String(n)))
      }
    })

    it('the gates of an empty row: a role without CAPTURE_CONFIG sees the offer disabled with the role sentence, never hidden', async () => {
      const { panel } = await simSlots([], OPERATOR_IDS.BUDI)
      // 2026-10-29 revocation (migration 0034): TECHNICIAN is the only holder; the sentence names it alone.
      const sentence = en.common.rbac.requiresRole.replace('{{role}}', 'TECHNICIAN')
      for (const slot of SLOTS) {
        expect(selectOf(panel, slot)).toBeDisabled()
        expect(saveOf(panel, slot)).toBeDisabled()
        expect(within(panel).getByTestId(`selector-reason-${slot}`)).toHaveTextContent(sentence)
        expect(within(panel).getByTestId(`selector-reason-${slot}`)).toHaveAttribute('data-block', 'ROLE')
      }
    })

    it('an empty video slot is assigned: ONE operation 79 for that track; the row is busy until the Core answers, then it is the Core\'s line', async () => {
      const { bed: created, panel } = await liveSlots(['VIDEO-02', 'MIC-01', 'MIC-02'])
      expect(rowOf(panel, 'VIDEO-01')).toHaveAttribute('data-state', 'NOT_ASSIGNED')
      const held = created.fake.hold('setCaptureCameraSource')
      await pick(panel, 'VIDEO-01', /CAM-01/)
      expect(requests('setCaptureCameraSource')).toHaveLength(0)
      fireEvent.click(saveOf(panel, 'VIDEO-01'))
      // Assigning: the row is busy and still not assigned (nothing is optimistic).
      await waitFor(() => expect(rowOf(panel, 'VIDEO-01')).toHaveAttribute('aria-busy', 'true'))
      expect(rowOf(panel, 'VIDEO-01')).toHaveAttribute('data-state', 'NOT_ASSIGNED')
      expect(selectOf(panel, 'VIDEO-01')).toBeDisabled()
      const served = clone(created.core.served.captureConfig)
      const next = { ...served, updatedAt: served.updatedAt + 1, cameras: [{ ...served.cameras[0]!, trackId: 'VIDEO-01', deviceId: 'CAM-01' }, ...served.cameras] }
      await act(async () => {
        held.release({ status: 200, body: next })
      })
      await waitFor(() => expect(rowOf(panel, 'VIDEO-01')).toHaveAttribute('data-state', 'ASSIGNED'))
      expect(rowOf(panel, 'VIDEO-01')).toHaveAttribute('data-device', 'CAM-01')
      expect(rowOf(panel, 'VIDEO-01')).not.toHaveAttribute('aria-busy')
      expect(saveOf(panel, 'VIDEO-01')).toHaveTextContent(S.save)
      expect(requests('setCaptureCameraSource')).toHaveLength(1)
      expect(requests('setCaptureCameraSource')[0]).toMatchObject({ method: 'POST', path: '/api/v1/capture/cameras/CAM-01/source', body: { trackId: 'VIDEO-01' } })
      expect(requests('updateCaptureConfig')).toHaveLength(0)
    })

    it('an empty microphone slot is assigned: operation 78 with ONE line by channel, whatever the other channels hold (D61)', async () => {
      // No channel held: the command is built (not "nothing to send") - one line, the channel it is for.
      const first = await liveSlots(['VIDEO-01', 'VIDEO-02'])
      await pick(first.panel, 'MIC-02', /MIC-03/)
      first.bed.fake.answerOnce('updateCaptureConfig', { status: 200, body: clone(first.bed.core.served.captureConfig) })
      fireEvent.click(saveOf(first.panel, 'MIC-02'))
      await waitFor(() => expect(requests('updateCaptureConfig')).toHaveLength(1))
      expect(requests('updateCaptureConfig')[0]).toMatchObject({ method: 'POST', path: '/api/v1/capture/config', body: { mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-02' }] } })
      expect((requests('updateCaptureConfig')[0] as { body: { mics: unknown[] } }).body.mics).toHaveLength(1)
      cleanup()
      first.bed.dispose()

      // Channel 1 empty, channel 3 held by MIC-03: still ONE line (a line assigns its channel ALONE); the held microphone is offered as a MOVE, not a second place.
      const second = await liveSlots(['VIDEO-01', 'VIDEO-02', 'MIC-03'])
      fireEvent.click(selectOf(second.panel, 'MIC-01'))
      // R-FLEX row 133 (T-14; D61): the other channel's microphone says where it stands.
      expect(await screen.findByRole('option', { name: /MIC-03/ })).toHaveTextContent(ON_PAIR(3))
      fireEvent.click(await screen.findByRole('option', { name: /MIC-01/ }))
      await waitFor(() => expect(saveOf(second.panel, 'MIC-01')).toBeEnabled())
      second.bed.fake.answerOnce('updateCaptureConfig', { status: 200, body: clone(second.bed.core.served.captureConfig) })
      fireEvent.click(saveOf(second.panel, 'MIC-01'))
      await waitFor(() => expect(requests('updateCaptureConfig')).toHaveLength(1))
      expect(requests('updateCaptureConfig')[0]).toMatchObject({
        body: {
          mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-01' }],
        },
      })
    })

    it('a held slot can be cleared: "Not assigned" is an option of its select, and Save is operation 78 with `unassign` and nothing else', async () => {
      const { bed: created, panel } = await liveSlots(SLOTS)
      await pick(panel, 'VIDEO-02', SLOT.notAssigned)
      // Not optimistic: the row is the Core's line until the answer.
      expect(rowOf(panel, 'VIDEO-02')).toHaveAttribute('data-state', 'ASSIGNED')
      const served = clone(created.core.served.captureConfig)
      const next = { ...served, updatedAt: served.updatedAt + 1, cameras: served.cameras.filter((line) => line.trackId !== 'VIDEO-02') }
      created.fake.scriptCommand('updateCaptureConfig', {
        ops: [{ op: 'replace', slice: 'captureConfig', value: next }] as FakeCommandOptions['ops'],
        order: 'answer-first',
        answer: { status: 200, body: next },
      })
      fireEvent.click(saveOf(panel, 'VIDEO-02'))
      await waitFor(() => expect(rowOf(panel, 'VIDEO-02')).toHaveAttribute('data-state', 'NOT_ASSIGNED'))
      expect(requests('updateCaptureConfig')).toHaveLength(1)
      expect((requests('updateCaptureConfig')[0] as { body: unknown }).body).toEqual({ unassign: ['VIDEO-02'] })
      expect(requests('setCaptureCameraSource')).toHaveLength(0)
      expect(saveOf(panel, 'VIDEO-02')).toHaveTextContent(SLOT.assign)
      expect(rowOf(panel, 'VIDEO-01')).toHaveAttribute('data-device', 'CAM-01')

      // A microphone channel (D61): the same member, the channel as the slot.
      await pick(panel, 'MIC-02', SLOT.notAssigned)
      created.fake.answerOnce('updateCaptureConfig', { status: 200, body: next })
      fireEvent.click(saveOf(panel, 'MIC-02'))
      await waitFor(() => expect(requests('updateCaptureConfig')).toHaveLength(2))
      expect((requests('updateCaptureConfig')[1] as { body: unknown }).body).toEqual({ unassign: ['MIC-02'] })
    })

    it('a refused assignment of an empty slot keeps the Core\'s reason at the field and the slot empty', async () => {
      const { bed: created, panel } = await liveSlots(['VIDEO-02', 'MIC-02'])
      await pick(panel, 'VIDEO-01', /CAM-01/)
      created.fake.answerOnce('setCaptureCameraSource', created.fake.example('updateCaptureConfig', 409, 'locked'))
      fireEvent.click(saveOf(panel, 'VIDEO-01'))
      expect(await within(panel).findByTestId('selector-message-VIDEO-01')).toHaveTextContent(S.locked)
      expect(rowOf(panel, 'VIDEO-01')).toHaveAttribute('data-state', 'NOT_ASSIGNED')

      await pick(panel, 'MIC-01', /MIC-05/) // D61: the added microphone is MIC-05; the row is channel 1
      created.fake.answerOnce('updateCaptureConfig', refusal(422, 'INVALID_INPUT', 'Refused.', { in: 'body', reason: 'DEVELOPMENT_SOURCE_NOT_ALLOWED', deviceId: 'MIC-05' }))
      fireEvent.click(saveOf(panel, 'MIC-01'))
      expect(await within(panel).findByTestId('selector-mic-message-MIC-01')).toHaveTextContent(S.developmentOnly)
      created.fake.answerOnce('updateCaptureConfig', refusal(422, 'INVALID_INPUT', 'Refused.', { in: 'body', reason: 'MIC_ON_BOTH_INPUTS' }))
      await waitFor(() => expect(saveOf(panel, 'MIC-01')).toBeEnabled())
      fireEvent.click(saveOf(panel, 'MIC-01'))
      await waitFor(async () => expect(await within(panel).findByTestId('selector-mic-message-MIC-01')).toHaveTextContent(S.invalid))
      expect(rowOf(panel, 'MIC-01')).toHaveAttribute('data-state', 'NOT_ASSIGNED')
      expect(within(panel).queryByTestId('selector-mic-MIC-05')).not.toBeInTheDocument()
    })

    // Task 4 row 234 (the user's run on real cameras; decision C60): the Core answered
    // `422 INVALID_INPUT` with a word in `details.reason` and the console said "not accepted".
    it('row 234: a refused camera assignment states the reason of EVERY word the Core answers - the production camera on a development Core, the camera no adapter serves, the class, the two profile words, an unworded code; the slot stays empty', async () => {
      const { bed: created, panel } = await liveSlots(['VIDEO-02', 'MIC-01', 'MIC-02'])
      const R = enWeb.web.captureSlotRefusal
      // Row V4 (decision C80) and its clean-up: ONE SOURCE - the sentences and the two nouns are the shared tree's, and this console's tree
      // holds NO copy of them, not even by reference: what is left under `web.captureSlotRefusal` is the code sentence alone.
      const shared = en.common.captureSlotRefusal
      expect(Object.keys(R)).toEqual(['code'])
      expect(Object.keys(en.common.captureSlotSource)).toEqual(['CAMERA', 'MIC'])
      // THE PIN: what a production camera on a development Core reads, word for word (the user's run on real cameras; decision C60).
      expect(shared.PRODUCTION_SOURCE_NOT_ALLOWED.replaceAll('{{source}}', en.common.captureSlotSource.CAMERA)).toBe(
        'This camera was not assigned: it is a production device, and this Core runs in development capture operation. This camera can be assigned only on a Core running in production capture operation. Nothing was changed.',
      )
      const camera = (sentence: string) => sentence.replaceAll('{{source}}', en.common.captureSlotSource.CAMERA)
      const expected: readonly (readonly [string, string])[] = [
        ['PRODUCTION_SOURCE_NOT_ALLOWED', camera(shared.PRODUCTION_SOURCE_NOT_ALLOWED)],
        ['CAPTURE_DEVICE_NOT_SERVED', camera(shared.CAPTURE_DEVICE_NOT_SERVED)],
        ['CAPTURE_DEVICE_CLASS_MISMATCH', camera(shared.CAPTURE_DEVICE_CLASS_MISMATCH)],
        ['CAMERA_PROFILE_NOT_STATED', en.common.captureSlotRefusal.CAMERA_PROFILE_NOT_STATED],
        ['CAMERA_PROFILE_NOT_OF_DEVICE', en.common.captureSlotRefusal.CAMERA_PROFILE_NOT_OF_DEVICE],
        // Row W6 (line 564): the new word reads the shared sentence, which names adoption (a connection test does not repair it).
        ['CAMERA_PROFILE_WITHOUT_STREAM', en.common.captureSlotRefusal.CAMERA_PROFILE_WITHOUT_STREAM],
        ['DEVELOPMENT_SOURCE_NOT_ALLOWED', S.developmentOnly],
        ['CAPTURE_ADAPTER_KIND_NOT_ALLOWED', `${S.invalid} ${R.code.replace('{{code}}', 'CAPTURE_ADAPTER_KIND_NOT_ALLOWED')}`],
      ]
      // The sentence the user's case reads, word for word: what is true of a production camera on a development Core.
      expect(expected[0]![1]).toContain('This camera can be assigned only on a Core running in production capture operation.')
      await pick(panel, 'VIDEO-01', /CAM-01/)
      for (const [reason, sentence] of expected) {
        created.fake.answerOnce('setCaptureCameraSource', refusal(422, 'INVALID_INPUT', 'This capture device cannot be assigned.', { in: 'body', reason, deviceId: 'CAM-01' }))
        await waitFor(() => expect(saveOf(panel, 'VIDEO-01')).toBeEnabled())
        fireEvent.click(saveOf(panel, 'VIDEO-01'))
        await waitFor(async () => expect((await within(panel).findByTestId('selector-message-VIDEO-01')).textContent).toBe(sentence))
        // Never the answer's own text, and never a bare word standing in for a sentence.
        expect(within(panel).getByTestId('selector-message-VIDEO-01')).not.toHaveTextContent('This capture device cannot be assigned.')
      }
      expect(requests('setCaptureCameraSource')).toHaveLength(expected.length)
      expect(rowOf(panel, 'VIDEO-01')).toHaveAttribute('data-state', 'NOT_ASSIGNED')
      // A word that has not the form of a code is not drawn: the general sentence alone.
      created.fake.answerOnce('setCaptureCameraSource', refusal(422, 'INVALID_INPUT', 'Refused.', { in: 'body', reason: '<b>not a code</b>' }))
      await waitFor(() => expect(saveOf(panel, 'VIDEO-01')).toBeEnabled())
      fireEvent.click(saveOf(panel, 'VIDEO-01'))
      await waitFor(() => expect(within(panel).getByTestId('selector-message-VIDEO-01').textContent).toBe(S.invalid))
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('row 234: `slotRefusalWording` words every reason the capture-config routes name, the shared tree first; a microphone row names a microphone', async () => {
      // The closed lists of `apps/core-server/src/modules/capture-config/routes.ts` (`CaptureAssignmentRefusal`, `CaptureProfileRefusal`) and the action's own word.
      // Row W6 (request line 564; row V7c, decision C130): `CAMERA_PROFILE_WITHOUT_STREAM` reached the shared tree.
      const named = ['DEVELOPMENT_SOURCE_NOT_ALLOWED', 'PRODUCTION_SOURCE_NOT_ALLOWED', 'CAPTURE_DEVICE_NOT_SERVED', 'CAPTURE_DEVICE_CLASS_MISMATCH', 'CAMERA_PROFILE_NOT_STATED', 'CAMERA_PROFILE_NOT_OF_DEVICE', 'CAMERA_PROFILE_WITHOUT_STREAM', 'SLOT_UNASSIGNED_AND_ASSIGNED', 'CAPTURE_DEVICE_RETIRED']
      // R-FLEX row 133: + `CAPTURE_DEVICE_RETIRED`, the action's word for a retired device (task 4 row RD2, `sim/capture-config.ts:99`), worded in the shared group at HEAD; this pin had not followed it.
      for (const reason of named) expect(['DEVELOPMENT_ONLY', 'SHARED'], reason).toContain(slotRefusalWording(reason).kind)
      expect([...wordedSlotRefusalReasons()].sort()).toEqual([...named].sort())
      // The worded reasons are exactly the shared group's keys and the one development word: no table of this console adds one.
      expect([...wordedSlotRefusalReasons()].sort()).toEqual(['DEVELOPMENT_SOURCE_NOT_ALLOWED', ...Object.keys(en.common.captureSlotRefusal)].sort())
      expect(slotRefusalWording('CAMERA_PROFILE_NOT_STATED')).toEqual({ kind: 'SHARED', reason: 'CAMERA_PROFILE_NOT_STATED' })
      expect(slotRefusalWording('PRODUCTION_SOURCE_NOT_ALLOWED')).toEqual({ kind: 'SHARED', reason: 'PRODUCTION_SOURCE_NOT_ALLOWED' })
      expect(slotRefusalWording('CAPTURE_PROFILE_UNKNOWN')).toEqual({ kind: 'CODE', code: 'CAPTURE_PROFILE_UNKNOWN' })
      expect(slotRefusalWording(null)).toEqual({ kind: 'PLAIN' })
      expect(slotRefusalWording('lower case')).toEqual({ kind: 'PLAIN' })

      const { bed: created, panel } = await liveSlots(['VIDEO-01', 'VIDEO-02', 'MIC-03'])
      await pick(panel, 'MIC-01', /MIC-05/) // D61: the added microphone is MIC-05
      created.fake.answerOnce('updateCaptureConfig', refusal(422, 'INVALID_INPUT', 'Refused.', { in: 'body', reason: 'CAPTURE_DEVICE_NOT_SERVED', deviceId: 'MIC-05' }))
      fireEvent.click(saveOf(panel, 'MIC-01'))
      const message = await within(panel).findByTestId('selector-mic-message-MIC-01')
      expect(message.textContent).toBe(en.common.captureSlotRefusal.CAPTURE_DEVICE_NOT_SERVED.replaceAll('{{source}}', 'microphone'))
    })

    it('`micLineFor` builds one line by channel; `selectorSlotRows` finds a line by track and by CHANNEL, never by position (D61)', () => {
      const l1 = { channel: 'MIC-01', inputId: 'MIC-01', deviceId: 'MIC-01', transport: 'USB', online: true } as const
      const l2 = { channel: 'MIC-02', inputId: 'MIC-02', deviceId: 'MIC-02', transport: 'USB', online: true } as const
      const l3 = { channel: 'MIC-03', inputId: 'MIC-03', deviceId: 'MIC-03', transport: 'USB', online: true } as const
      const l4 = { channel: 'MIC-04', inputId: 'MIC-04', deviceId: 'MIC-04', transport: 'USB', online: true } as const
      // D61 (2026-11-04): a line assigns its channel ALONE — ONE line, whatever the other channels hold.
      expect(micLineFor('MIC-02', 'MIC-05')).toEqual([{ inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-02' }])
      expect(micLineFor('MIC-01', 'MIC-05')).toEqual([{ inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-01' }])
      expect(micLineFor('MIC-04', 'MIC-09')).toEqual([{ inputId: 'MIC-09', deviceId: 'MIC-09', channel: 'MIC-04' }])
      // Row 156 (D22(3); S5 §2.2): the device holds ANOTHER channel and the target channel is held - a SWAP of two lines by channel, no `unassign`.
      const swap = micMoveFor([l1, l2, l3, l4], 'MIC-01', 'MIC-02')
      expect(swap).toEqual({
        kind: 'SWAP',
        from: 'MIC-02',
        to: 'MIC-01',
        fromPair: 2,
        toPair: 1,
        deviceId: 'MIC-02',
        other: 'MIC-01',
        lines: [
          { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' },
          { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' },
        ],
      })
      expect(micMoveBody(swap!)).toEqual({ mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' }, { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' }] })
      expect(micMoveFor([l1, l2, l3, l4], 'MIC-04', 'MIC-03')).toMatchObject({ kind: 'SWAP', from: 'MIC-03', to: 'MIC-04', other: 'MIC-04', fromPair: 3, toPair: 4 })
      // The target channel is empty: nothing comes back - a MOVE that leaves the pair it came from incomplete.
      const move = micMoveFor([l2], 'MIC-01', 'MIC-02')
      expect(move).toEqual({ kind: 'MOVE', from: 'MIC-02', to: 'MIC-01', fromPair: 2, toPair: 1, deviceId: 'MIC-02', line: { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' } })
      expect(micMoveBody(move!)).toEqual({ unassign: ['MIC-02'], mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' }] })
      // Not a move: an unheld device, and the channel the device already holds (a no-op line, not an unassign).
      expect(micMoveFor([l1, l2, l3, l4], 'MIC-01', 'MIC-05')).toBeNull()
      expect(micMoveFor([l1, l2, l3, l4], 'MIC-02', 'MIC-02')).toBeNull()
      expect(micMoveFor([l1], 'MIC-01', 'MIC-01')).toBeNull()
      expect(micMoveFor([], 'MIC-01', 'MIC-01')).toBeNull()

      const camera = { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25', online: true, streamState: 'LIVE' } as const
      // A lone VIDEO-02 line is the SECOND row, a lone channel 2 line the SECOND microphone row.
      // D60/D61: four video and four microphone rows per contract, empty slots drawn as null lines.
      expect(selectorSlotRows({ cameras: [camera], mics: [l2] })).toEqual({
        cameras: [{ slot: 'VIDEO-01', line: null }, { slot: 'VIDEO-02', line: camera }, { slot: 'VIDEO-03', line: null }, { slot: 'VIDEO-04', line: null }],
        mics: [{ slot: 'MIC-01', line: null }, { slot: 'MIC-02', line: l2 }, { slot: 'MIC-03', line: null }, { slot: 'MIC-04', line: null }],
      })
      expect(selectorSlotRows({ cameras: [], mics: [] })).toEqual({
        cameras: [{ slot: 'VIDEO-01', line: null }, { slot: 'VIDEO-02', line: null }, { slot: 'VIDEO-03', line: null }, { slot: 'VIDEO-04', line: null }],
        mics: [{ slot: 'MIC-01', line: null }, { slot: 'MIC-02', line: null }, { slot: 'MIC-03', line: null }, { slot: 'MIC-04', line: null }],
      })
      // A complete kind keeps the order of its lines (input order: the channel 2 line may be the first).
      expect(selectorSlotRows({ cameras: [], mics: [l2, l1, l4, l3] }).mics.map((row) => [row.slot, row.line?.inputId])).toEqual([
        ['MIC-02', 'MIC-02'],
        ['MIC-01', 'MIC-01'],
        ['MIC-04', 'MIC-04'],
        ['MIC-03', 'MIC-03'],
      ])
      // Row 156 (D27; AC-4.5): the four pairs, always in pair order, each slot by track / by CHANNEL; Pair 1 transcribed; an empty side is incomplete.
      expect(selectorPairRows({ cameras: [camera], mics: [l2, l1, l4, l3] }).map((row) => [row.pair, row.camera.slot, row.mic.slot, row.mic.line?.inputId ?? null, row.transcribed, row.incomplete])).toEqual([
        [1, 'VIDEO-01', 'MIC-01', 'MIC-01', true, true],
        [2, 'VIDEO-02', 'MIC-02', 'MIC-02', false, false],
        [3, 'VIDEO-03', 'MIC-03', 'MIC-03', false, true],
        [4, 'VIDEO-04', 'MIC-04', 'MIC-04', false, true],
      ])
      expect(micPairLabel('MIC-03')).toEqual({ key: 'devices.pairs.micOfCamera', values: { n: 3 } })
    })
  })
})

// Fix wave H, closing pass Z2 (driver D's note 124, section 4 item 2; decision D206; generalized by
// D61 of 2026-11-04): an audio card may not map its channel to a built-in id by a constant — the
// card of meter channel `AUDIO-0N` follows the SELECTOR LINE that names channel `MIC-0N`
// (`meterInputOfChannel`), and its badge, "is on" mark and unreachable mark are those of the
// microphone that IS on that line.
//
// Proven with the lines MIC-05 (channel 1, this Mac's microphone, open) / MIC-01 (channel 2, a
// generated source): the AUDIO-01 card carries MIC-05's marks, the AUDIO-02 card MIC-01's.
// CONTROL: the built-in set reads as before.
describe("the audio cards follow the selector's lines (driver D's note 124)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 8_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 30_000 })

  type Device = SimState['captureDevices']['devices'][number]
  type MicLine = SimState['captureConfig']['mics'][number]

  class SilentSocket implements SocketLike {
    readyState = 0
    onopen: SocketLike['onopen'] = null
    onmessage: SocketLike['onmessage'] = null
    onclose: SocketLike['onclose'] = null
    onerror: SocketLike['onerror'] = null
    close() {
      this.readyState = 3
    }
  }

  const sims: Sim[] = []
  let bed: LiveTestBed | undefined

  /** D61 (2026-11-04): the lines MIC-05 (channel 1) / MIC-01 (channel 2); channels 3 and 4 name none. */
  const pairOf = (mics: readonly MicLine[]): MicLine[] => [
    { ...mics[0]!, inputId: 'MIC-05', deviceId: 'MIC-05', channel: 'MIC-01' } as MicLine,
    { ...mics[0]!, inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' } as MicLine,
  ]

  function sessionOf(operatorId: string): Pick<AuthSessionInfo, 'operator' | 'permissions'> {
    const operator = OPERATORS.find((entry) => entry.id === operatorId)!
    return {
      operator: { id: operator.id, username: operator.username, rank: operator.rank, name: operator.name, displayName: operator.displayName, initials: operator.initials, role: operator.role },
      permissions: [...ROLE_PERMISSIONS[operator.role]],
    }
  }

  /** A Live console on a Core in real capture. `pair`: MIC-03 / MIC-01 on the lines; else the built-in pair. */
  async function liveDevices(pair: boolean) {
    const created = createLiveTestBed({ session: sessionOf(OPERATOR_IDS.ANDI) })
    bed = created
    const served = created.core.served
    const devices = served.captureDevices.devices.map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device)
    const like = devices.find((device) => device.kind === 'MIC')!
    // D61 (2026-11-04): the added microphone is MIC-05 — MIC-03/MIC-04 are built-ins of the four-channel plane.
    served.captureDevices = { devices: [...devices, { ...like, id: 'MIC-05', model: 'Added microphone', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT', sourceOpen: true } as Device] }
    if (pair) served.captureConfig = { ...served.captureConfig, mics: pairOf(served.captureConfig.mics) }
    const page = await created.load()
    await created.mount(page, '/devices')
    await screen.findByTestId('page-devices')
    return created
  }

  const card = (channel: 'AUDIO-01' | 'AUDIO-02' | 'AUDIO-03' | 'AUDIO-04') => screen.findByTestId(`audio-input-${channel}`)

  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
    HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
    HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
    Element.prototype.scrollTo ??= function scrollTo() {}
    window.scrollTo = (() => undefined) as typeof window.scrollTo
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
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  })
  afterEach(() => {
    cleanup()
    for (const sim of sims.splice(0)) sim.stop()
    bed?.dispose()
    bed = undefined
    vi.restoreAllMocks()
  })

  describe('the audio cards follow the selector\'s lines (D61: MIC-05 on channel 1, MIC-01 on channel 2)', () => {
    it('real capture: the AUDIO-01 card carries the badge and the "is on" mark of MIC-05, the AUDIO-02 card the badge of MIC-01', async () => {
      await liveDevices(true)
      const first = await card('AUDIO-01')
      const second = await card('AUDIO-02')
      expect(first).toHaveAttribute('data-mic-input', 'MIC-05')
      expect(second).toHaveAttribute('data-mic-input', 'MIC-01')
      // Channel 1: this Mac's microphone (LOCAL_DEVICE), and it is open.
      expect(await within(first).findByTestId('source-badge-AUDIO-01')).toHaveAttribute('data-adapter', 'LOCAL_DEVICE')
      expect(within(first).getByTestId('source-on-AUDIO-01')).toHaveTextContent(en.common.sourceClass.microphoneOn.web)
      expect(within(first).getByTestId('audio-line-input-AUDIO-01')).toHaveTextContent(en.common.sourceClass.kind.localMicrophone)
      // Channel 2: MIC-01, a generated source that is not this Mac's - and nothing says it is on.
      expect(within(second).getByTestId('source-badge-AUDIO-02')).toHaveAttribute('data-adapter', 'FAKE')
      expect(within(second).queryByTestId('source-on-AUDIO-02')).toBeNull()
      expect(within(second).getByTestId('audio-line-input-AUDIO-02')).toHaveTextContent(en.common.devices.mic1)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('CONTROL - the built-in pair: each card carries its own microphone\'s badge and names no other input', async () => {
      await liveDevices(false)
      const first = await card('AUDIO-01')
      const second = await card('AUDIO-02')
      expect(first).toHaveAttribute('data-mic-input', 'MIC-01')
      expect(second).toHaveAttribute('data-mic-input', 'MIC-02')
      expect(await within(first).findByTestId('source-badge-AUDIO-01')).toHaveAttribute('data-adapter', 'FAKE')
      expect(within(second).getByTestId('source-badge-AUDIO-02')).toHaveAttribute('data-adapter', 'FAKE')
      expect(within(first).queryByTestId('source-on-AUDIO-01')).toBeNull()
      expect(within(first).queryByTestId('audio-line-input-AUDIO-01')).toBeNull()
      expect(within(second).queryByTestId('audio-line-input-AUDIO-02')).toBeNull()
    })

    it('Simulated mode: the card names the line\'s input from the selector, with no development badge', async () => {
      const authStorage = createMemoryAuthStorage()
      authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
      const sim = createSim({ scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
      sims.push(sim)
      const state = sim.store.getState()
      sim.store.setState({ captureConfig: { ...state.captureConfig, mics: pairOf(state.captureConfig.mics) } })
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/devices'] }) })
      render(<RouterProvider router={router} />)
      const first = await card('AUDIO-01')
      expect(first).toHaveAttribute('data-mic-input', 'MIC-05') // D61: the added microphone is MIC-05
      expect(within(first).getByTestId('audio-line-input-AUDIO-01')).toHaveTextContent('MIC 5')
      expect(within(first).queryByTestId('source-badge-AUDIO-01')).toBeNull()
      expect(await card('AUDIO-02')).toHaveAttribute('data-mic-input', 'MIC-01')
    })

    // Task 4 row 168 (WP-13a; row 27 site W5; decision C18 (2)): the card finds its input by `meterInputOfChannel`.
    // The double is a hand-built selector slice (the simulator's store; the served slice of the fake Core).
    it.each([
      ['no microphone line', [] as readonly ('MIC-01' | 'MIC-02')[]],
      ['the channel 1 line alone', ['MIC-01'] as const],
      ['the channel 2 line alone', ['MIC-02'] as const],
    ])('task 4 row 168 (D61), Simulated mode with %s: the cards of the channels that name no line draw the empty state - "Not assigned", no input named, no peak', async (_name, channels) => {
      resetMissingI18nKeys()
      const authStorage = createMemoryAuthStorage()
      authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
      const sim = createSim({ scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
      sims.push(sim)
      const state = sim.store.getState()
      sim.store.setState({ captureConfig: { ...state.captureConfig, mics: state.captureConfig.mics.filter((line) => (channels as readonly string[]).includes(line.channel)) } })
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: ['/devices'] }) })
      render(<RouterProvider router={router} />)
      // D61: the channels the kept lines do not name draw the empty state (with no line kept, all four).
      const keptChannel = _name === 'the channel 1 line alone' ? 'AUDIO-01' : _name === 'the channel 2 line alone' ? 'AUDIO-02' : null
      for (const channel of (['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const).filter((id) => id !== keptChannel)) {
        const empty = await card(channel)
        expect(empty).toHaveAttribute('data-input-state', 'NOT_ASSIGNED')
        expect(empty).not.toHaveAttribute('data-mic-input')
        expect(within(empty).getByTestId(`audio-line-empty-${channel}`)).toHaveTextContent(en.common.captureSlot.notAssigned)
        expect(within(empty).queryByTestId(`audio-line-input-${channel}`)).toBeNull()
        expect(within(empty).queryByTestId(`source-badge-${channel}`)).toBeNull()
        // The meter and the peak state no level of a built-in input, although the slice still holds its frames.
        expect(within(empty).getByTestId('dbfs-meter')).toHaveAttribute('data-no-signal', 'true')
        expect(within(empty).getByTestId(`peak-${channel}`)).toHaveTextContent(/^\D*$/)
        expect(empty.querySelector('.dev-tile-sub')!.textContent ?? '').not.toMatch(/MIC-01|MIC-02/)
      }
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('task 4 row 168 (D61), real capture with the channel 2 line alone: a card names "Not assigned" where it named the input, and carries no mark of a microphone', async () => {
      const created = createLiveTestBed({ session: sessionOf(OPERATOR_IDS.ANDI) })
      bed = created
      const served = created.core.served
      served.captureDevices = { devices: served.captureDevices.devices.map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device) }
      served.captureConfig = { ...served.captureConfig, mics: served.captureConfig.mics.filter((line) => line.channel === 'MIC-02') }
      const page = await created.load()
      await created.mount(page, '/devices')
      await screen.findByTestId('page-devices')
      // D61: only channel 2 names a line — the other three cards are empty.
      for (const channel of ['AUDIO-01', 'AUDIO-03', 'AUDIO-04'] as const) {
        const empty = await card(channel)
        await waitFor(() => expect(empty).toHaveAttribute('data-input-state', 'NOT_ASSIGNED'))
        expect(empty).not.toHaveAttribute('data-mic-input')
        expect(within(empty).getByTestId(`audio-line-empty-${channel}`)).toHaveTextContent(en.common.captureSlot.notAssigned)
        expect(within(empty).queryByTestId(`source-badge-${channel}`)).toBeNull()
        expect(within(empty).queryByTestId(`source-on-${channel}`)).toBeNull()
        expect(empty.querySelector('.dev-tile-sub')!.textContent ?? '').not.toMatch(/MIC-01|MIC-02/)
      }
    })
  })
})

// Wave H, driver D: the two MINOR items of gate 70 on Devices & Inputs.
//
// | Item | What is pinned here | What only a browser can show |
// |------|---------------------|------------------------------|
// | G70-07: the audio card title was cut to "MIC 1 - Inter..." once the development badge was drawn | the title carries the wrapping class, and the badge is drawn on its own line OUTSIDE the header row (so it takes no width from the title) | that the full title is readable at the lane's card width (the computed layout) |
// | M4-PC-1: "Checking your permissions..." was never observed by the gate (the read answered within 200 ms) | the state renders while operation 77 is not answered: the sentence, no edit control; it goes when the read answers | - |
describe("the audio card title with the development badge; \"Checking your permissions...\" of the selector (G70-07, M4-PC-1)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 8_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 30_000 })

  type Device = SimState['captureDevices']['devices'][number]
  let bed: LiveTestBed | undefined

  // The seeded TECHNICIAN: since the 0034 revocation (2026-10-29) the only role holding CAPTURE_CONFIG.
  const RINA = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.RINA)!
  const technicianSession: Pick<AuthSessionInfo, 'operator' | 'permissions'> = {
    operator: { id: RINA.id, username: RINA.username, rank: RINA.rank, name: RINA.name, displayName: RINA.displayName, initials: RINA.initials, role: RINA.role },
    permissions: [...ROLE_PERMISSIONS[RINA.role]],
  }

  async function liveDevices(prepare?: (created: LiveTestBed) => void) {
    // The technician drives this row: the harness supervisor session — the getAuthSession example —
    // carries exactly the table's grants, and the table revoked the supervisor's CAPTURE_CONFIG.
    // The row proves the pending state of the selector, not its rights.
    const created = createLiveTestBed({ session: technicianSession })
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
})
