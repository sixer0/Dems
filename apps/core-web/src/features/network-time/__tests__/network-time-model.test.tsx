// Step 50 pure tests: the hierarchy rules, offset series, formatting and the simulator's W50 views (step 54).
import { describe, expect, it } from 'vitest'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, type SimEvent, type SimState } from '@dems/shared/sim'
import { formatOffset, isTimeEscalation, networkLevel, offsetSeries, secondTicks, tierState, timeLevel } from '../model'
import {
  domainState,
  EXPORT_TRANSFER_WINDOW_MS,
  eventSource,
  selectAvSync,
  selectNetworkTimeEvents,
} from '../sim-adapter'

function freshState(): SimState {
  const sim = createSim({
    storage: null,
    authStorage: createMemoryAuthStorage(),
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
  const state = sim.store.getState()
  sim.stop()
  return state
}

function event(partial: Partial<SimEvent>): SimEvent {
  return {
    id: 'E',
    seq: 1,
    at: 0,
    type: 'HEALTH_CHECK_OK',
    severity: 'INFO',
    message: '',
    params: {},
    sessionId: null,
    deviceId: null,
    ...partial,
  }
}

describe('Network & Time model', () => {
  it('maps the §2.2 hierarchy: active tier = source, lost / unreachable tiers below it', () => {
    const time = { source: 'GNSS', gnss: { locked: true, satellites: 11 }, ntp: { server: 'x', reachable: true, stratum: 2 } } as const
    expect(tierState(time, 'GNSS')).toBe('ACTIVE')
    expect(tierState(time, 'NTP')).toBe('STANDBY')
    expect(tierState(time, 'RTC')).toBe('STANDBY')
    const rtc = { source: 'RTC', gnss: { locked: false, satellites: 0 }, ntp: { server: 'x', reachable: false, stratum: 2 } } as const
    expect(tierState(rtc, 'GNSS')).toBe('LOST')
    expect(tierState(rtc, 'NTP')).toBe('UNREACHABLE')
    expect(tierState(rtc, 'RTC')).toBe('ACTIVE')
    expect(timeLevel('GNSS')).toBe('LOCKED')
    expect(timeLevel('NTP')).toBe('FALLBACK')
    expect(timeLevel('RTC')).toBe('HOLDOVER')
    expect(isTimeEscalation('LOCKED', 'FALLBACK')).toBe(true)
    expect(isTimeEscalation('HOLDOVER', 'FALLBACK')).toBe(false)
    expect(networkLevel(true, 4, 4)).toBe('UP')
    expect(networkLevel(true, 3, 4)).toBe('DEGRADED')
    expect(networkLevel(false, 4, 4)).toBe('DOWN')
  })

  it('formats signed offsets and joins the coloured offset segments where the source changes', () => {
    expect(formatOffset(3)).toBe('+3.0')
    expect(formatOffset(-1.24)).toBe('−1.2')
    expect(formatOffset(0.04)).toBe('0.0')
    const rows = offsetSeries([
      { at: 1, offsetMs: 2, source: 'GNSS' },
      { at: 2, offsetMs: 3, source: 'GNSS' },
      { at: 3, offsetMs: 9, source: 'NTP' },
    ])
    expect(rows.map((r) => [r.GNSS, r.NTP])).toEqual([
      [2, null],
      [3, 3],
      [null, 9],
    ])
    expect(secondTicks(0).filter(Boolean)).toHaveLength(1)
    expect(secondTicks(59).filter(Boolean)).toHaveLength(60)
  })

  it('W50-1 (simulator): derives the four domain states from the slices that move', () => {
    const state = freshState()
    const second = Math.floor(state.clock.now / 1_000)
    expect(domainState(state, 'CAMERA', second)).toBe('ACTIVE')
    expect(domainState(state, 'MANAGEMENT', second)).toBe('ACTIVE')
    expect(domainState(state, 'SERVICE_UPDATE', second)).toBe('RESTRICTED')
    expect(domainState(state, 'EXPORT_TRANSFER', second)).toBe('ON_DEMAND')
    const exported = {
      ...state,
      events: [...state.events, event({ type: 'EVIDENCE_EXPORTED', at: second * 1_000 - 5_000 })],
    }
    expect(domainState(exported, 'EXPORT_TRANSFER', second)).toBe('TRANSFER')
    expect(domainState(exported, 'EXPORT_TRANSFER', second + EXPORT_TRANSFER_WINDOW_MS / 1_000)).toBe('ON_DEMAND')
    const updating = { ...state, update: { ...state.update, state: 'RUNNING' as const } }
    expect(domainState(updating, 'SERVICE_UPDATE', second)).toBe('UPDATING')
    const offline = { ...state, tabletLink: { ...state.tabletLink, state: 'OFFLINE' as const } }
    expect(domainState(offline, 'MANAGEMENT', second)).toBe('DEGRADED')
  })

  it('W50-2 / -3 (simulator): A/V sync follows the lock; the log filter keeps network and time events only', () => {
    const state = freshState()
    expect(selectAvSync(state).state).toBe('HEALTHY')
    expect(selectAvSync({ ...state, time: { ...state.time, source: 'RTC', locked: false } }).state).toBe('DEGRADED')
    expect(eventSource(event({ type: 'TIME_SYNC' }))).toBe('TIME')
    expect(eventSource(event({ type: 'FAULT_RAISED', params: { kind: 'GNSS_LOSS' } }))).toBe('TIME')
    expect(eventSource(event({ type: 'FAULT_RAISED', params: { kind: 'MIC_CLIP' } }))).toBeNull()
    expect(eventSource(event({ type: 'EVIDENCE_SEALED' }))).toBeNull()
    const picked = selectNetworkTimeEvents(state, 8)
    expect(picked.length).toBeGreaterThan(0)
    expect(picked.every((e) => eventSource(e) !== null)).toBe(true)
    // Store-owned references: a second call is element-wise identical (shallow-stable for useSim).
    const again = selectNetworkTimeEvents(state, 8)
    expect(again.every((e, i) => e === picked[i])).toBe(true)
    for (let i = 1; i < picked.length; i += 1) expect((picked[i - 1]?.at ?? 0) >= (picked[i]?.at ?? 0)).toBe(true)
  })
})
