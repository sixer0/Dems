// Task 3 M5, blueprint row 72: the web mic UI of the Session Monitor (WB-01), the Dashboard mic
// tiles (WB-02) and the audio-source band (WB-10), in Simulated mode and as pure rules
// (masterplan/08_client_ux_spec.md §3 flow 2; masterplan/03_api_contract.md §2.4 operations 81, 82;
// masterplan/01_specs.md R-3; checks M5-WARN-1 client half and M4-PC-1 for G4/G5).
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | G4: Checking → allowed, or refused with its reason; the session holder or a SUPERVISOR only (OD-09) | "the gate", "who may switch" |
// | A switch is explicit and confirmed; one `AUDIO_SOURCE_SWITCHED` audit row; the pair on screen is the store's | "a confirmed switch" |
// | `MIC_SILENT` warns and offers; it never switches (OD-11) | "the silence warning" |
// | Refusals of operation 81 by class, never by text | "refusals" |
// | "Connecting cameras…" until the first durable fragment (D84, D91) | "before the first durable fragment" |
// | The band's layout from media-pts intervals | "the audio-source band" |
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  OperatorRole,
  SimNotFoundError,
  SimTransitionError,
  type ScenarioName,
  type Sim,
} from '@dems/shared/sim'
import { audioSourceBandSegments, formatMediaMs } from '@/components/composed'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { audioSourceToggleGate, isSessionHolder, sessionStartRoles, silentInputOf, switchRefusal } from '../audio-source'
import { captureDurableOf, selectBanner, selectFeed } from '../model'

vi.setConfig({ testTimeout: 30_000 })

const A = en.session.audioSource
const SWITCHED = 'AUDIO_SOURCE_SWITCHED'

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

function mount(operatorId: string, { scenario = 'recording', path = '/session', prepare }: { scenario?: ScenarioName; path?: string; prepare?: (sim: Sim) => void } = {}) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({ scenario, storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  prepare?.(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
  return sim
}

const switchRows = (sim: Sim) => sim.store.getState().audit.rows.filter((row) => row.type === SWITCHED)
const activeOf = (sim: Sim) => sim.store.getState().audio.activeInputId
const role = (inputId: string) => screen.getByTestId(`sm-audio-role-${inputId}`)
const panel = () => screen.findByTestId('panel-O', {}, { timeout: 15_000 })

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  Element.prototype.scrollTo ??= function scrollTo() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo
})

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})

beforeEach(() => {
  resetMissingI18nKeys()
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = vi.fn() as unknown as HTMLMediaElement['pause']
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })))
})

afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
  vi.unstubAllGlobals()
})

describe('the gate (G4, G5; ux §3.4)', () => {
  const allowed = { resolved: true, recording: true, canStart: true, holder: true }

  it('is Checking while the role or the link is unresolved, whatever else is true', () => {
    expect(audioSourceToggleGate({ ...allowed, resolved: false })).toEqual({ kind: 'CHECKING' })
    expect(audioSourceToggleGate({ resolved: false, recording: false, canStart: false, holder: false })).toEqual({ kind: 'CHECKING' })
  })

  it('then refuses with its reason: no recording, the role, the session holder; and allows only when all hold', () => {
    expect(audioSourceToggleGate({ ...allowed, recording: false })).toEqual({ kind: 'NOT_RECORDING' })
    expect(audioSourceToggleGate({ ...allowed, canStart: false })).toEqual({ kind: 'ROLE', roles: [OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR] })
    expect(audioSourceToggleGate({ ...allowed, holder: false })).toEqual({ kind: 'HOLDER' })
    expect(audioSourceToggleGate(allowed)).toBeNull()
  })

  it('names the roles that hold SESSION_START from the role table', () => {
    expect(sessionStartRoles()).toEqual([OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR])
  })

  it('OD-09: the holder is the operator who opened the session, or a SUPERVISOR', () => {
    expect(isSessionHolder({ operatorId: 'OPR-001', role: OperatorRole.INVESTIGATOR, createdBy: 'OPR-001' })).toBe(true)
    expect(isSessionHolder({ operatorId: 'OPR-009', role: OperatorRole.INVESTIGATOR, createdBy: 'OPR-001' })).toBe(false)
    expect(isSessionHolder({ operatorId: 'OPR-002', role: OperatorRole.SUPERVISOR, createdBy: 'OPR-001' })).toBe(true)
    expect(isSessionHolder({ operatorId: 'OPR-003', role: OperatorRole.TECHNICIAN, createdBy: 'OPR-001' })).toBe(false)
    expect(isSessionHolder({ operatorId: null, role: null, createdBy: null })).toBe(false)
  })
})

describe('refusals of operation 81 (ux §3.5)', () => {
  it('are classed by code and status, never by text', () => {
    expect(switchRefusal({ code: 'AUDIO_SOURCE_CONFLICT', status: 409 })).toBe('CONFLICT')
    expect(switchRefusal({ code: 'INVALID_STATE', status: 409 })).toBe('NOT_RECORDING')
    expect(switchRefusal({ code: 'NOT_FOUND', status: 404 })).toBe('NOT_OPEN')
    expect(switchRefusal(new SimTransitionError('ARMED', 'switchAudioSource'))).toBe('NOT_RECORDING')
    expect(switchRefusal(new SimNotFoundError('captureMic', 'MIC-02'))).toBe('NOT_OPEN')
    expect(switchRefusal(new Error('AUDIO_SOURCE_CONFLICT in the text only'))).toBe('OTHER')
    expect(switchRefusal(null)).toBe('OTHER')
  })
})

describe('the silence warning: which input it names', () => {
  it('reads the channel or the input of the fault, and falls back to the active input', () => {
    const fault = (target: string | null) => [{ kind: 'MIC_SILENT' as const, since: 1, target }]
    expect(silentInputOf([], 'MIC-01')).toBeNull()
    expect(silentInputOf(fault('AUDIO-02'), 'MIC-01')).toBe('MIC-02')
    expect(silentInputOf(fault('MIC-01'), 'MIC-02')).toBe('MIC-01')
    expect(silentInputOf(fault(null), 'MIC-02')).toBe('MIC-02')
    expect(silentInputOf([{ kind: 'CAMERA_LOST' as never, since: 1, target: 'VIDEO-01' }], 'MIC-01')).toBeNull()
  })
})

describe('the audio-source band (WB-10)', () => {
  it('lays the intervals out oldest first by their share of the media time; the open one runs to the end', () => {
    const segments = audioSourceBandSegments(
      [
        { seq: 1, inputId: 'MIC-02', fromMs: 6_000, toMs: null },
        { seq: 0, inputId: 'MIC-01', fromMs: 0, toMs: 6_000 },
      ],
      10_000,
    )
    expect(segments.map((segment) => [segment.seq, segment.inputId, segment.open])).toEqual([
      [0, 'MIC-01', false],
      [1, 'MIC-02', true],
    ])
    expect(segments.map((segment) => segment.fraction)).toEqual([0.6, 0.4])
    expect(segments[1]!.toMs).toBe(10_000)
  })

  it('never draws a negative width for a late end, and gives the newest interval the band while nothing has elapsed', () => {
    const late = audioSourceBandSegments(
      [
        { seq: 0, inputId: 'MIC-01', fromMs: 0, toMs: 6_000 },
        { seq: 1, inputId: 'MIC-02', fromMs: 6_000, toMs: null },
      ],
      2_000,
    )
    expect(late.map((segment) => segment.fraction)).toEqual([1, 0])
    expect(audioSourceBandSegments([{ seq: 0, inputId: 'MIC-01', fromMs: 0, toMs: null }], 0).map((segment) => segment.fraction)).toEqual([1])
    expect(audioSourceBandSegments([], 10_000)).toEqual([])
  })

  it('writes media time as m:ss, or h:mm:ss from one hour', () => {
    expect(formatMediaMs(5_303)).toBe('0:05')
    expect(formatMediaMs(125_000)).toBe('2:05')
    expect(formatMediaMs(3_725_000)).toBe('1:02:05')
  })
})

describe('before the first durable fragment (D84, D91)', () => {
  it('reads the session member through one helper: only an explicit false is "not durable yet"', () => {
    expect(captureDurableOf({ captureDurable: false })).toBe(false)
    expect(captureDurableOf({ captureDurable: true })).toBe(true)
    expect(captureDurableOf({})).toBe(true)
    expect(captureDurableOf(null)).toBe(true)
  })

  it('the Session Monitor reads "Connecting cameras…": no "Recording in progress", no recording timer; "Recording" returns with the member', async () => {
    const sim = mount(OPERATOR_IDS.BUDI, {
      prepare: (created) => {
        const session = created.store.getState().session!
        created.store.setState({ session: { ...session, captureDurable: false } as typeof session })
      },
    })
    await panel()
    const banner = screen.getByTestId('sm-status-banner')
    expect(banner).toHaveAttribute('data-kind', 'CONNECTING')
    expect(banner).toHaveTextContent(A.connecting.detail)
    expect(banner).not.toHaveTextContent(en.session.banner.ACTIVE.detail)
    expect(selectBanner(sim.store.getState()).kind).toBe('CONNECTING')
    expect(selectFeed(sim.store.getState()).recording).toBe(false)

    await act(async () => {
      const session = sim.store.getState().session!
      sim.store.setState({ session: { ...session, captureDurable: true } as typeof session })
    })
    await waitFor(() => expect(screen.getByTestId('sm-status-banner')).toHaveAttribute('data-kind', 'ACTIVE'))
    expect(selectFeed(sim.store.getState()).recording).toBe(true)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('a confirmed switch (ux §3.2 steps 1-4; operation 81)', () => {
  it('the session holder sees the active and the standby input, confirms, and the Core writes exactly one audit row; the pair on screen is the store\'s', async () => {
    const sim = mount(OPERATOR_IDS.BUDI)
    const audio = await panel()
    expect(activeOf(sim)).toBe('MIC-01')
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
    expect(role('MIC-01')).toHaveTextContent(A.role.ACTIVE)
    expect(role('MIC-02')).toHaveAttribute('data-role', 'STANDBY')
    // Allowed: no reason line, the toggle names the standby input.
    const toggle = within(audio).getByTestId('sm-audio-switch')
    expect(toggle).not.toBeDisabled()
    expect(toggle).toHaveTextContent('Switch to MIC 2')
    expect(within(audio).queryByTestId('sm-audio-switch-reason')).not.toBeInTheDocument()
    expect(within(audio).getByTestId('audio-source-band')).toHaveAttribute('data-segments', '1')

    // The press only asks: nothing is sent, nothing is flipped.
    fireEvent.click(toggle)
    const dialog = await screen.findByTestId('sm-audio-switch-dialog')
    expect(dialog).toHaveTextContent('Switch the active microphone to MIC 2?')
    expect(switchRows(sim)).toHaveLength(0)
    expect(activeOf(sim)).toBe('MIC-01')
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')

    fireEvent.click(within(dialog).getByTestId('sm-audio-switch-confirm'))
    await waitFor(() => expect(role('MIC-02')).toHaveAttribute('data-role', 'ACTIVE'))
    expect(role('MIC-01')).toHaveAttribute('data-role', 'STANDBY')
    expect(activeOf(sim)).toBe('MIC-02')
    const rows = switchRows(sim)
    expect(rows).toHaveLength(1)
    // Fix pass F-M5 (review R74-05): the keys of contract C3 §5.2 (it pinned the simulator's own `fromInputId` / `toInputId` / `deviceId`).
    expect(rows[0]).toMatchObject({ actorId: OPERATOR_IDS.BUDI, details: { fromInput: 'MIC-01', toInput: 'MIC-02' } })
    // The toggle now names the other input; the band has the interval the switch opened; the timeline names both inputs.
    await waitFor(() => expect(within(audio).getByTestId('sm-audio-switch')).toHaveTextContent('Switch to MIC 1'))
    await waitFor(() => expect(within(audio).getByTestId('audio-source-band')).toHaveAttribute('data-segments', '2'))
    // Pass D6 (item 9, D159): intervals are numbered from 1 (the manifest's rule; the simulator counted from 0).
    // The segment's test id is its `seq`: 1 = the interval of the start, 2 = the interval the switch opened.
    expect(within(audio).getByTestId('audio-source-band-segment-1')).toHaveAttribute('data-input', 'MIC-01')
    expect(within(audio).getByTestId('audio-source-band-segment-2')).toHaveAttribute('data-input', 'MIC-02')
    const item = document.querySelector('[data-kind="AUDIO_SWITCH"]')
    expect(item).toHaveTextContent(en.session.timeline.kind.AUDIO_SWITCH)
    expect(item).toHaveTextContent('MIC 1 to MIC 2')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('cancelling the confirmation sends nothing', async () => {
    const sim = mount(OPERATOR_IDS.BUDI)
    const audio = await panel()
    fireEvent.click(within(audio).getByTestId('sm-audio-switch'))
    const dialog = await screen.findByTestId('sm-audio-switch-dialog')
    fireEvent.click(within(dialog).getByTestId('sm-audio-switch-cancel'))
    await waitFor(() => expect(screen.queryByTestId('sm-audio-switch-dialog')).not.toBeInTheDocument())
    expect(switchRows(sim)).toHaveLength(0)
    expect(activeOf(sim)).toBe('MIC-01')
  })
})

describe('who may switch (OD-09; G4)', () => {
  it('a SUPERVISOR who did not open the session may', async () => {
    const sim = mount(OPERATOR_IDS.ANDI)
    const audio = await panel()
    expect(sim.store.getState().session!.createdBy).toBe(OPERATOR_IDS.BUDI)
    expect(within(audio).getByTestId('sm-audio-switch')).not.toBeDisabled()
    expect(within(audio).queryByTestId('sm-audio-switch-reason')).not.toBeInTheDocument()
  })

  it('a TECHNICIAN sees the toggle disabled with the roles that may; a press sends nothing', async () => {
    const sim = mount(OPERATOR_IDS.RINA)
    const audio = await panel()
    const toggle = within(audio).getByTestId('sm-audio-switch')
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('data-block', 'ROLE')
    expect(within(audio).getByTestId('sm-audio-switch-reason')).toHaveTextContent('Requires the INVESTIGATOR or SUPERVISOR role')
    fireEvent.click(toggle)
    expect(screen.queryByTestId('sm-audio-switch-dialog')).not.toBeInTheDocument()
    expect(switchRows(sim)).toHaveLength(0)
    // The pair is still shown to every role.
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
  })

  it('an INVESTIGATOR who did not open the session sees it disabled with the holder sentence', async () => {
    const sim = mount(OPERATOR_IDS.BUDI, {
      prepare: (created) => {
        const session = created.store.getState().session!
        created.store.setState({ session: { ...session, createdBy: 'OPR-009' } })
      },
    })
    const audio = await panel()
    const toggle = within(audio).getByTestId('sm-audio-switch')
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('data-block', 'HOLDER')
    expect(within(audio).getByTestId('sm-audio-switch-reason')).toHaveTextContent(A.block.HOLDER)
    fireEvent.click(toggle)
    expect(screen.queryByTestId('sm-audio-switch-dialog')).not.toBeInTheDocument()
    expect(switchRows(sim)).toHaveLength(0)
  })

  it('without a recording the toggle is not drawn and its reason is', async () => {
    mount(OPERATOR_IDS.BUDI, { scenario: 'idle' })
    const audio = await panel()
    expect(within(audio).queryByTestId('sm-audio-switch')).not.toBeInTheDocument()
    const reason = within(audio).getByTestId('sm-audio-switch-reason')
    expect(reason).toHaveAttribute('data-block', 'NOT_RECORDING')
    expect(reason).toHaveTextContent(A.block.NOT_RECORDING)
  })
})

describe('the silence warning (OD-11; M5-WARN-1, client half)', () => {
  it('warns, names the input, offers the switch and never makes it: the active input and the audit log do not change', async () => {
    const sim = mount(OPERATOR_IDS.BUDI)
    const audio = await panel()
    expect(within(audio).queryByTestId('sm-audio-silent')).not.toBeInTheDocument()

    await act(async () => {
      sim.actions.inject('MIC_SILENT')
    })
    const warning = await within(audio).findByTestId('sm-audio-silent')
    expect(warning).toHaveAttribute('data-input', 'MIC-01')
    expect(warning).toHaveTextContent('MIC 1 is silent')
    expect(warning).toHaveTextContent('never switched automatically')
    // Time passes with the warning up: still nothing switched.
    await act(async () => {
      sim.tick?.()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(activeOf(sim)).toBe('MIC-01')
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
    expect(switchRows(sim)).toHaveLength(0)

    // G5: the offered action only opens the same confirmation.
    fireEvent.click(within(warning).getByTestId('sm-audio-silent-switch'))
    const dialog = await screen.findByTestId('sm-audio-switch-dialog')
    expect(switchRows(sim)).toHaveLength(0)
    fireEvent.click(within(dialog).getByTestId('sm-audio-switch-confirm'))
    await waitFor(() => expect(role('MIC-02')).toHaveAttribute('data-role', 'ACTIVE'))
    expect(switchRows(sim)).toHaveLength(1)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('G5 follows the same gate: a TECHNICIAN sees the offer disabled with its reason', async () => {
    const sim = mount(OPERATOR_IDS.RINA, { prepare: (created) => created.actions.inject('MIC_SILENT') })
    const audio = await panel()
    const warning = await within(audio).findByTestId('sm-audio-silent')
    expect(within(warning).getByTestId('sm-audio-silent-switch')).toBeDisabled()
    expect(within(warning).getByTestId('sm-audio-silent-reason')).toHaveAttribute('data-block', 'ROLE')
    expect(switchRows(sim)).toHaveLength(0)
  })
})

describe('the Dashboard mic tiles (WB-02)', () => {
  it('say Active and Standby from the session\'s pair while a session records', async () => {
    const sim = mount(OPERATOR_IDS.BUDI, { path: '/' })
    const active = await screen.findByTestId('device-tile-source-AUDIO-01', {}, { timeout: 15_000 })
    expect(active).toHaveAttribute('data-source', 'ACTIVE')
    expect(screen.getByTestId('device-tile-source-AUDIO-02')).toHaveAttribute('data-source', 'STANDBY')
    await act(async () => {
      sim.actions.switchAudioSource('MIC-02')
    })
    await waitFor(() => expect(screen.getByTestId('device-tile-source-AUDIO-02')).toHaveAttribute('data-source', 'ACTIVE'))
    expect(screen.getByTestId('device-tile-source-AUDIO-01')).toHaveAttribute('data-source', 'STANDBY')
  })
})

// Integration pass D5 (ruling D137): the input behind a meter channel is the microphone line at its
// position in the capture configuration, not the fixed table of the built-in pair.
describe('a replaced pair, MIC-03 / MIC-01 (ruling D137)', () => {
  it('the second meter reads the second line (MIC-01), and the Active / Standby chips name MIC-03 and MIC-01', async () => {
    mount(OPERATOR_IDS.BUDI, {
      prepare: (sim) => {
        const state = sim.store.getState()
        const pair = ['MIC-03', 'MIC-01']
        const lines = state.captureConfig.mics.slice(0, 2).map((line, index) => ({ ...line, inputId: pair[index]! }))
        const frame = state.audio.inputs['MIC-01']!
        sim.store.setState({
          captureConfig: { ...state.captureConfig, mics: lines },
          session: state.session === null ? null : { ...state.session, captureConfig: state.session.captureConfig ? { ...state.session.captureConfig, mics: lines } : state.session.captureConfig, audioSource: { ...state.session.audioSource, activeInputId: 'MIC-03', standbyInputId: 'MIC-01' } },
          audio: {
            ...state.audio,
            activeInputId: 'MIC-03',
            inputs: {
              ...state.audio.inputs,
              'MIC-03': { ...frame, dbfs: -20, peak: -18, noSignal: false, clip: false },
              'MIC-01': { ...frame, dbfs: -30, peak: -28, noSignal: false, clip: false },
              // NEGATIVE CONTROL: the fixed table would read this frame for channel 2.
              'MIC-02': { ...frame, dbfs: -120, peak: -120, noSignal: true, clip: false },
            },
          },
        } as never)
      },
    })
    const audio = await panel()
    expect(role('MIC-03')).toHaveAttribute('data-role', 'ACTIVE')
    expect(role('MIC-01')).toHaveAttribute('data-role', 'STANDBY')
    expect(screen.queryByTestId('sm-audio-role-MIC-02')).not.toBeInTheDocument()
    expect(audio.querySelector('[data-channel="AUDIO-01"].sm-audio-half')).toHaveAttribute('data-source', 'ACTIVE')
    expect(audio.querySelector('[data-channel="AUDIO-02"].sm-audio-half')).toHaveAttribute('data-source', 'STANDBY')
    const second = audio.querySelector('[data-testid="dbfs-meter"][data-channel="AUDIO-02"]')
    expect(second).not.toBeNull()
    expect(second).not.toHaveAttribute('data-no-signal')
    expect(second?.querySelector('[role="meter"]')).toHaveAttribute('aria-valuenow', '-30')
    // A silence warning that names channel 2 is about the second line.
    expect(silentInputOf([{ kind: 'MIC_SILENT', target: 'AUDIO-02' }] as never, 'MIC-03', [{ inputId: 'MIC-03' }, { inputId: 'MIC-01' }])).toBe('MIC-01')
    expect(silentInputOf([{ kind: 'MIC_SILENT', target: 'AUDIO-02' }] as never, 'MIC-01')).toBe('MIC-02')
  })
})
