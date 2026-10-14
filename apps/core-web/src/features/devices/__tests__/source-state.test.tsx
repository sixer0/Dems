// Fix wave I, driver B - finding G70b-06 (web half) of re-gate 70 (`w2_devices_cam03_named.png`,
// `w2_selector_cam04_assigned_after_restart.png`): a track naming a source nobody opened read "Online /
// Stream live" with a PoE port and a bitrate. Ruling of driver A2 (`contract_wave_i_a2.md` section 4):
//
// | Core | Condition | The line says |
// |---|---|---|
// | real capture | `checkedAt === null` (this Core has not read the device since it started) | "Not checked", no stream line |
// | real capture | outside a recording | "Reachable" / "Not reachable" (from `online`); never "Stream live" |
// | real capture | a session is RECORDING | the stream state of the recording's telemetry |
// | real capture | a LOST stream | stays (a negative fact of a read is never hidden) |
// | simulated | any | as before: Online / Offline, Stream live / lost (CONTROL) |
//
// `checkedAt` is PLANNED (the name is fixed, the member may land later): absent = drawn as today.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { en } from '@dems/shared/i18n'
import { createTestSim, withProviders } from '@/components/composed/__tests__/test-utils'
import { enWeb } from '@/i18n-web'
import { SourceStateChips } from '../source-state-chips'
import { checkedAtOf, measuredFiguresShown, sourceLineState } from '../source-state'
import { cameraLinesInForce, clearCaptureWarningTransition, raiseCaptureWarningTransition } from '@dems/shared/sim'
import { cameraCaptureFaultOf, STREAM_FACTS_NOT_STATED, storedStreamFactsOf, trackFactsOf } from '../stream-facts'

afterEach(cleanup)

const S = en.devices.selector
const R = en.common.developmentRoster

describe('the rule', () => {
  const real = { realCapture: true, recording: false, online: true, streamState: 'LIVE' as const, checkedAt: undefined }

  // Fix wave L (G70c-02), pin moved by delta: at rest `online: true` only says "the registry row is enabled" - a camera on a
  // dead address read "Reachable". Idle is NOT_CHECKED; REACHABLE needs a stated `checkedAt` or a recording.
  it('G70b-06 / G70c-02 - real capture, idle: "Not checked", and NO "Stream live" (nobody opened the source)', () => {
    expect(sourceLineState(real)).toEqual({ reach: 'NOT_CHECKED', stream: null })
    expect(sourceLineState({ ...real, checkedAt: 1_791_000_000_000 })).toEqual({ reach: 'REACHABLE', stream: null })
    expect(sourceLineState({ ...real, online: false, streamState: null })).toEqual({ reach: 'NOT_REACHABLE', stream: null })
  })

  it('real capture, a session is RECORDING: the stream state of the recording is drawn', () => {
    expect(sourceLineState({ ...real, recording: true })).toEqual({ reach: 'REACHABLE', stream: 'LIVE' })
  })

  it('real capture: a LOST stream stays, recording or not', () => {
    expect(sourceLineState({ ...real, streamState: 'LOST' })).toEqual({ reach: 'NOT_CHECKED', stream: 'LOST' })
  })

  it('real capture, `checkedAt: null`: "Not checked" and no stream line, also while recording', () => {
    expect(sourceLineState({ ...real, checkedAt: null })).toEqual({ reach: 'NOT_CHECKED', stream: null })
    expect(sourceLineState({ ...real, checkedAt: null, recording: true })).toEqual({ reach: 'NOT_CHECKED', stream: null })
    expect(sourceLineState({ ...real, checkedAt: 1_791_636_968_000 })).toEqual({ reach: 'REACHABLE', stream: null })
  })

  it('CONTROL - simulated capture is drawn as before, whatever `checkedAt` says', () => {
    const simulated = { ...real, realCapture: false }
    expect(sourceLineState(simulated)).toEqual({ reach: 'ONLINE', stream: 'LIVE' })
    expect(sourceLineState({ ...simulated, checkedAt: null })).toEqual({ reach: 'ONLINE', stream: 'LIVE' })
    expect(sourceLineState({ ...simulated, online: false, streamState: 'LOST' })).toEqual({ reach: 'OFFLINE', stream: 'LOST' })
  })

  it('`checkedAtOf` reads the planned member by name: absent = undefined (draw as today), null, or a finite number', () => {
    expect(checkedAtOf(undefined)).toBeUndefined()
    expect(checkedAtOf({ id: 'CAM-04' })).toBeUndefined()
    expect(checkedAtOf({ id: 'CAM-04', checkedAt: null })).toBeNull()
    expect(checkedAtOf({ id: 'CAM-04', checkedAt: 5 })).toBe(5)
    expect(checkedAtOf({ id: 'CAM-04', checkedAt: 'yesterday' })).toBeUndefined()
    expect(checkedAtOf({ id: 'CAM-04', checkedAt: Number.NaN })).toBeUndefined()
  })

  it('PoE port and bitrate: figures the Core did not measure are not drawn in real capture outside a recording', () => {
    expect(measuredFiguresShown({ realCapture: true, recording: false })).toEqual({ poePort: false, bitrate: false })
    // Task 4 row W4 (review 060c R-01), PIN MOVED: this line pinned `bitrate: true` while a session records on a Core in real
    // capture. The figure drawn there was the simulator's literal 9 (the only writer of a camera's `bitrateMbps`); no telemetry
    // writes it. A simulator value shown in LIVE mode: never drawn now, recording or not.
    expect(measuredFiguresShown({ realCapture: true, recording: true })).toEqual({ poePort: false, bitrate: false })
    expect(measuredFiguresShown({ realCapture: false, recording: false })).toEqual({ poePort: true, bitrate: true })
    // CONTROL - Simulated mode while recording: the simulator's own statement stays.
    expect(measuredFiguresShown({ realCapture: false, recording: true })).toEqual({ poePort: true, bitrate: true })
    // Pass I-9b: the nullable member. Null is never drawn, in any mode; a stated figure follows the mode as before.
    expect(measuredFiguresShown({ realCapture: false, recording: true, bitrateMbps: null })).toEqual({ poePort: true, bitrate: false })
    expect(measuredFiguresShown({ realCapture: false, recording: false, bitrateMbps: 9 })).toEqual({ poePort: true, bitrate: true })
    expect(measuredFiguresShown({ realCapture: true, recording: true, bitrateMbps: null })).toEqual({ poePort: false, bitrate: false })
    expect(measuredFiguresShown({ realCapture: true, recording: true, bitrateMbps: 9 })).toEqual({ poePort: false, bitrate: false })
  })

  // ── Task 4 row W4: the stream facts of a track (`stream-facts.ts`; review 060c R-02 to R-06, 060b S-01) ──
  it('W4 - `storedStreamFactsOf`: a stored profile code states its picture, rate and codec as the Core reads it; anything else states nothing', () => {
    // The Core's own answers for the same codes (`cameraStreamFactsOf`, `apps/core-server/src/modules/devices/status.ts`).
    expect(storedStreamFactsOf('H264_1080P25')).toEqual({ resolution: '1080p', fps: 25, codec: 'H.264' })
    expect(storedStreamFactsOf('H264_720P30')).toEqual({ resolution: '720p', fps: 30, codec: 'H.264' })
    // An HEVC code states no rate: null, never a default.
    expect(storedStreamFactsOf('HEVC_2160P')).toEqual({ resolution: '2160p', fps: null, codec: 'HEVC' })
    expect(storedStreamFactsOf('HEVC_2560X1920P')).toEqual({ resolution: '2560x1920', fps: null, codec: 'HEVC' })
    expect(storedStreamFactsOf('H264_2560X1920P15')).toEqual({ resolution: '2560x1920', fps: 15, codec: 'H.264' })
    // No statement: a development profile's name, an empty slot, no text, a 16:9 picture written with a width (no code the
    // mint makes), numbers the contract cannot carry.
    for (const code of ['STANDARD_1080P25', 'HEVC_2160P25_MAIN', '', null, undefined, 7, 'h264_1080p25', 'H264_1920X1080P25', 'H264_50P25', 'H264_1080P999', 'AV1_1080P25']) {
      expect(storedStreamFactsOf(code), String(code)).toEqual(STREAM_FACTS_NOT_STATED)
    }
  })

  it('W4 - `trackFactsOf`: Simulated mode reads the slice unchanged; a Core in real capture reads the selector line and never the slice', () => {
    const idle = createTestSim('idle').store.getState()
    // CONTROL - off a real-capture Core: the dataset's statement, no fault judged here (the simulated lane keeps its own drawing).
    expect(trackFactsOf(idle, 'VIDEO-01', false)).toEqual({ stated: false, known: true, resolution: '1080p', fps: 25, codec: 'H.264', fault: null })
    expect(trackFactsOf({ ...idle, cameras: [] }, 'VIDEO-01', false)).toMatchObject({ stated: false, known: false })
    const lines = (change: (line: (typeof idle.captureConfig.cameras)[number]) => object) => ({
      ...idle,
      captureConfig: { ...idle.captureConfig, cameras: idle.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, ...change(line) } : line)) } as typeof idle.captureConfig,
    })
    // Stated facts: the line's stored statement, although the slice says 1080p / 25 / H.264.
    expect(trackFactsOf(lines(() => ({ profile: 'HEVC_2160P' })), 'VIDEO-01', true)).toEqual({ stated: true, known: true, resolution: '2160p', fps: null, codec: 'HEVC', fault: null })
    // Null facts: a code that is no statement, and a track the selector names no line for.
    expect(trackFactsOf(lines(() => ({ profile: 'STANDARD' })), 'VIDEO-01', true)).toEqual({ stated: true, known: true, resolution: null, fps: null, codec: null, fault: null })
    expect(trackFactsOf({ ...idle, captureConfig: { ...idle.captureConfig, cameras: [] } }, 'VIDEO-01', true)).toEqual({ stated: true, known: true, resolution: null, fps: null, codec: null, fault: null })
    // A fault the Core reports: a lost stream, a source not reachable, the slice's own fault of the track.
    expect(trackFactsOf(lines(() => ({ streamState: 'LOST' })), 'VIDEO-01', true).fault).toBe('STREAM_LOST')
    expect(trackFactsOf(lines(() => ({ online: false })), 'VIDEO-01', true).fault).toBe('NOT_REACHABLE')
    expect(trackFactsOf({ ...idle, cameras: idle.cameras.map((camera) => (camera.id === 'VIDEO-01' ? { ...camera, lens: 'FAULT' as const } : camera)) }, 'VIDEO-01', true).fault).toBe('NO_SIGNAL')
    expect(trackFactsOf({ ...idle, cameras: idle.cameras.map((camera) => (camera.id === 'VIDEO-01' ? { ...camera, online: false } : camera)) }, 'VIDEO-01', true).fault).toBe('NO_SIGNAL')
    // The other track is not touched by the first one's fault.
    expect(trackFactsOf(lines(() => ({ streamState: 'LOST' })), 'VIDEO-02', true).fault).toBeNull()
  })

  // Task 4 row W5 (review 060d Q-01). The double: the Core's own raise and clear of a capture warning
  // (`raiseCaptureWarningTransition` / `clearCaptureWarningTransition` of the shared package) on the recording dataset.
  // Seen RED on the mutation "trackFactsOf does not read `cameraCaptureFaultOf`": the first `fault` below read null.
  it('W5 (Q-01) - a camera the Core holds an ACTIVE capture fault about is in fault although its line reads LIVE; the fault goes when the Core clears it', () => {
    const recording = createTestSim('recording').store.getState()
    const cameraOf = (trackId: string) => cameraLinesInForce(recording).find((line) => line.trackId === trackId)!.deviceId
    const warning = { code: 'CAPTURE_FAULT', subject: cameraOf('VIDEO-01'), reason: 'CAMERA_STREAM_ENDED' } as Parameters<typeof raiseCaptureWarningTransition>[2]
    const raised = raiseCaptureWarningTransition(recording, recording.clock.now, warning)
    // THE PREMISE of the finding: raising the fault changes no line - the track still says LIVE.
    expect(cameraLinesInForce(raised).find((line) => line.trackId === 'VIDEO-01')).toMatchObject({ online: true, streamState: 'LIVE' })
    expect(cameraCaptureFaultOf(raised.alerts, cameraOf('VIDEO-01'))).toBe('STREAM_LOST')
    expect(trackFactsOf(raised, 'VIDEO-01', true).fault).toBe('STREAM_LOST')
    // The other track keeps its state; Simulated mode and a Core in simulated capture judge no fault here.
    expect(trackFactsOf(raised, 'VIDEO-02', true).fault).toBeNull()
    expect(trackFactsOf(raised, 'VIDEO-01', false).fault).toBeNull()
    // Another cause about the camera (it did not connect, sent no picture, ...) is a fault too, in the general word.
    const other = raiseCaptureWarningTransition(recording, recording.clock.now, { ...warning, reason: 'CAMERA_NO_PICTURE' } as unknown as typeof warning)
    expect(trackFactsOf(other, 'VIDEO-01', true).fault).toBe('NO_SIGNAL')
    // A fault of the capture as a whole names no track; an advisory (`SYSTEM`) alert about the camera is no fault.
    const whole = raiseCaptureWarningTransition(recording, recording.clock.now, { ...warning, subject: null } as unknown as typeof warning)
    expect(trackFactsOf(whole, 'VIDEO-01', true).fault).toBeNull()
    const advisory = { ...recording, alerts: raised.alerts.map((alert) => (alert.kind === 'CAPTURE_FAULT' ? { ...alert, kind: 'SYSTEM' as const } : alert)) }
    expect(trackFactsOf(advisory, 'VIDEO-01', true).fault).toBeNull()
    // The re-open: the Core clears the fault it raised, and the track reads as before.
    const cleared = clearCaptureWarningTransition(raised, raised.clock.now, warning)
    expect(cleared.alerts.some((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active)).toBe(false)
    expect(cameraCaptureFaultOf(cleared.alerts, cameraOf('VIDEO-01'))).toBeNull()
    expect(trackFactsOf(cleared, 'VIDEO-01', true).fault).toBeNull()
  })
})

describe('the chips', () => {
  const draw = (state: ReturnType<typeof sourceLineState>) => {
    const sim = createTestSim('idle')
    render(withProviders(<SourceStateChips state={state} />, { sim }))
    return screen.getByTestId('source-state-chips')
  }

  it('real capture, idle: one chip "Reachable"; "Online" and "Stream live" are not said', () => {
    const chips = draw({ reach: 'REACHABLE', stream: null })
    expect(chips).toHaveTextContent(R.reachable)
    expect(chips).not.toHaveTextContent(S.online)
    expect(chips).not.toHaveTextContent(S.stream.LIVE)
    expect(chips).toHaveAttribute('data-reach', 'REACHABLE')
  })

  it('"Not checked" is a neutral chip with no stream chip', () => {
    const chips = draw({ reach: 'NOT_CHECKED', stream: null })
    expect(chips).toHaveTextContent(enWeb.web.source.notChecked)
    expect(chips.querySelectorAll('[data-chip]')).toHaveLength(1)
  })

  it('"Not reachable"', () => {
    expect(draw({ reach: 'NOT_REACHABLE', stream: null })).toHaveTextContent(R.notReachable)
  })

  it('CONTROL - simulated: "Online" and "Stream live" as before', () => {
    const chips = draw({ reach: 'ONLINE', stream: 'LIVE' })
    expect(chips).toHaveTextContent(S.online)
    expect(chips).toHaveTextContent(S.stream.LIVE)
    expect(chips.querySelectorAll('[data-chip]')).toHaveLength(2)
  })
})

// Task 4 row W6 (request lines 566, 569; decisions C141, C143): the Core states `streamState: null` for an idle
// registered camera (nobody reads its stream). It is "Stream not read" - never "Live", "Lost" or "Online". Seen RED on
// the mutation "an explicit null reads as an absent member" (`const stream = read` in `sourceLineState`): the first case.
describe('row W6: the Core\'s null stream state is "not read"', () => {
  const idle = { realCapture: true, recording: false, online: true, streamState: null, checkedAt: undefined }

  it('the rule: an explicit null is NOT_READ where a stream word is said; an absent member says nothing; not reachable keeps its negative fact alone', () => {
    expect(sourceLineState(idle)).toEqual({ reach: 'NOT_CHECKED', stream: 'NOT_READ' })
    expect(sourceLineState({ ...idle, checkedAt: 1_791_000_000_000 })).toEqual({ reach: 'REACHABLE', stream: 'NOT_READ' })
    expect(sourceLineState({ ...idle, realCapture: false })).toEqual({ reach: 'ONLINE', stream: 'NOT_READ' })
    // CONTROL: the member absent (an older Core) says nothing, and a source never checked keeps "Not checked" alone.
    expect(sourceLineState({ ...idle, streamState: undefined })).toEqual({ reach: 'NOT_CHECKED', stream: null })
    expect(sourceLineState({ ...idle, checkedAt: null })).toEqual({ reach: 'NOT_CHECKED', stream: null })
    expect(sourceLineState({ ...idle, online: false })).toEqual({ reach: 'NOT_REACHABLE', stream: null })
  })

  it('the chips: "Stream not read" as a neutral chip, never the words of a live or a lost stream', () => {
    const sim = createTestSim('idle')
    render(withProviders(<SourceStateChips state={sourceLineState(idle)} />, { sim }))
    const chips = screen.getByTestId('source-state-chips')
    expect(chips).toHaveAttribute('data-stream', 'NOT_READ')
    expect(chips).toHaveTextContent(enWeb.web.source.streamNotRead)
    for (const word of [S.stream.LIVE, S.stream.LOST, S.online]) expect(chips).not.toHaveTextContent(word)
    expect(chips.querySelector('[data-chip="stream"]')).toHaveTextContent('Stream not read')
  })
})
