// Task 3 M5, blueprint row 72: the web mic UI of the Session Monitor (WB-01), the Dashboard mic
// tiles (WB-02) and the audio-source band (WB-10), in Simulated mode and as pure rules
// (masterplan/08_client_ux_spec.md §3 flow 2; masterplan/03_api_contract.md §2.4 operations 81, 82;
// masterplan/01_specs.md R-3; checks M5-WARN-1 client half and M4-PC-1 for G4/G5).
//
// Audit row 157 (D5, S5 §6; AC-4.6 UI; D4, D30, D130): operation 81 is retired - the microphones are fixed by the
// camera-microphone pairing. The switch tests of row 72 (gate, confirmed switch, who may switch, refusal classes,
// the silence warning's offer) are REPLACED by the cases below: the control is gone and each half carries its pair label.
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | No switch control for any role or state; the simulator refuses op 81 and writes nothing | "row 157: no switch control" |
// | Each half reads "Mic N (Camera N)"; Pair 1 alone says "Transcribed"; the old role / channel chips are gone | "row 157: the pair labels" |
// | `MIC_SILENT` warns and names the input; it offers nothing and changes nothing (OD-11) | "the silence warning" |
// | "Connecting cameras…" until the first durable fragment (D84, D91) | "before the first durable fragment" |
// | The band's layout from media-pts intervals | "the audio-source band" |
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
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
  type ScenarioName,
  type Sim,
  type SimState,
} from '@dems/shared/sim'
import { audioSourceBandSegments, formatMediaMs } from '@/components/composed'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import { selectActiveInputId, selectStandbyInputId, silentInputOf } from '../audio-source'
import { captureDurableOf, selectBanner, selectFeed } from '../model'

vi.setConfig({ testTimeout: 30_000 })

const A = en.session.audioSource
const SWITCHED = 'AUDIO_SOURCE_SWITCHED'
const PAIRS = en.devices.pairs
/** Row 156 `micPairLabel` words: "Mic N (Camera N)". */
const pairWords = (n: number) => PAIRS.micOfCamera.replaceAll('{{n}}', String(n))
const TRACKS = ['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const
/** Row 157: none of the retired switch surfaces is in the panel or on the page. */
function expectNoSwitchControl(audio: HTMLElement) {
  for (const id of ['sm-audio-switch', 'sm-audio-switch-reason', 'sm-audio-refusal', 'sm-audio-silent-switch', 'sm-audio-silent-reason']) {
    expect(within(audio).queryByTestId(id)).not.toBeInTheDocument()
  }
  expect(screen.queryByTestId('sm-audio-switch-dialog')).not.toBeInTheDocument()
  expect(audio.querySelector('[data-testid^="sm-audio-role-"], [data-testid^="sm-audio-channel-"]')).toBeNull()
  expect(within(audio).queryByRole('button', { name: /switch/i })).not.toBeInTheDocument()
}
/** Row 157: the four halves carry their pair label; Pair 1 alone is marked transcribed. */
function expectPairLabels(audio: HTMLElement) {
  TRACKS.forEach((track, index) => {
    const half = audio.querySelector(`[data-channel="${track}"].sm-audio-half`)!
    expect(half).toHaveAttribute('data-pair', String(index + 1))
    expect(within(audio).getByTestId(`sm-audio-pair-${track}`)).toHaveTextContent(pairWords(index + 1))
    if (index === 0) {
      expect(half).toHaveAttribute('data-transcribed', 'true')
      expect(within(audio).getByTestId(`sm-audio-transcribed-${track}`)).toHaveTextContent(PAIRS.transcribed)
    } else {
      expect(half).not.toHaveAttribute('data-transcribed')
      expect(within(audio).queryByTestId(`sm-audio-transcribed-${track}`)).not.toBeInTheDocument()
    }
  })
  // The words of the retired chips are gone from the panel.
  const text = audio.textContent ?? ''
  expect(text).not.toContain(A.role.ACTIVE)
  expect(text).not.toContain(A.role.STANDBY)
}
/** The simulator's refusal of operation 81 (row 150): its code, and nothing written. */
function expectOp81Refused(sim: Sim) {
  expect(() => sim.actions.switchAudioSource('MIC-02')).toThrow(expect.objectContaining({ code: 'AUDIO_SOURCE_FIXED_BY_PAIRING' }))
}

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

describe('row 157: no switch control (AC-4.6 UI; op 81 retired, D130)', () => {
  it('the session holder sees no toggle, no confirmation and no reason line; the simulator refuses op 81 and nothing changes', async () => {
    const sim = mount(OPERATOR_IDS.BUDI)
    const audio = await panel()
    expectNoSwitchControl(audio)
    expect(audio.querySelector('.sm-audio-body')).toHaveAttribute('data-active-input', 'MIC-01')
    // The band of operation 82 stays: one interval, the input of the start.
    expect(within(audio).getByTestId('audio-source-band')).toHaveAttribute('data-segments', '1')
    expect(within(audio).getByTestId('audio-source-band-segment-1')).toHaveAttribute('data-input', 'MIC-01')
    await act(async () => {
      expectOp81Refused(sim)
    })
    expect(activeOf(sim)).toBe('MIC-01')
    expect(switchRows(sim)).toHaveLength(0)
    expect(document.querySelector('[data-kind="AUDIO_SWITCH"]')).toBeNull()
    expect(within(audio).getByTestId('audio-source-band')).toHaveAttribute('data-segments', '1')
    expectNoSwitchControl(audio)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it.each([
    ['a SUPERVISOR who did not open the session', OPERATOR_IDS.ANDI, 'recording'],
    ['a TECHNICIAN', OPERATOR_IDS.RINA, 'recording'],
    ['the holder without a recording', OPERATOR_IDS.BUDI, 'idle'],
  ] as const)('%s sees no switch control either', async (_name, operatorId, scenario) => {
    mount(operatorId, { scenario: scenario as ScenarioName })
    const audio = await panel()
    expectNoSwitchControl(audio)
  })
})

describe('row 157: the pair labels (S5 §6; N-40; row 156 micPairLabel)', () => {
  it('each half reads "Mic N (Camera N)" and Pair 1 alone says Transcribed; the names of the halves stay', async () => {
    mount(OPERATOR_IDS.BUDI)
    const audio = await panel()
    expectPairLabels(audio)
    expect(within(audio).getByTestId('sm-audio-pair-AUDIO-01')).toHaveAttribute('data-channel', 'MIC-01')
    expect(within(audio).getByTestId('sm-audio-pair-AUDIO-04')).toHaveAttribute('data-channel', 'MIC-04')
    expect(screen.getByTestId('sm-track-label-AUDIO-01')).toHaveTextContent('MIC 1')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the labels hold without a recording too (the pairs are fixed by setup, not by the session)', async () => {
    mount(OPERATOR_IDS.BUDI, { scenario: 'idle' })
    expectPairLabels(await panel())
  })
})

describe('the silence warning (OD-11; M5-WARN-1, client half)', () => {
  it('warns and names the input; it offers nothing and changes nothing (row 157: no switch offer)', async () => {
    const sim = mount(OPERATOR_IDS.BUDI)
    const audio = await panel()
    expect(within(audio).queryByTestId('sm-audio-silent')).not.toBeInTheDocument()

    await act(async () => {
      sim.actions.inject('MIC_SILENT')
    })
    const warning = await within(audio).findByTestId('sm-audio-silent')
    expect(warning).toHaveAttribute('data-input', 'MIC-01')
    expect(warning).toHaveTextContent('MIC 1 is silent')
    // Row W3T (R157-3, D5): the pair's microphone is fixed by setup - the body points at the cable or the device.
    expect(warning).toHaveTextContent('The microphone of each pair is fixed by setup: check its cable or the device.')
    expect(warning).not.toHaveTextContent('never switched automatically')
    expect(within(warning).queryByRole('button')).not.toBeInTheDocument()
    // Time passes with the warning up: still nothing switched.
    await act(async () => {
      sim.tick?.()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(activeOf(sim)).toBe('MIC-01')
    expect(switchRows(sim)).toHaveLength(0)
    expectNoSwitchControl(audio)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a TECHNICIAN sees the same warning, with no offer and no reason line', async () => {
    const sim = mount(OPERATOR_IDS.RINA, { prepare: (created) => created.actions.inject('MIC_SILENT') })
    const audio = await panel()
    const warning = await within(audio).findByTestId('sm-audio-silent')
    expect(within(warning).queryByRole('button')).not.toBeInTheDocument()
    expectNoSwitchControl(audio)
    expect(switchRows(sim)).toHaveLength(0)
  })
})

describe('the Dashboard mic tiles (WB-02)', () => {
  it('row W3T (R157-1): name their pair "Mic N (Camera N)", Pair 1 "Transcribed", while a session records; no Active / Standby, no channel chip', async () => {
    const sim = mount(OPERATOR_IDS.BUDI, { path: '/' })
    const first = await screen.findByTestId('device-tile-pair-AUDIO-01', {}, { timeout: 15_000 })
    expect(first).toHaveTextContent('Mic 1 (Camera 1)')
    expect(first).toHaveAttribute('data-channel', 'MIC-01')
    expect(screen.getByTestId('device-tile-pair-AUDIO-02')).toHaveTextContent('Mic 2 (Camera 2)')
    expect(screen.getByTestId('device-tile-pair-AUDIO-03')).toHaveTextContent('Mic 3 (Camera 3)')
    expect(screen.getByTestId('device-tile-pair-AUDIO-04')).toHaveTextContent('Mic 4 (Camera 4)')
    expect(screen.getByTestId('device-tile-transcribed-AUDIO-01')).toHaveTextContent('Transcribed')
    expect(document.querySelectorAll('[data-testid^="device-tile-transcribed-"]')).toHaveLength(1)
    // The retired words: no role chip, no channel chip.
    expect(document.querySelector('[data-testid^="device-tile-source-"], [data-testid^="device-tile-channel-"]')).toBeNull()
    // Row 157 (D130): op 81 is refused by the simulator (row 150) - the tiles keep their pair labels.
    await act(async () => {
      expectOp81Refused(sim)
    })
    expect(screen.getByTestId('device-tile-pair-AUDIO-01')).toHaveTextContent('Mic 1 (Camera 1)')
    expect(screen.getByTestId('device-tile-pair-AUDIO-02')).toHaveTextContent('Mic 2 (Camera 2)')
    expect(switchRows(sim)).toHaveLength(0)
  })
})

// Integration pass D5 (ruling D137): the input behind a meter channel is the microphone line at its
// position in the capture configuration, not the fixed table of the built-in pair.
// D61 (2026-11-04): the rule survives on the transcription pair; the selector now holds FOUR lines, so the
// replacement permutes all of them - no input appears on two lines and channels 3 / 4 name their own inputs.
describe('a replaced transcription pair, MIC-03 / MIC-01 (ruling D137, kept by D61)', () => {
  it('the second meter reads the second line (MIC-01); the halves keep their pair labels (row 157: no Active / Standby chips)', async () => {
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
    expect(audio.querySelector('.sm-audio-body')).toHaveAttribute('data-active-input', 'MIC-03')
    expectPairLabels(audio)
    expectNoSwitchControl(audio)
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
// | The audio panel: a meter channel without its line has no source mark and its meter draws no level; its pair label stays (row 157) | "the audio panel" |
// | The audio source: with no channel-1 line no input is active; with no channel-2 line there is no standby - no built-in input stands in | "the audio panel", "the pair (pure)" |
// | Row 157: no switch control and no switch reason line in any case | "the audio panel" |
// | CONTROL: the seeded four-channel selector reads as before | "the audio panel" (last blocks), every case above this describe |
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
  ])('the audio panel with %s: no channel names an active input, no built-in input is named, and there is no switch control', async (_name, channels, active) => {
    mount(OPERATOR_IDS.BUDI, { prepare: recordingWith(channels) })
    const audio = await panel()
    for (const channel of ALL_CHANNELS) {
      const half = audio.querySelector(`[data-channel="${trackOf(channel)}"].sm-audio-half`)!
      // A held line gives its own channel an input (D61); an absent line leaves the half empty.
      if (channels.includes(channel)) {
        expect(half).not.toHaveAttribute('data-no-input')
      } else {
        expect(half).toHaveAttribute('data-no-input', 'true')
        // The meter of a channel without an input draws no level, although the slice still holds frames of the built-in inputs.
        const meter = half.querySelector('[data-testid="dbfs-meter"]')!
        expect(meter).toHaveAttribute('data-no-signal', 'true')
      }
    }
    const body = audio.querySelector('.sm-audio-body')!
    if (active === null) expect(body).not.toHaveAttribute('data-active-input')
    else expect(body).toHaveAttribute('data-active-input', active)
    // Row 157: the pair slots are named whatever lines are held; nothing to switch, no reason line.
    expectPairLabels(audio)
    expectNoSwitchControl(audio)
    expect(audio.textContent ?? '').not.toMatch(/MIC-01|MIC-02/)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the audio panel with the channel-1 line alone: MIC-01 is the transcribed input, the other halves are empty, no switch control (D61; row 157)', async () => {
    mount(OPERATOR_IDS.BUDI, { prepare: recordingWith(['MIC-01']) })
    const audio = await panel()
    const first = audio.querySelector('[data-channel="AUDIO-01"].sm-audio-half')!
    expect(first).not.toHaveAttribute('data-no-input')
    expect(first).toHaveAttribute('data-transcribed', 'true')
    for (const channel of ALL_CHANNELS.slice(1)) {
      expect(audio.querySelector(`[data-channel="${trackOf(channel)}"].sm-audio-half`)).toHaveAttribute('data-no-input', 'true')
    }
    expect(audio.querySelector('.sm-audio-body')).toHaveAttribute('data-active-input', 'MIC-01')
    expectNoSwitchControl(audio)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL - the seeded four-channel selector on a session that states none yet: every half has its input and its pair label; no switch control', async () => {
    mount(OPERATOR_IDS.BUDI, { prepare: recordingWith(ALL_CHANNELS) })
    const audio = await panel()
    expect(audio.querySelector('.sm-audio-body')).toHaveAttribute('data-active-input', 'MIC-01')
    expect(audio.querySelector('[data-no-input]')).toBeNull()
    expectPairLabels(audio)
    expectNoSwitchControl(audio)
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
