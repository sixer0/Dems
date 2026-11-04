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
  type SimState,
} from '@dems/shared/sim'
import { audioSourceBandSegments, formatMediaMs } from '@/components/composed'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { audioSourceToggleGate, isSessionHolder, selectActiveInputId, selectStandbyInputId, sessionStartRoles, silentInputOf, switchRefusal } from '../audio-source'
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

/**
 * The microphone lines of the seeded selector, as far as the lookups by CHANNEL read them.
 * D61 (2026-11-04): four simultaneous channels MIC-01..MIC-04 — the PRIMARY / STANDBY roles are
 * gone from the selector plane; every line states the channel it feeds.
 */
const SEEDED_LINES = [
  { inputId: 'MIC-01', channel: 'MIC-01' },
  { inputId: 'MIC-02', channel: 'MIC-02' },
  { inputId: 'MIC-03', channel: 'MIC-03' },
  { inputId: 'MIC-04', channel: 'MIC-04' },
] as const

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
    // Task 4 row 168: the lines are given (the seeded selector). D61 (2026-11-04): a channel is a line of the four-channel selector, never a built-in input.
    expect(silentInputOf([], 'MIC-01', SEEDED_LINES)).toBeNull()
    expect(silentInputOf(fault('AUDIO-02'), 'MIC-01', SEEDED_LINES)).toBe('MIC-02')
    // D61: the warning may name any of the four meter channels; each answers its line's input.
    expect(silentInputOf(fault('AUDIO-03'), 'MIC-01', SEEDED_LINES)).toBe('MIC-03')
    expect(silentInputOf(fault('AUDIO-04'), 'MIC-01', SEEDED_LINES)).toBe('MIC-04')
    expect(silentInputOf(fault('MIC-01'), 'MIC-02', SEEDED_LINES)).toBe('MIC-01')
    expect(silentInputOf(fault(null), 'MIC-02', SEEDED_LINES)).toBe('MIC-02')
    expect(silentInputOf([{ kind: 'CAMERA_LOST' as never, since: 1, target: 'VIDEO-01' }], 'MIC-01', SEEDED_LINES)).toBeNull()
  })

  it('task 4 row 168 (D61): a channel without its line names no input, and a fault without a target names none when no input is active', () => {
    const fault = (target: string | null) => [{ kind: 'MIC_SILENT' as const, since: 1, target }]
    // D61 (2026-11-04): each channel has an input exactly when a line NAMES it (the complete-pair rule of D137 is superseded).
    // A fault on a channel no held line names answers null - never the active input, never the built-in table.
    for (const lines of [[], [SEEDED_LINES[0]], [SEEDED_LINES[1]], [SEEDED_LINES[0], SEEDED_LINES[1]]]) {
      expect(silentInputOf(fault('AUDIO-03'), null, lines)).toBeNull()
      expect(silentInputOf(fault('AUDIO-04'), 'MIC-01', lines)).toBeNull()
    }
    // The line alone answers its own channel.
    expect(silentInputOf(fault('AUDIO-01'), null, [SEEDED_LINES[0]])).toBe('MIC-01')
    expect(silentInputOf(fault(null), null, [])).toBeNull()
    // The input the Core names itself is still the answer, whatever its number (D61: MIC-03 / MIC-04 record too).
    expect(silentInputOf(fault('MIC-03'), null, [])).toBe('MIC-03')
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
    // D61 (2026-11-04): all four channels record; an input outside the transcription pair (channel 3 or 4) carries no chip.
    expect(screen.queryByTestId('sm-audio-role-MIC-03')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sm-audio-role-MIC-04')).not.toBeInTheDocument()
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
  it('say Active and Standby from the session\'s transcription pair while a session records; D61: the tiles of channels 3 and 4 record without a pair word', async () => {
    const sim = mount(OPERATOR_IDS.BUDI, { path: '/' })
    const active = await screen.findByTestId('device-tile-source-AUDIO-01', {}, { timeout: 15_000 })
    expect(active).toHaveAttribute('data-source', 'ACTIVE')
    expect(screen.getByTestId('device-tile-source-AUDIO-02')).toHaveAttribute('data-source', 'STANDBY')
    // D61 (2026-11-04): four simultaneous channels - the third and fourth tiles name their channel, never ACTIVE / STANDBY.
    expect(screen.queryByTestId('device-tile-source-AUDIO-03')).not.toBeInTheDocument()
    expect(screen.getByTestId('device-tile-channel-AUDIO-03')).toHaveAttribute('data-channel', 'MIC-03')
    expect(screen.getByTestId('device-tile-channel-AUDIO-04')).toHaveAttribute('data-channel', 'MIC-04')
    await act(async () => {
      sim.actions.switchAudioSource('MIC-02')
    })
    await waitFor(() => expect(screen.getByTestId('device-tile-source-AUDIO-02')).toHaveAttribute('data-source', 'ACTIVE'))
    expect(screen.getByTestId('device-tile-source-AUDIO-01')).toHaveAttribute('data-source', 'STANDBY')
    // D61: the switch moves the transcription pair alone - channels 3 and 4 keep their channel chips.
    expect(screen.queryByTestId('device-tile-source-AUDIO-03')).not.toBeInTheDocument()
  })
})

// Integration pass D5 (ruling D137): the input behind a meter channel is the microphone line at its
// position in the capture configuration, not the fixed table of the built-in pair.
// D61 (2026-11-04): the rule survives on the transcription pair; the selector now holds FOUR lines, so the
// replacement permutes all of them - no input appears on two lines and channels 3 / 4 name their own inputs.
describe('a replaced transcription pair, MIC-03 / MIC-01 (ruling D137, kept by D61)', () => {
  it('the second meter reads the second line (MIC-01), and the Active / Standby chips name MIC-03 and MIC-01', async () => {
    mount(OPERATOR_IDS.BUDI, {
      prepare: (sim) => {
        const state = sim.store.getState()
        // D61: the four lines keep their channels; the inputs are permuted (pair swapped, channels 3/4 moved off the table's ids).
        const permuted = ['MIC-03', 'MIC-01', 'MIC-04', 'MIC-02']
        const lines = state.captureConfig.mics.map((line, index) => ({ ...line, inputId: permuted[index] ?? line.inputId }))
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
    // D61 (2026-11-04): the inputs of channels 3 / 4 record beside the pair and carry no chip.
    expect(screen.queryByTestId('sm-audio-role-MIC-04')).not.toBeInTheDocument()
    expect(audio.querySelector('[data-channel="AUDIO-01"].sm-audio-half')).toHaveAttribute('data-source', 'ACTIVE')
    expect(audio.querySelector('[data-channel="AUDIO-02"].sm-audio-half')).toHaveAttribute('data-source', 'STANDBY')
    const second = audio.querySelector('[data-testid="dbfs-meter"][data-channel="AUDIO-02"]')
    expect(second).not.toBeNull()
    expect(second).not.toHaveAttribute('data-no-signal')
    expect(second?.querySelector('[role="meter"]')).toHaveAttribute('aria-valuenow', '-30')
    // A silence warning that names channel 2 is about the second line (D61: the line states its channel).
    expect(silentInputOf([{ kind: 'MIC_SILENT', target: 'AUDIO-02' }] as never, 'MIC-03', [{ inputId: 'MIC-03', channel: 'MIC-01' }, { inputId: 'MIC-01', channel: 'MIC-02' }])).toBe('MIC-01')
    expect(silentInputOf([{ kind: 'MIC_SILENT', target: 'AUDIO-02' }] as never, 'MIC-01', SEEDED_LINES)).toBe('MIC-02')
  })
})

// Task 4 row 168 (WP-13a; row 27 sites W4, W6; decisions C18 (2), C21 (6), (7); D61 of 2026-11-04 renumbers the plane). The double is a hand-built
// selector slice in the simulator's store: a session that records on a selector WITHOUT the line of a channel states no input for that channel
// (possible in Simulated mode only, C21 (6)); without the line of channel 2 it states no transcription standby (names register 5.3).
//
// | Rule | Case |
// |------|------|
// | The audio panel: a meter channel without its line is neither ACTIVE nor STANDBY, has no role chip and no source mark, and its meter draws no level | "the audio panel" |
// | The audio source: with no channel-1 line no input is active; with no channel-2 line there is no standby - no built-in input stands in | "the audio panel", "the pair (pure)" |
// | Without a standby the toggle is not drawn and the footer says why | "the audio panel" |
// | CONTROL: the seeded four-channel selector reads as before; channels 3 / 4 record without a pair word | "the audio panel" (last blocks), every case above this describe |
describe('task 4 row 168 (D61): the audio panel and the audio source when a channel line is absent', () => {
  // D61 (2026-11-04): the selector plane is keyed by CHANNEL - the roles are gone.
  type Channel = 'MIC-01' | 'MIC-02' | 'MIC-03' | 'MIC-04'
  const ALL_CHANNELS: readonly Channel[] = ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']
  /** A recording session whose selector (stored and snapshot) holds only the microphone lines of `channels`, and which states no pair. */
  const recordingWith = (channels: readonly Channel[]) => (sim: Sim) => {
    const state = sim.store.getState()
    const mics = state.captureConfig.mics.filter((line) => channels.includes(line.channel as Channel))
    sim.store.setState({
      captureConfig: { ...state.captureConfig, mics },
      session: state.session === null ? null : { ...state.session, captureConfig: state.session.captureConfig ? { ...state.session.captureConfig, mics } : state.session.captureConfig, audioSource: null },
    } as never)
  }
  /** The meter channel of a selector channel (D61: `MIC-0N` feeds `AUDIO-0N`). */
  const trackOf = (channel: Channel) => `AUDIO-${channel.slice(-2)}`

  it.each([
    // D61: each channel has an input exactly when a line NAMES it - the complete-pair rule of D137 is superseded, so every case holds its other lines.
    ['no microphone line', [] as readonly Channel[], null],
    ['channel 2 alone', ['MIC-02'] as readonly Channel[], null],
    ['channels 3 and 4 alone (no transcription channel)', ['MIC-03', 'MIC-04'] as readonly Channel[], null],
    ['every channel but 1', ['MIC-02', 'MIC-03', 'MIC-04'] as readonly Channel[], null],
  ])('the audio panel with %s: no channel names an active input, no built-in input is named, and there is no toggle', async (_name, channels, active) => {
    mount(OPERATOR_IDS.BUDI, { prepare: recordingWith(channels) })
    const audio = await panel()
    for (const channel of ALL_CHANNELS) {
      const half = audio.querySelector(`[data-channel="${trackOf(channel)}"].sm-audio-half`)!
      // A held line gives its own channel an input (D61); an absent line leaves the half empty.
      if (channels.includes(channel)) {
        expect(half).not.toHaveAttribute('data-no-input')
        // D61: without an active input no half carries a pair word.
        expect(half).not.toHaveAttribute('data-source')
      } else {
        expect(half).toHaveAttribute('data-no-input', 'true')
        expect(half).not.toHaveAttribute('data-source')
        // The meter of a channel without an input draws no level, although the slice still holds frames of the built-in inputs.
        const meter = half.querySelector('[data-testid="dbfs-meter"]')!
        expect(meter).toHaveAttribute('data-no-signal', 'true')
      }
    }
    expect(audio.querySelector('[data-testid^="sm-audio-role-"]')).toBeNull()
    const body = audio.querySelector('.sm-audio-body')!
    if (active === null) expect(body).not.toHaveAttribute('data-active-input')
    else expect(body).toHaveAttribute('data-active-input', active)
    // No standby: nothing to switch to. The toggle is not drawn and the footer says why.
    expect(screen.queryByTestId('sm-audio-switch')).not.toBeInTheDocument()
    const reason = within(audio).getByTestId('sm-audio-switch-reason')
    expect(reason).toHaveAttribute('data-block', 'NO_STANDBY')
    // D61 (2026-11-04): the missing standby is the SECOND CHANNEL - the sentence names Microphone 2.
    expect(reason).toHaveTextContent(en.common.captureNotice.start.sourceNotAssigned.replace('{{slot}}', en.common.captureSlot['MIC-02']))
    expect(audio.textContent ?? '').not.toMatch(/MIC-01|MIC-02/)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the audio panel with the channel-1 line alone: the half is ACTIVE, there is no standby and the footer says why (D61)', async () => {
    mount(OPERATOR_IDS.BUDI, { prepare: recordingWith(['MIC-01']) })
    const audio = await panel()
    const first = audio.querySelector('[data-channel="AUDIO-01"].sm-audio-half')!
    expect(first).not.toHaveAttribute('data-no-input')
    expect(first).toHaveAttribute('data-source', 'ACTIVE')
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
    for (const channel of ALL_CHANNELS.slice(1)) {
      expect(audio.querySelector(`[data-channel="${trackOf(channel)}"].sm-audio-half`)).toHaveAttribute('data-no-input', 'true')
    }
    expect(audio.querySelector('.sm-audio-body')).toHaveAttribute('data-active-input', 'MIC-01')
    expect(screen.queryByTestId('sm-audio-switch')).not.toBeInTheDocument()
    const reason = within(audio).getByTestId('sm-audio-switch-reason')
    expect(reason).toHaveAttribute('data-block', 'NO_STANDBY')
    expect(reason).toHaveTextContent(en.common.captureNotice.start.sourceNotAssigned.replace('{{slot}}', en.common.captureSlot['MIC-02']))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL - the seeded four-channel selector on a session that states none yet: the pair reads as before and channels 3 / 4 record without a pair word', async () => {
    mount(OPERATOR_IDS.BUDI, { prepare: recordingWith(ALL_CHANNELS) })
    const audio = await panel()
    expect(audio.querySelector('[data-channel="AUDIO-01"].sm-audio-half')).toHaveAttribute('data-source', 'ACTIVE')
    expect(audio.querySelector('[data-channel="AUDIO-02"].sm-audio-half')).toHaveAttribute('data-source', 'STANDBY')
    // D61 (2026-11-04): the third and fourth halves have their input - they record - but belong to no pair.
    for (const channel of ['MIC-03', 'MIC-04'] as const) {
      const half = audio.querySelector(`[data-channel="${trackOf(channel)}"].sm-audio-half`)!
      expect(half).not.toHaveAttribute('data-no-input')
      expect(half).not.toHaveAttribute('data-source')
    }
    expect(audio.querySelector('[data-no-input]')).toBeNull()
    expect(role('MIC-01')).toHaveAttribute('data-role', 'ACTIVE')
    expect(role('MIC-02')).toHaveAttribute('data-role', 'STANDBY')
    expect(screen.queryByTestId('sm-audio-role-MIC-03')).not.toBeInTheDocument()
    expect(screen.getByTestId('sm-audio-switch')).toBeEnabled()
    expect(within(audio).queryByTestId('sm-audio-switch-reason')).not.toBeInTheDocument()
  })

  it('the pair (pure): by channel, with `null` for an absent input - never the meters\' stale member, never the built-in pair', () => {
    // D61 (2026-11-04): the lines state their CHANNEL; the transcription pair is the lines of channels MIC-01 and MIC-02.
    const lines = [
      { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-01' },
      { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' },
    ]
    const state = (over: Record<string, unknown>): SimState => ({ session: null, audio: { activeInputId: 'MIC-01' }, captureConfig: { cameras: [], mics: [] }, ...over }) as unknown as SimState
    const selector = (mics: readonly unknown[]) => ({ captureConfig: { cameras: [], mics } })
    // No session: the selector's lines by channel.
    expect([selectActiveInputId(state(selector([]))), selectStandbyInputId(state(selector([])))]).toEqual([null, null])
    expect([selectActiveInputId(state(selector([lines[0]]))), selectStandbyInputId(state(selector([lines[0]])))]).toEqual(['MIC-01', null])
    // A lone channel-2 line is never the active input - also when the meters' member still names it.
    expect([selectActiveInputId(state({ ...selector([lines[1]]), audio: { activeInputId: 'MIC-02' } })), selectStandbyInputId(state(selector([lines[1]])))]).toEqual([null, 'MIC-02'])
    // An open session that states no pair yet: the meters' member, only when the selector in force holds it; the standby is the other line.
    const open = (mics: readonly unknown[], activeInputId: string) => state({ session: { state: 'RECORDING', audioSource: null, captureConfig: { cameras: [], mics } }, audio: { activeInputId } })
    expect([selectActiveInputId(open(lines, 'MIC-02')), selectStandbyInputId(open(lines, 'MIC-02'))]).toEqual(['MIC-02', 'MIC-01'])
    expect([selectActiveInputId(open([], 'MIC-01')), selectStandbyInputId(open([], 'MIC-01'))]).toEqual([null, null])
    expect([selectActiveInputId(open([lines[1]], 'MIC-01')), selectStandbyInputId(open([lines[1]], 'MIC-01'))]).toEqual([null, null])
    expect([selectActiveInputId(open([lines[0]], 'MIC-01')), selectStandbyInputId(open([lines[0]], 'MIC-01'))]).toEqual(['MIC-01', null])
    // D61 (2026-11-04): a session recording on the FULL four-channel selector whose meters name channel 3: the member is active and the standby is the first other line.
    expect([selectActiveInputId(open(SEEDED_LINES, 'MIC-03')), selectStandbyInputId(open(SEEDED_LINES, 'MIC-03'))]).toEqual(['MIC-03', 'MIC-01'])
  })
})
