// Step 52: pure view-model and adapter tests for the System & Maintenance page.
import { describe, expect, it } from 'vitest'
import { createManualClock, createSim, FaultKind, ALWAYS_VISIBLE, type DiagnosticsRun } from '@dems/shared/sim'
import {
  activeFaultKeys,
  bannerTone,
  countServices,
  DEMO_FAULTS,
  formatAsOf,
  formatUptime,
  isSpecActive,
  requiredRoleFor,
  sparklinePath,
  summarizeDiagnostics,
  timeSourceChoice,
} from '../model'
import { releaseInfo, selectServicesSince, uptimeAnchors } from '../sim-adapter'

describe('System page model', () => {
  it('formats uptime with days only when needed and clamps bad input', () => {
    expect(formatUptime(0)).toBe('00:00:00')
    expect(formatUptime(3_723_000)).toBe('01:02:03')
    expect(formatUptime(90_061_000)).toBe('1d 01:01:01')
    expect(formatUptime(-5)).toBe('00:00:00')
    expect(formatUptime(Number.NaN)).toBe('00:00:00')
  })

  it('counts services and picks the banner tone', () => {
    const counts = countServices(['RUNNING', 'DEGRADED', 'RUNNING', 'STOPPED'])
    expect(counts).toEqual({ total: 4, running: 2, attention: 2, stopped: 1 })
    expect(bannerTone(counts)).toBe('danger')
    expect(bannerTone(countServices(['RUNNING', 'DEGRADED']))).toBe('warning')
    expect(bannerTone(countServices(['RUNNING']))).toBe('success')
  })

  it('names the least-privileged role for a permission (S20)', () => {
    expect(requiredRoleFor('MAINTENANCE')).toBe('TECHNICIAN')
    expect(requiredRoleFor('DIAGNOSTICS_RUN')).toBe('INVESTIGATOR')
    expect(requiredRoleFor('AUDIT_EXPORT')).toBe('SUPERVISOR')
  })

  it('draws a clamped sparkline on a fixed scale', () => {
    expect(sparklinePath([], 100, 10, 0, 10)).toBe('')
    expect(sparklinePath([0, 10, 20], 100, 10, 0, 10)).toBe('M0.0 10.0 L50.0 0.0 L100.0 0.0')
  })

  it('summarises a diagnostics run', () => {
    const run: DiagnosticsRun = {
      id: 'DIAG-1',
      startedAt: 0,
      completedAt: null,
      checks: [
        { id: 'CPU', label: 'CPU', status: 'PASS', detail: null },
        { id: 'FAN', label: 'Fan', status: 'FAIL', detail: null },
        { id: 'TIME', label: 'Time', status: 'WARN', detail: null },
        { id: 'AUDIO', label: 'Audio', status: 'RUNNING', detail: null },
      ],
    }
    expect(summarizeDiagnostics(run)).toEqual({ done: 3, total: 4, pass: 1, warn: 1, fail: 1, complete: false })
    expect(summarizeDiagnostics(null)).toBeNull()
  })

  it('covers every fault kind with a toggle or the time-source control, and reads targeted toggles exactly', () => {
    const covered = new Set<string>([...DEMO_FAULTS.map((spec) => spec.kind), FaultKind.GNSS_LOSS])
    expect([...covered].sort()).toEqual(Object.values(FaultKind).sort())
    const keys = activeFaultKeys([
      { kind: 'TAMPER', target: 'evidence:EV-1:AUDIO-02' },
      { kind: 'MIC_CLIP', target: 'AUDIO-02' },
    ])
    const tamper = DEMO_FAULTS.find((spec) => spec.kind === 'TAMPER')
    const clip = DEMO_FAULTS.find((spec) => spec.kind === 'MIC_CLIP')
    expect(tamper && isSpecActive(keys, tamper)).toBe(false) // the evidence hook is not the enclosure switch
    expect(clip && isSpecActive(keys, clip)).toBe(true)
    expect(timeSourceChoice([])).toBe('GNSS')
    expect(timeSourceChoice([{ kind: 'GNSS_LOSS', target: 'RTC' }])).toBe('RTC')
    expect(timeSourceChoice([{ kind: 'GNSS_LOSS', target: 'NTP' }])).toBe('NTP')
  })

  it('formats the D64 as-of value', () => {
    expect(formatAsOf('2026-10-01T10:00')).toBe('1 Oct 2026, 10:00')
    expect(formatAsOf('unknown')).toBe('unknown')
  })
})

describe('System page sim adapters', () => {
  it('W52-1 (simulator): uptime counts from the boot (service startedAt = the SYSTEM_BOOT row); the audit fallback is memoised', () => {
    const sim = createSim({ storage: null, clock: createManualClock(Date.now()), visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    const state = sim.store.getState()
    const boot = state.audit.rows.find((row) => row.type === 'SYSTEM_BOOT')
    expect(boot).toBeDefined()
    expect(selectServicesSince(state)).toBe(boot?.at)
    expect(uptimeAnchors(state)).toBe(uptimeAnchors(state))
    sim.stop()
  })

  it('W52-4 (simulator): release info is deterministic and version-bound', () => {
    expect(releaseInfo('2.4.1')).toEqual(releaseInfo('2.4.1'))
    expect(releaseInfo('2.4.1').buildId).toMatch(/^dems-core-2\.4\.1\+[0-9a-f]{8}$/)
    expect(releaseInfo('2.4.1').checksum).toMatch(/^sha256:[0-9a-f]{24}$/)
    expect(releaseInfo('2.5.0').checksum).not.toBe(releaseInfo('2.4.1').checksum)
    expect(releaseInfo('2.4.1').components).toBe(27)
  })
})
