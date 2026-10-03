// Step 42: the Dashboard view model (pure rules), the R9 / R8 motion hooks and the panel error
// boundary (frontend error handling: fallback, rate-limited retry).
import '@/i18n'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionState } from '@dems/shared/domain'
import { OperatorRole, Permission, type ActiveSession, type SimEvent } from '@dems/shared/sim'
import {
  busiestHour,
  cameraTone,
  eventDetail,
  finalizationProgress,
  formatOneDecimal,
  groupEventsByDay,
  hourlyBars,
  micSummary,
  precheckProgress,
  QUICK_ACTIONS,
  requiredRoleFor,
  securityColumns,
  securityHeader,
  sessionPanelKind,
  setupStepFor,
  timeTone,
  toGb,
  toTb,
  worstTone,
} from '../dashboard-model'
import { useCoalesced, useEscalationKey, useNewIds } from '../dashboard-motion'
import { PanelBoundary } from '../panel-boundary'

afterEach(() => {
  vi.useRealTimers()
})

const event = (overrides: Partial<SimEvent>): SimEvent => ({
  id: 'LOG-1',
  seq: 1,
  at: 0,
  type: 'HEALTH_CHECK_OK',
  severity: 'SUCCESS',
  message: 'x',
  params: {},
  sessionId: null,
  deviceId: null,
  ...overrides,
})

describe('units (AC-75 figures)', () => {
  it('turns the evidence volume into 3.2 TB free of 4.0 TB and 804 GB used', () => {
    expect(toTb(3_196_000_000_000)).toBe(3.2)
    expect(formatOneDecimal(toTb(4_000_000_000_000))).toBe('4.0')
    expect(toGb(804_000_000_000)).toBe(804)
    expect(formatOneDecimal(3.25)).toBe('3.3')
  })
})

describe('tones', () => {
  it('maps cameras, microphones and time to status tones', () => {
    expect(cameraTone({ camerasOnline: 2, camerasTotal: 2 })).toBe('success')
    expect(cameraTone({ camerasOnline: 1, camerasTotal: 2 })).toBe('danger')
    expect(micSummary([{ state: 'READY', clipLatched: false }, { state: 'READY', clipLatched: false }])).toBe('ready')
    expect(micSummary([{ state: 'NO_SIGNAL', clipLatched: false }, { state: 'READY', clipLatched: false }])).toBe('noSignal')
    expect(micSummary([{ state: 'NO_SIGNAL', clipLatched: false }, { state: 'READY', clipLatched: true }])).toBe('clip')
    expect(timeTone('GNSS', true)).toBe('success')
    expect(timeTone('NTP', true)).toBe('warning')
    expect(worstTone(['success', 'warning', 'danger', 'default'])).toBe('danger')
  })

  it('summarises panel G by its worst column', () => {
    const allGood = securityColumns({ tpmOk: true, secureBoot: true, timeSource: 'GNSS', timeLocked: true, linkUp: true, posture: 'SECURE' })
    expect(securityHeader(allGood)).toEqual({ tone: 'success', attention: 0, critical: 0 })
    const degraded = securityColumns({ tpmOk: false, secureBoot: true, timeSource: 'RTC', timeLocked: false, linkUp: true, posture: 'CRITICAL' })
    expect(degraded).toEqual({ tpm: 'danger', time: 'warning', network: 'success', posture: 'danger' })
    expect(securityHeader(degraded)).toEqual({ tone: 'danger', attention: 1, critical: 2 })
  })
})

describe('Active Session variants (research/04 §3.1 D)', () => {
  it('maps every session state to a panel view', () => {
    expect(sessionPanelKind(null)).toBe('idle')
    for (const state of [SessionState.CREATE, SessionState.PRECHECK, SessionState.ARMED]) expect(sessionPanelKind(state)).toBe('setup')
    expect(sessionPanelKind(SessionState.RECORDING)).toBe('recording')
    expect(sessionPanelKind(SessionState.STOPPING)).toBe('finalizing')
    expect(sessionPanelKind(SessionState.FINALIZING)).toBe('finalizing')
    expect(sessionPanelKind(SessionState.SEALED)).toBe('sealed')
    expect(sessionPanelKind(SessionState.FAULT)).toBe('fault')
    expect(sessionPanelKind(SessionState.RECOVERY)).toBe('recovery')
    expect(setupStepFor(SessionState.CREATE)).toBe(1)
    expect(setupStepFor(SessionState.PRECHECK)).toBe(2)
    expect(setupStepFor(SessionState.ARMED)).toBe(3)
  })

  it('counts pre-check and finalization progress', () => {
    const precheck = {
      items: [
        { status: 'PASS' },
        { status: 'WARN' },
        { status: 'RUNNING' },
        { status: 'PENDING' },
      ],
    } as unknown as ActiveSession['precheck']
    expect(precheckProgress({ precheck })).toEqual({ done: 2, total: 4 })
    const finalization = {
      steps: [{ status: 'done' }, { status: 'done' }, { status: 'active' }, { status: 'pending' }, { status: 'pending' }, { status: 'pending' }],
    } as unknown as ActiveSession['finalization']
    expect(finalizationProgress({ finalization })).toEqual({ current: 3, total: 6 })
    const sealed = { steps: Array.from({ length: 6 }, () => ({ status: 'done' })) } as unknown as ActiveSession['finalization']
    expect(finalizationProgress({ finalization: sealed })).toEqual({ current: 6, total: 6 })
  })
})

describe('Recent Events rows (04 §9 #34)', () => {
  // 2026-10-01T10:00:00+07:00
  const now = Date.UTC(2026, 9, 1, 3, 0, 0)
  it('groups newest-first events by UTC+07:00 day into today, yesterday and dates', () => {
    const rows = [
      event({ id: 'a', at: now - 60_000 }),
      event({ id: 'b', at: Date.UTC(2026, 8, 30, 17, 5) }), // 00:05 WIB today
      event({ id: 'c', at: Date.UTC(2026, 8, 30, 16, 55) }), // 23:55 WIB yesterday
      event({ id: 'd', at: Date.UTC(2026, 8, 28, 3, 0) }),
    ]
    const groups = groupEventsByDay(rows, now)
    expect(groups.map((group) => [group.dayKey, group.label.kind, group.events.map((row) => row.id)])).toEqual([
      ['2026-10-01', 'today', ['a', 'b']],
      ['2026-09-30', 'yesterday', ['c']],
      ['2026-09-28', 'date', ['d']],
    ])
    expect(groups[2]?.label).toEqual({ kind: 'date', text: '28 Sep 2026' })
  })

  it('picks the detail column: evidence, then session, operator, device, time source', () => {
    const name = (id: string) => (id === 'OPR-001' ? 'AKP Budi Santoso' : null)
    expect(eventDetail(event({ params: { evidenceId: 'EV-1' }, sessionId: 'SES-1' }), name)).toBe('EV-1')
    expect(eventDetail(event({ sessionId: 'SES-1' }), name)).toBe('SES-1')
    expect(eventDetail(event({ params: { operatorId: 'OPR-001' } }), name)).toBe('AKP Budi Santoso')
    expect(eventDetail(event({ params: { operatorId: 'OPR-404' } }), name)).toBe('OPR-404')
    expect(eventDetail(event({ deviceId: 'CAM-01' }), name)).toBe('CAM-01')
    expect(eventDetail(event({ params: { source: 'GNSS' } }), name)).toBe('GNSS')
    expect(eventDetail(event({}), name)).toBeNull()
  })
})

describe('Sealed Evidence Today chart', () => {
  it('always has 24 hourly slots and names the busiest hour', () => {
    const buckets = [0, 0, 0, 0, 0, 0, 0, 2, 3, 2, ...Array.from({ length: 14 }, () => 0)]
    const bars = hourlyBars(buckets)
    expect(bars).toHaveLength(24)
    expect(bars[8]).toEqual({ hour: '08', count: 3 })
    expect(busiestHour(buckets)).toBe('08')
    expect(busiestHour(Array.from({ length: 24 }, () => 0))).toBeNull()
  })
})

describe('RBAC rule (S20)', () => {
  it('names the least-privileged role that holds a permission', () => {
    expect(requiredRoleFor(Permission.SESSION_START)).toBe(OperatorRole.INVESTIGATOR)
    expect(requiredRoleFor(Permission.EVIDENCE_EXPORT)).toBe(OperatorRole.SUPERVISOR)
    expect(requiredRoleFor(Permission.DEVICE_MANAGE)).toBe(OperatorRole.TECHNICIAN)
  })

  it('gates only the quick actions whose named action needs a permission', () => {
    expect(QUICK_ACTIONS.map((action) => [action.id, action.to, action.permission])).toEqual([
      ['runDiagnostics', '/system', Permission.DIAGNOSTICS_RUN],
      ['reviewAudit', '/security-audit', null],
      ['exportEvidence', '/evidence', Permission.EVIDENCE_EXPORT],
      ['openMaintenance', '/system', null],
    ])
  })
})

describe('motion hooks (R8, R9, M-C-07)', () => {
  it('coalesces changes closer than 400 ms into one update (R9)', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useCoalesced(value, 400), { initialProps: { value: 1 } })
    rerender({ value: 2 })
    act(() => void vi.advanceTimersByTime(0))
    expect(result.current).toBe(2)
    rerender({ value: 3 })
    rerender({ value: 4 })
    act(() => void vi.advanceTimersByTime(200))
    expect(result.current).toBe(2)
    act(() => void vi.advanceTimersByTime(250))
    expect(result.current).toBe(4)
  })

  it('marks only IDs added after the first render, for the hold time', () => {
    vi.useFakeTimers()
    const first = ['a', 'b']
    const { result, rerender } = renderHook(({ ids }) => useNewIds(ids, 1500), { initialProps: { ids: first } })
    expect([...result.current]).toEqual([])
    rerender({ ids: ['c', 'a', 'b'] })
    expect([...result.current]).toEqual(['c'])
    act(() => void vi.advanceTimersByTime(1000))
    rerender({ ids: ['d', 'c', 'a'] })
    expect([...result.current].sort()).toEqual(['c', 'd'])
    act(() => void vi.advanceTimersByTime(600))
    expect([...result.current]).toEqual(['d'])
    act(() => void vi.advanceTimersByTime(1000))
    expect([...result.current]).toEqual([])
  })

  it('changes the escalation key only when the rank rises (R8)', () => {
    const { result, rerender } = renderHook(({ rank }) => useEscalationKey(rank), { initialProps: { rank: 0 } })
    expect(result.current).toBe(0)
    rerender({ rank: 2 })
    expect(result.current).toBe(1)
    rerender({ rank: 0 })
    expect(result.current).toBe(1)
    rerender({ rank: 3 })
    expect(result.current).toBe(2)
  })
})

describe('PanelBoundary (one panel fails, the Dashboard stays)', () => {
  it('shows a friendly fallback and allows at most one retry per cooldown', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let fail = true
    function Flaky() {
      if (fail) throw new Error('boom')
      return <p>recovered</p>
    }
    render(
      <PanelBoundary panel="X">
        <Flaky />
      </PanelBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('This panel could not be displayed')
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
    // First retry is allowed at once; the child fails again, so the next retry waits 3 s.
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByRole('button', { name: /Retry in 3s/ })).toBeDisabled()
    fail = false
    vi.mocked(console.error).mockRestore()
  })

  it('renders the children again after a successful retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let fail = true
    function Flaky() {
      if (fail) throw new Error('boom')
      return <p>recovered</p>
    }
    render(
      <PanelBoundary panel="Y">
        <Flaky />
      </PanelBoundary>,
    )
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('recovered')).toBeInTheDocument()
    vi.mocked(console.error).mockRestore()
  })
})
