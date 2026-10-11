/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Fix wave L, closing pass L-Z, item 1 - the selector-snapshot defect (cause of G70c-01) on the WEB.
//
// The `session` slice keeps the LAST session after its seal, with the selector snapshot that session
// took. Readers that spelled `state.session?.captureConfig ?? state.captureConfig` therefore named the
// sources of a SEALED session after the selector had been changed. Rule (ONE helper,
// `selectorInForce` of `@dems/shared/sim`): a session's snapshot names the sources only while that
// session is OPEN; otherwise the current selector.
//
// The order held here is the one of the defect: a session is SEALED with CAM-01 / CAM-02 and
// MIC-01 / MIC-02, THEN the selector is changed (`CAM-05` on VIDEO-02; the first microphone line is
// `MIC-04`; in the local-device case the selector names this Mac's camera). The control of each
// case is the same state with the session still OPEN - its snapshot is the truth then (OD-10).
//
// | Surface | Reader | Case |
// |---|---|---|
// | Dashboard device tiles, Devices camera tiles, Monitor feed / thumbs, Session New pre-check tiles | `CameraPreview` (`cameraLinesInForce`) | "pages" |
// | Session New pre-check rows (the source badge) | `usePrecheckDevice` (`selectorInForce`) | "Session New" |
// | Session New, the local-device notice before a pre-check | `useLocalSources` (`localSourcesInForce`) | "Session New" |
// | Monitor audio pair, the meters of Dashboard / Devices / Monitor | `selectStandbyInputId`, `captureMicLines` | "Monitor" |
// | Monitor "Configured profile" | a fact OF the session the card describes: its OWN snapshot, also when sealed (decision 1 of note 156) | "Monitor" |
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, configure, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ALWAYS_VISIBLE,
  captureMicLines,
  createMemoryAuthStorage,
  createSim,
  micInputOfChannel,
  SEAL_AUTOMATIC_RETRIES,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_RETRY_CONTROL_NAME,
  sealStoppedSentence,
  SimProvider,
  type Sim,
  type SimState,
} from '@dems/shared/sim'
import { enWeb } from '@/i18n-web'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { localSourcesInForce } from '@/features/devices/local-source-gate'
import { micTransportShown } from '@/features/devices/own-core-words'
import { usePrecheckDevice } from '@/features/devices/source-class'
import { selectActiveInputId, selectStandbyInputId } from '@/features/session-monitor/audio-source'
import { configuredProfileLinesOf } from '@/features/session-monitor/sim-adapter'
import { stubMediaForJsdom } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

type Device = SimState['captureDevices']['devices'][number]
type Session = NonNullable<SimState['session']>

const sims: Sim[] = []
function stateOf(scenario: 'idle' | 'recording'): SimState {
  const sim = createSim({ scenario, storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  return sim.store.getState()
}

/**
 * A Core in real capture after the order of the defect. `session`: `'SEALED'` = the last session is
 * sealed and still in the slice with its snapshot; `'OPEN'` = the control (a recording session with
 * the same snapshot). `local`: the changed selector names this Mac's camera on VIDEO-02 instead of CAM-05.
 */
function afterSelectorChange(session: 'SEALED' | 'OPEN', local = false): SimState {
  const base = stateOf('recording')
  const camera = base.captureDevices.devices.find((device) => device.kind === 'CAMERA')!
  const mic = base.captureDevices.devices.find((device) => device.kind === 'MIC')!
  const devices = [
    ...base.captureDevices.devices.map((device) => ({ ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' }) as Device),
    { ...camera, id: 'CAM-05', adapter: 'FAKE', sourceClass: 'DEVELOPMENT' } as Device,
    { ...camera, id: 'CAM-03', adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' } as Device,
    { ...mic, id: 'MIC-04', adapter: 'FAKE', sourceClass: 'DEVELOPMENT' } as Device,
  ]
  const snapshot = { cameras: base.captureConfig.cameras, mics: base.captureConfig.mics, revision: 2, updatedAt: base.captureConfig.updatedAt }
  const newCamera = local ? 'CAM-03' : 'CAM-05'
  const captureConfig = {
    ...base.captureConfig,
    cameras: base.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-02' ? { ...line, deviceId: newCamera } : line)),
    mics: base.captureConfig.mics.map((line, index) => (index === 0 ? { ...line, inputId: 'MIC-04', deviceId: 'MIC-04' } : line)),
    updatedAt: base.captureConfig.updatedAt + 60_000,
  } as SimState['captureConfig']
  const { audioSource: _pair, ...open } = base.session as Session & { audioSource?: unknown }
  const held = { ...open, captureConfig: snapshot } as unknown as Session
  return {
    ...base,
    captureDevices: { devices },
    captureConfig,
    session: session === 'OPEN' ? held : ({ ...held, state: 'SEALED', evidenceId: 'EV-20261011-0043' } as unknown as Session),
  }
}

let bed: LiveTestBed | undefined
async function livePage(path: string, pageId: string, served: SimState) {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  created.core.served = served
  const page = await created.load()
  await created.mount(page, path)
  return screen.findByTestId(pageId, {}, { timeout: 15_000 })
}
const tiles = (root: ParentNode, track: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="camera-no-preview"][data-camera="${track}"]`))

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

describe('the state of the defect', () => {
  it('the slice of a SEALED session still holds the snapshot with the OLD sources', () => {
    const state = afterSelectorChange('SEALED')
    expect(state.session?.state).toBe('SEALED')
    expect(state.session?.captureConfig?.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-02')
    expect(state.captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-05')
  })
})

describe('pages of a Core in real capture: after a sealed session, a selector change is what the web names', () => {
  it('Dashboard: the device tile of Camera 2 names CAM-05, not the sealed session\'s CAM-02', async () => {
    const page = await livePage('/', 'page-dashboard', afterSelectorChange('SEALED'))
    const tile = await within(page).findByTestId('device-tile-VIDEO-02')
    await waitFor(() => expect(tiles(tile, 'VIDEO-02')).toHaveLength(1))
    expect(tiles(tile, 'VIDEO-02')[0]).toHaveTextContent('CAM-05')
    expect(tiles(tile, 'VIDEO-02')[0]).not.toHaveTextContent('CAM-02')
  })

  it('Devices & Inputs: the camera tile of Camera 2 names CAM-05', async () => {
    const page = await livePage('/devices', 'page-devices', afterSelectorChange('SEALED'))
    const tile = await within(page).findByTestId('camera-tile-VIDEO-02')
    await waitFor(() => expect(tiles(tile, 'VIDEO-02')).toHaveLength(1))
    expect(tiles(tile, 'VIDEO-02')[0]).toHaveTextContent('CAM-05')
    expect(tiles(tile, 'VIDEO-02')[0]).not.toHaveTextContent('CAM-02')
    // The first track was not changed: it reads the same source either way.
    expect(tiles(within(page).getByTestId('camera-tile-VIDEO-01'), 'VIDEO-01')[0]).toHaveTextContent('CAM-01')
  })

  it('CONTROL - Devices & Inputs while the session is still OPEN: its snapshot is in force (CAM-02)', async () => {
    const page = await livePage('/devices', 'page-devices', afterSelectorChange('OPEN'))
    const tile = await within(page).findByTestId('camera-tile-VIDEO-02')
    await waitFor(() => expect(tiles(tile, 'VIDEO-02')).toHaveLength(1))
    expect(tiles(tile, 'VIDEO-02')[0]).toHaveTextContent('CAM-02')
    expect(tiles(tile, 'VIDEO-02')[0]).not.toHaveTextContent('CAM-05')
  })

  it('Session Monitor while a session records (CONTROL of the shared tile there): every Camera 2 tile names the session\'s CAM-02', async () => {
    const page = await livePage('/session', 'page-session-monitor', afterSelectorChange('OPEN'))
    await waitFor(() => expect(tiles(page, 'VIDEO-02').length).toBeGreaterThanOrEqual(1))
    for (const tile of tiles(page, 'VIDEO-02')) expect(tile.getAttribute('aria-label') ?? '').toContain('CAM-02')
  })
})

describe('Session New: the readers of the pre-check rows and of the local-device notice', () => {
  function Probe({ checkId }: { checkId: string }) {
    const device = usePrecheckDevice(checkId)
    return <output data-testid={`probe-${checkId}`}>{device?.id ?? 'none'}</output>
  }
  function probe(state: SimState): void {
    const sim = createSim({ scenario: 'idle', storage: null, authStorage: createMemoryAuthStorage(), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    sim.store.setState({ captureDevices: state.captureDevices, captureConfig: state.captureConfig, session: state.session })
    render(
      <SimProvider sim={sim} autoStart={false}>
        <Probe checkId="LENS_2" />
        <Probe checkId="MIC_PRIMARY" />
      </SimProvider>,
    )
  }

  it('`usePrecheckDevice`: after a sealed session the rows stand for the sources of the current selector', () => {
    probe(afterSelectorChange('SEALED'))
    expect(screen.getByTestId('probe-LENS_2')).toHaveTextContent('CAM-05')
    expect(screen.getByTestId('probe-MIC_PRIMARY')).toHaveTextContent('MIC-04')
  })

  it('CONTROL - `usePrecheckDevice` under an OPEN session: the sources of its snapshot', () => {
    probe(afterSelectorChange('OPEN'))
    expect(screen.getByTestId('probe-LENS_2')).toHaveTextContent('CAM-02')
    expect(screen.getByTestId('probe-MIC_PRIMARY')).toHaveTextContent('MIC-01')
  })

  it('the local-device notice: a selector that names this Mac\'s camera AFTER a sealed session is asked about - the sealed snapshot (no local device) does not hide it', () => {
    expect(localSourcesInForce(afterSelectorChange('SEALED', true))).toEqual({ camera: 'CAM-03', microphone: null })
    // CONTROL: the open session was created under a selector without a local device - nothing of it is opened.
    expect(localSourcesInForce(afterSelectorChange('OPEN', true))).toBeNull()
    // And the other way round: a sealed session that RECORDED with the local camera names nothing once the selector left it.
    const sealed = afterSelectorChange('SEALED')
    const recordedLocal = { ...sealed, session: { ...sealed.session!, captureConfig: { ...sealed.session!.captureConfig!, cameras: sealed.session!.captureConfig!.cameras.map((line) => ({ ...line, deviceId: 'CAM-03' })) } } as Session }
    expect(localSourcesInForce(recordedLocal)).toBeNull()
  })
})

describe('Session Monitor / the meters: the microphone lines', () => {
  it('the standby of the pair and the input of a meter channel follow the current selector after a sealed session', () => {
    const sealed = afterSelectorChange('SEALED')
    expect(captureMicLines(sealed).map((line) => line.inputId)).toEqual(['MIC-04', 'MIC-02'])
    expect(micInputOfChannel(captureMicLines(sealed), 'AUDIO-01')).toBe('MIC-04')
    // Moved by fix 157 (was `'MIC-04'`, read as "the other line than the meters' MIC-02"): with no open session the pair
    // is the current selector's - MIC-04 is its PRIMARY (active), MIC-02 its STANDBY - whatever the meters' member still says.
    const stale = { ...sealed, audio: { ...sealed.audio, activeInputId: 'MIC-02' } } as SimState
    expect(selectActiveInputId(stale)).toBe('MIC-04')
    expect(selectStandbyInputId(stale)).toBe('MIC-02')
  })

  it('CONTROL - under an OPEN session: the lines of its snapshot', () => {
    const open = afterSelectorChange('OPEN')
    expect(captureMicLines(open).map((line) => line.inputId)).toEqual(['MIC-01', 'MIC-02'])
    expect(selectStandbyInputId({ ...open, audio: { ...open.audio, activeInputId: 'MIC-02' } } as SimState)).toBe('MIC-01')
  })

  it('"Configured profile" is a fact OF the session the card describes: a SEALED session keeps its own snapshot there', () => {
    const own = { cameras: [{ trackId: 'VIDEO-01', profile: 'H264_720P30' }] }
    const later = { cameras: [{ trackId: 'VIDEO-01', profile: 'H264_1080P25' }] }
    expect(configuredProfileLinesOf({ session: { captureConfig: own }, captureConfig: later })).toBe('VIDEO-01: H264_720P30')
    expect(configuredProfileLinesOf({ session: null, captureConfig: later })).toBe('VIDEO-01: H264_1080P25')
  })
})

// Fix 157 - the same class, another member: `session.audioSource`, the active / standby pair. The sealed session was
// switched to MIC-02 (pair: active MIC-02, standby MIC-01) and stays in the slice with that pair; THEN the selector's first
// microphone line became MIC-04. The Monitor's audio panel is drawn in every state of the page.
describe('fix 157 - Session Monitor: the pair of the audio panel after a sealed session and a microphone change', () => {
  const PAIR = { sessionId: 'SES-20261011-0043', activeInputId: 'MIC-02', standbyInputId: 'MIC-01', switchedAt: 5_000, intervalFromMs: 4_000 }
  const withPair = (state: SimState): SimState => ({ ...state, session: { ...state.session!, audioSource: PAIR } as unknown as Session })

  it('the panel names MIC-04 (the selector\'s PRIMARY) as the active input, not the sealed session\'s MIC-02', async () => {
    const served = withPair(afterSelectorChange('SEALED'))
    expect(served.session?.audioSource).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01' })
    const page = await livePage('/session', 'page-session-monitor', served)
    const audio = await within(page).findByTestId('panel-O')
    await waitFor(() => expect(audio.querySelector('.sm-audio-body')).toHaveAttribute('data-active-input', 'MIC-04'))
    expect(within(audio).getByTestId('sm-audio-role-MIC-04')).toHaveAttribute('data-role', 'ACTIVE')
    expect(within(audio).getByTestId('sm-audio-role-MIC-02')).toHaveAttribute('data-role', 'STANDBY')
    // The input that left the selector has no chip any more.
    expect(within(audio).queryByTestId('sm-audio-role-MIC-01')).not.toBeInTheDocument()
  })

  it('CONTROL - the same pair while that session is still OPEN: the session\'s own pair (MIC-02 active, MIC-01 standby)', async () => {
    const page = await livePage('/session', 'page-session-monitor', withPair(afterSelectorChange('OPEN')))
    const audio = await within(page).findByTestId('panel-O')
    await waitFor(() => expect(audio.querySelector('.sm-audio-body')).toHaveAttribute('data-active-input', 'MIC-02'))
    expect(within(audio).getByTestId('sm-audio-role-MIC-02')).toHaveAttribute('data-role', 'ACTIVE')
    expect(within(audio).getByTestId('sm-audio-role-MIC-01')).toHaveAttribute('data-role', 'STANDBY')
  })

  it('the selectors of the pair, both ways', () => {
    const sealed = withPair(afterSelectorChange('SEALED'))
    expect([selectActiveInputId(sealed), selectStandbyInputId(sealed)]).toEqual(['MIC-04', 'MIC-02'])
    const open = withPair(afterSelectorChange('OPEN'))
    expect([selectActiveInputId(open), selectStandbyInputId(open)]).toEqual(['MIC-02', 'MIC-01'])
  })
})

describe('no second spelling in apps/core-web/src (static)', () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        if (name !== '__tests__' && name !== 'test' && name !== 'testing') walk(path)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) files.push(path)
    }
  }
  walk(SRC)
  const SPELLING = /session\??\.captureConfig\s*(\?\?|\?\.)|session\?\.captureConfig\s*[,\]]/
  /** The one reader of a fact OF the session (Monitor "Configured profile"): its own snapshot, no rule of "in force". */
  const OWN_FACT_OF_A_SESSION = ['const own = state.session?.captureConfig?.cameras']

  it('no product file spells "the session\'s snapshot, else the selector" itself', () => {
    const offenders: string[] = []
    for (const path of files) {
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (/^\s*(\*|\/\/|\/\*)/.test(line) || !SPELLING.test(line)) continue
        if (OWN_FACT_OF_A_SESSION.includes(line.trim())) continue
        offenders.push(`${relative(SRC, path)}: ${line.trim()}`)
      }
    }
    expect(offenders).toEqual([])
    expect(files.length).toBeGreaterThan(300)
  })

  it('CONTROL: the pattern finds the expression of the defect', () => {
    expect(SPELLING.test('const config = state.session?.captureConfig ?? state.captureConfig')).toBe(true)
    expect(SPELLING.test('(s.session?.captureConfig ?? s.captureConfig)?.mics')).toBe(true)
  })

  // Fix 157: the audio pair is read through `audioPairInForce` / `openSessionAudioSource` of `@dems/shared/sim` only.
  // (`src/runtime/testing/**` is not product code and is not walked: the model Core there answers operation 82 for its session.)
  const PAIR_SPELLING = /(?<!['"`])\bsession\??\.audioSource\b/
  it('fix 157: no product file reads `session.audioSource` itself', () => {
    const offenders: string[] = []
    for (const path of files) {
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (/^\s*(\*|\/\/|\/\*)/.test(line) || !PAIR_SPELLING.test(line)) continue
        offenders.push(`${relative(SRC, path)}: ${line.trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('fix 157 CONTROL: the pattern finds the expression of the defect', () => {
    expect(PAIR_SPELLING.test('s.session?.audioSource?.activeInputId ?? s.audio.activeInputId')).toBe(true)
    expect(PAIR_SPELLING.test('s.session.audioSource?.activeInputId')).toBe(true)
    expect(PAIR_SPELLING.test("t('session.audioSource.switched')")).toBe(false)
  })
})

// The web leftover of the ONE RULE that item 3 closes on the devices (remainder R-4 of note 154): "USB input" on the
// selector's microphone lines is the dataset's word; a generated source of a Core in real capture has no such input.
describe('the selector\'s microphone lines: no "USB input" for a generated source of a Core in real capture', () => {
  it('the rule: only a generated source on a Core in real capture loses the word', () => {
    expect(micTransportShown(true, { adapter: 'FAKE' })).toBe(false)
    for (const adapter of ['USB_AUDIO', 'LOCAL_DEVICE', null, undefined]) expect(micTransportShown(true, { adapter })).toBe(true)
    expect(micTransportShown(true, undefined)).toBe(true)
    // The simulated lane keeps it, whatever the state names.
    expect(micTransportShown(false, { adapter: 'FAKE' })).toBe(true)
  })

  it('Devices & Inputs on a Core in real capture: the microphone lines name the source and no "USB input"', async () => {
    const page = await livePage('/devices', 'page-devices', afterSelectorChange('SEALED'))
    const line = await within(page).findByTestId('selector-mic-MIC-02')
    expect(line).not.toHaveTextContent('USB input')
    expect(line).toHaveTextContent('MIC-02')
  })

  it('CONTROL - a Core in simulated capture (no source class stated) keeps "USB input"', async () => {
    const base = stateOf('idle')
    const page = await livePage('/devices', 'page-devices', base)
    const line = await within(page).findByTestId('selector-mic-MIC-02')
    expect(line).toHaveTextContent('USB input')
  })
})

// Item 2 of the closing pass (G75d-02; decision 3 of note 155): the Core's own sentences of a blocked seal
// name the retry by the name THIS console gives its control, and say who presses it. Rendered proof of the
// control itself: `features/session-monitor/__tests__/unsealable-notice.test.tsx` "G75d-02" (the same shared examples).
describe('item 2: the Core\'s blocked-seal sentences and the web\'s control agree', () => {
  const R = enWeb.web.waveL.sealRetry
  it('the button is called what the Core\'s alert calls it; both say who may press it', () => {
    expect(R.action).toBe(SEAL_RETRY_CONTROL_NAME)
    expect(SEAL_BLOCKED_EXAMPLE_ALERT.message).toContain(`presses "${R.action}" on the Session Monitor of the web console`)
    expect(SEAL_BLOCKED_EXAMPLE_ALERT.message).toContain('an investigator or a supervisor')
    expect(R.whoCan).toBe('An investigator or a supervisor can retry.')
  })
  it('"stopped after 3 automatic retries": the web\'s sentence and the Core\'s failed-step sentence say the same count', () => {
    const web = R.stopped.replace('{{count}}', String(SEAL_AUTOMATIC_RETRIES))
    expect(web).toBe('Sealing stopped after 3 automatic retries.')
    expect(sealStoppedSentence(SEAL_AUTOMATIC_RETRIES).startsWith(web.slice(0, -1))).toBe(true)
    expect(SEAL_BLOCKED_EXAMPLE_FINALIZATION?.steps[0]?.detail).toContain(sealStoppedSentence(SEAL_AUTOMATIC_RETRIES))
  })
  it('no sentence of the blocked seal - the Core\'s or the web\'s - says "start recovery" or "the recovery action"', () => {
    const said = [SEAL_BLOCKED_EXAMPLE_ALERT.message, SEAL_BLOCKED_EXAMPLE_FINALIZATION?.steps[0]?.detail ?? '', JSON.stringify(enWeb.web.sealBlocked), JSON.stringify(R)].join(' ')
    expect(said).not.toMatch(/start recovery|recovery action|recovery for the session/i)
    // CONTROL: the sentence of before is what this refuses.
    expect('then start recovery for the session or restart the Core.').toMatch(/start recovery|recovery action/i)
  })
})
