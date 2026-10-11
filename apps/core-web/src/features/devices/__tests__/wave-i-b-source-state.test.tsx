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
    expect(measuredFiguresShown({ realCapture: true, recording: true })).toEqual({ poePort: false, bitrate: true })
    expect(measuredFiguresShown({ realCapture: false, recording: false })).toEqual({ poePort: true, bitrate: true })
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
