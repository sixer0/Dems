/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W76: the Demo Control Panel of the System page in Live mode on the contract-checked fake
// transport — the gate (AC-C-52, DC-3), settle sites B-10 (its commands), C-7 (the toast's audit note)
// and D-4 (several requests of one press; a reset or a scenario load that settles on the snapshot of
// the new epoch) — and the panel in Simulated mode as the control group (backend task
// 04_client_integration_spec §7.3 G14, §8.3 B-10, §8.4 C-7, D-4, §6.2, AC-C-48, AC-C-52; gate CLG (b)).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-52: rendered in Live mode only with `DEMO_CONTROL` AND `demoControls`; absent for a holder on a Core without the flag, and for roles without the permission; it follows a role change; in Simulated mode as today | "AC-C-52 the gate" |
// | B-10 success: one POST to operation 73 with the kind, the toast after the answer | "B-10 the panel's commands" |
// | B-10 refusal, AC-C-48: the `notPermitted` 403 names the Supervisor role; a 403 DEMO_DISABLED is shown truthfully; an outage | "B-10 the panel's commands" |
// | C-7: the note names the row of THIS command, not the newest row of the ring (another console's, or another fault) | "C-7 the audit note" |
// | D-4: clearing MIC 2 clip sends the clear, then the latch reset only after the clear was answered; a refused first step sends no second | "D-4 one request after the other" |
// | D-4 / CL-18: a reset is confirmed first, settles only when the snapshot of the new epoch is applied, refusal / DEMO_DISABLED / outage / 503 while the Core rebuilds | "D-4 reset and scenario load" |
// | LB-1: one demo command at a time; the panel body is marked busy | "B-10 the panel's commands" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickReplicatedState, type AuthSessionInfo, type ReplicatedState } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { OUTAGE, refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  appendAudit,
  createIdleState,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  DEFAULT_SEED,
  OPERATOR_IDS,
  OPERATORS,
  ROLE_PERMISSIONS,
  type AuditRow,
  type Sim,
  type SimState,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, INVESTIGATOR_SESSION, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'
import { newestOwnRow } from '@/features/system/live'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const RINA = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.RINA)!
const TECHNICIAN_SESSION: Pick<AuthSessionInfo, 'operator' | 'permissions'> = {
  operator: { id: RINA.id, username: RINA.username, rank: RINA.rank, name: RINA.name, displayName: RINA.displayName, initials: RINA.initials, role: RINA.role },
  permissions: [...ROLE_PERMISSIONS.TECHNICIAN],
}

const D = en.system.demo
const L = en.system.live.demo
const DENIED = en.common.rbac.deniedTitle
const REQUIRES = (role: string) => en.common.rbac.requiresRole.replace('{{role}}', role)
const OFFLINE = en.common.coreErrors.offline
const STARTING = en.common.coreErrors.starting
const DEMO_DISABLED = en.common.coreErrors.demoDisabled
const INJECTED = (fault: string) => D.injected.replace('{{fault}}', fault)
const CLEARED = (fault: string) => D.cleared.replace('{{fault}}', fault)

const originalMatchMedia = window.matchMedia
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const toastWith = (text: string) => toastTexts().filter((entry) => entry.includes(text))

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

let bed: LiveTestBed | undefined
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState)

interface LiveOptions {
  readonly session?: Pick<AuthSessionInfo, 'operator' | 'permissions'>
  /** The server-side demo flag the Core reports in the session (DC-3). Default: on. */
  readonly demoControls?: boolean
  readonly served?: (idle: SimState) => SimState
}

/** A signed-in operator on the System page in Live mode; the Core reports its demo flag in the session. */
async function liveSystem(options: LiveOptions = {}): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session: options.session ?? SUPERVISOR_SESSION })
  bed = created
  if (options.served) created.core.served = options.served(created.core.served)
  const flag = options.demoControls ?? true
  created.fake.answer('getAuthSession', () =>
    !created.core.reachable ? OUTAGE : created.core.alive() ? { status: 200, body: { ...created.core.info(), demoControls: flag } } : created.fake.example('getAuthSession', 401),
  )
  const page = await created.load()
  await created.mount(page, '/system')
  await screen.findByTestId('page-system')
  await screen.findByTestId('system-panel-settings')
  return { bed: created, page }
}

/** Opens the panel's body with its switch. */
async function openPanel() {
  const panel = screen.getByTestId('system-panel-demo')
  fireEvent.click(within(within(panel).getByTestId('system-demo-toggle')).getByRole('switch'))
  return within(await within(panel).findByTestId('system-demo-body'))
}

/** The Core's next audit row on top of what it serves (hash-chained). */
function nextRows(base: SimState, inputs: Parameters<typeof appendAudit>[1][]): { rows: AuditRow[]; head: string; total: number; dropped: number } {
  let log = base.audit
  const rows: AuditRow[] = []
  for (const input of inputs) {
    const appended = appendAudit(log, input, (log.rows.at(-1)?.at ?? 0) + 1_000)
    log = appended.log
    rows.push(appended.row)
  }
  return { rows, head: log.head, total: log.total, dropped: log.dropped }
}

const faultsOp = (active: SimState['faults']['active']) => ({ op: 'replace', slice: 'faults', value: { active } })

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('AC-C-52 the gate (DC-3)', () => {
  it('a SUPERVISOR (DEMO_CONTROL) on a Core with the demo flag: the panel is rendered, labelled DEMO', async () => {
    await liveSystem()
    expect(screen.getByTestId('system-panel-demo')).toBeInTheDocument()
    expect(screen.getByTestId('system-demo-badge')).toHaveTextContent(D.badge)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the same SUPERVISOR on a Core WITHOUT the demo flag: no panel at all', async () => {
    await liveSystem({ demoControls: false })
    expect(screen.queryByTestId('system-panel-demo')).toBeNull()
    expect(screen.queryByTestId('system-demo-toggle')).toBeNull()
  })

  it('an INVESTIGATOR and a TECHNICIAN (no DEMO_CONTROL) on a Core WITH the flag: no panel', async () => {
    await liveSystem({ session: INVESTIGATOR_SESSION })
    expect(screen.queryByTestId('system-panel-demo')).toBeNull()
    cleanup()
    bed?.dispose()
    bed = undefined
    await liveSystem({ session: TECHNICIAN_SESSION })
    expect(screen.queryByTestId('system-panel-demo')).toBeNull()
  })

  it('a role change pushed by the Core (DEMO_CONTROL lost) removes the panel without a reload; nothing of it was requested', async () => {
    const { bed } = await liveSystem()
    expect(screen.getByTestId('system-panel-demo')).toBeInTheDocument()
    await act(async () => {
      bed.core.changeRole('INVESTIGATOR', [...ROLE_PERMISSIONS.INVESTIGATOR])
    })
    await bed.flush()
    await waitFor(() => expect(screen.queryByTestId('system-panel-demo')).toBeNull())
    for (const operation of ['getDemoStatus', 'injectFault', 'clearFault', 'loadScenario', 'resetDemo']) expect(requests(operation)).toHaveLength(0)
  })
})

describe('B-10 the panel\'s commands (§8.3)', () => {
  it('success: one POST to operation 73 with the kind; the warning toast after the answer', async () => {
    const { bed } = await liveSystem()
    const served = bed.core.served
    const audit = nextRows(served, [{ type: 'FAULT_RAISED', message: 'Fan stall', severity: 'WARNING', details: { kind: 'FAN_STALL' } }])
    bed.fake.scriptCommand('injectFault', {
      ops: [faultsOp([{ kind: 'FAN_STALL', since: bed.fake.clock.now(), target: null }]), { op: 'append', slice: 'audit', ...audit }] as FakeCommandOptions['ops'],
      order: 'delta-first',
      answer: { status: 204 },
    })
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-fault-FAN_STALL'))
    await waitFor(() => expect(toastWith(INJECTED(D.faults.FAN_STALL))).toHaveLength(1))
    expect(requests('injectFault')).toHaveLength(1)
    expect(requests('injectFault')[0]).toMatchObject({ method: 'POST', path: '/api/v1/demo/faults', body: { kind: 'FAN_STALL' } })
    await waitFor(() => expect(body.getByTestId('system-demo-fault-FAN_STALL')).toHaveAttribute('aria-pressed', 'true'))
    expect(body.getByTestId('system-demo-fault-FAN_STALL')).not.toHaveAttribute('data-pending')
    expect(screen.getByTestId('system-demo-body')).not.toHaveAttribute('aria-busy')
  })

  it('AC-C-48: the `notPermitted` 403 names the Supervisor role; the fault stays off; the control is idle again', async () => {
    const { bed } = await liveSystem()
    bed.fake.answerOnce('injectFault', bed.fake.example('injectFault', 403, 'notPermitted'))
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-fault-FAN_STALL'))
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.SUPERVISOR))
    expect(toastWith(INJECTED(D.faults.FAN_STALL))).toHaveLength(0)
    expect(body.getByTestId('system-demo-fault-FAN_STALL')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('system-demo-body')).not.toHaveAttribute('aria-busy')
  })

  it('a 403 DEMO_DISABLED (the flag went off while the panel was open) is shown truthfully, never as a role refusal', async () => {
    const { bed } = await liveSystem()
    bed.fake.answerOnce('injectFault', bed.fake.example('injectFault', 403, 'demoDisabled'))
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-fault-FAN_STALL'))
    await waitFor(() => expect(toastWith(DEMO_DISABLED)).toHaveLength(1))
    expect(toastWith(DENIED)).toHaveLength(0)
    expect(toastWith(OFFLINE)).toHaveLength(0)
  })

  it('an outage: the presenter\'s sentence, no success toast', async () => {
    const { bed } = await liveSystem()
    bed.fake.failOnce('injectFault')
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-fault-FAN_STALL'))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(INJECTED(D.faults.FAN_STALL))).toHaveLength(0)
  })

  it('LB-1: while one demo command is out the panel sends no other; the body is marked busy', async () => {
    const { bed } = await liveSystem()
    const held = bed.fake.hold('injectFault')
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-fault-FAN_STALL'))
    await waitFor(() => expect(requests('injectFault')).toHaveLength(1))
    await bed.flush()
    expect(screen.getByTestId('system-demo-body')).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(body.getByTestId('system-demo-fault-TAMPER'))
    fireEvent.click(body.getByTestId('system-demo-time-NTP'))
    await bed.flush()
    expect(requests('injectFault')).toHaveLength(1)
    await act(async () => {
      held.release({ status: 204 })
    })
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('system-demo-body')).not.toHaveAttribute('aria-busy'))
  })
})

describe('C-7 the audit note (§8.4)', () => {
  it('names the row of THIS command although the newest rows of the ring are another console\'s and another fault\'s', async () => {
    const { bed } = await liveSystem()
    const audit = nextRows(bed.core.served, [
      { type: 'FAULT_RAISED', message: 'Fan stall', severity: 'WARNING', details: { kind: 'FAN_STALL' } },
      { type: 'DEVICE_COMMAND', message: 'Identify', actorId: OPERATOR_IDS.RINA, deviceId: 'CAM-01', details: { command: 'IDENTIFY' } },
      { type: 'FAULT_RAISED', message: 'Storage low', severity: 'WARNING', details: { kind: 'STORAGE_LOW' } },
    ])
    const [own, foreign, other] = audit.rows as [AuditRow, AuditRow, AuditRow]
    bed.fake.scriptCommand('injectFault', {
      ops: [faultsOp([{ kind: 'FAN_STALL', since: bed.fake.clock.now(), target: null }]), { op: 'append', slice: 'audit', ...audit }] as FakeCommandOptions['ops'],
      order: 'delta-first',
      answer: { status: 204 },
    })
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-fault-FAN_STALL'))
    await waitFor(() => expect(toastWith(INJECTED(D.faults.FAN_STALL))).toHaveLength(1))
    const note = toastWith(INJECTED(D.faults.FAN_STALL))[0]!
    expect(note).toContain(own.id)
    expect(note).toContain(en.common.auditType.FAULT_RAISED)
    expect(note).not.toContain(foreign.id)
    expect(note).not.toContain(other.id)
    expect(note).not.toContain(en.common.auditType.DEVICE_COMMAND)
  })

  it('no row of the command in the ring: the toast carries no note rather than a wrong one', async () => {
    const { bed } = await liveSystem()
    const audit = nextRows(bed.core.served, [{ type: 'DEVICE_COMMAND', message: 'Identify', actorId: OPERATOR_IDS.RINA, deviceId: 'CAM-01', details: { command: 'IDENTIFY' } }])
    bed.fake.scriptCommand('injectFault', {
      ops: [faultsOp([{ kind: 'FAN_STALL', since: bed.fake.clock.now(), target: null }]), { op: 'append', slice: 'audit', ...audit }] as FakeCommandOptions['ops'],
      order: 'delta-first',
      answer: { status: 204 },
    })
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-fault-FAN_STALL'))
    await waitFor(() => expect(toastWith(INJECTED(D.faults.FAN_STALL))).toHaveLength(1))
    expect(toastWith(INJECTED(D.faults.FAN_STALL))[0]).not.toContain('Audit:')
  })
})

describe('C-7 the row of a command, as a pure rule (`newestOwnRow`)', () => {
  const ring = nextRows(createIdleState({ now: Date.parse('2026-10-05T08:00:00+07:00'), seed: DEFAULT_SEED }), [
    { type: 'FAULT_RAISED', message: 'Fan stall (earlier)', severity: 'WARNING', details: { kind: 'FAN_STALL' } },
    { type: 'FAULT_RAISED', message: 'Fan stall (another operator)', severity: 'WARNING', actorId: OPERATOR_IDS.RINA, details: { kind: 'FAN_STALL' } },
  ])
  const [earlier, foreign] = ring.rows as [AuditRow, AuditRow]
  const query = { types: ['FAULT_RAISED'] as const, operatorId: OPERATOR_IDS.ANDI, kind: 'FAN_STALL' }

  it('a row of the same type and kind written by ANOTHER operator is not this command\'s', () => {
    expect(newestOwnRow(ring.rows, { ...query, afterSeq: earlier.seq })).toBeUndefined()
    expect(foreign.actorId).toBe(OPERATOR_IDS.RINA)
  })

  it('a row from before the press is not this command\'s; a row without actor after it is', () => {
    expect(newestOwnRow([earlier], { ...query, afterSeq: earlier.seq })).toBeUndefined()
    expect(newestOwnRow([earlier], { ...query, afterSeq: earlier.seq - 1 })).toBe(earlier)
  })
})

describe('D-4 one request after the other (§8.4)', () => {
  const withClip = (idle: SimState): SimState => ({ ...idle, faults: { active: [{ kind: 'MIC_CLIP', since: idle.clock.now, target: 'AUDIO-02' }] } })

  it('clearing MIC 2 clip: operation 74, and the latch reset (operation 52) only after the clear was answered; one toast at the end', async () => {
    const { bed } = await liveSystem({ served: withClip })
    const heldClear = bed.fake.hold('clearFault')
    bed.fake.answerOnce('resetMicClip', { status: 204 })
    const body = await openPanel()
    expect(body.getByTestId('system-demo-fault-MIC_CLIP')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(body.getByTestId('system-demo-fault-MIC_CLIP'))
    await waitFor(() => expect(requests('clearFault')).toHaveLength(1))
    await bed.flush()
    expect(requests('clearFault')[0]).toMatchObject({ body: { kind: 'MIC_CLIP', target: { channel: 'AUDIO-02' } } })
    expect(requests('resetMicClip')).toHaveLength(0)
    expect(toastWith(CLEARED(D.faults.MIC_CLIP))).toHaveLength(0)

    await act(async () => {
      heldClear.release({ status: 204 })
    })
    await waitFor(() => expect(requests('resetMicClip')).toHaveLength(1))
    expect(requests('resetMicClip')[0]).toMatchObject({ body: { channel: 'AUDIO-02' } })
    expect(requests('resetMicClip')[0]!.seq).toBeGreaterThan(requests('clearFault')[0]!.seq)
    await waitFor(() => expect(toastWith(CLEARED(D.faults.MIC_CLIP))).toHaveLength(1))
  })

  it('a refused first step sends no second: the denied toast, no latch reset, no success toast', async () => {
    const { bed } = await liveSystem({ served: withClip })
    bed.fake.answerOnce('clearFault', bed.fake.example('clearFault', 403, 'notPermitted'))
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-fault-MIC_CLIP'))
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    await bed.flush()
    expect(requests('resetMicClip')).toHaveLength(0)
    expect(toastWith(CLEARED(D.faults.MIC_CLIP))).toHaveLength(0)
  })

  it('Clear all: each active kind, then both latches, strictly in order', async () => {
    const both = (idle: SimState): SimState => ({
      ...idle,
      faults: { active: [{ kind: 'MIC_CLIP', since: idle.clock.now, target: 'AUDIO-02' }, { kind: 'FAN_STALL', since: idle.clock.now, target: null }] },
    })
    const { bed } = await liveSystem({ served: both })
    bed.fake.answer('clearFault', { status: 204 })
    bed.fake.answer('resetMicClip', { status: 204 })
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-clear-all'))
    await waitFor(() => expect(toastWith(D.clearedAll)).toHaveLength(1))
    const order = bed.fake.log.operationIds().filter((id) => id === 'clearFault' || id === 'resetMicClip')
    expect(order).toEqual(['clearFault', 'clearFault', 'resetMicClip', 'resetMicClip'])
    expect(requests('clearFault').map((call) => (call.body as { kind: string }).kind)).toEqual(['MIC_CLIP', 'FAN_STALL'])
    expect(requests('resetMicClip').map((call) => (call.body as { channel: string }).channel)).toEqual(['AUDIO-01', 'AUDIO-02'])
  })
})

describe('D-4 reset and scenario load (CL-18)', () => {
  /** Answers the reset or the load with a new epoch; the snapshot of that epoch is sent when the test says. */
  function scriptRebuild(operationId: 'resetDemo' | 'loadScenario', state: (now: number) => SimState) {
    let epoch: number | null = null
    bed!.fake.answerOnce(operationId, () => {
      epoch = bed!.fake.startEpoch().epoch
      return { status: 200, body: { epoch }, epoch, revision: 0 }
    })
    return {
      sendSnapshot: () => {
        if (epoch === null) throw new Error('the rebuild was not asked for')
        bed!.fake.connection().snapshot(wire(state(bed!.fake.clock.now())), { epoch, revision: 0 })
      },
      epoch: () => epoch,
    }
  }

  it('Reset asks first; Cancel sends nothing', async () => {
    await liveSystem()
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-reset'))
    const dialog = await screen.findByTestId('system-demo-confirm')
    expect(dialog).toHaveTextContent(L.confirmResetTitle)
    expect(dialog).toHaveTextContent(L.confirmBody)
    fireEvent.click(within(dialog).getByTestId('system-demo-confirm-keep'))
    await waitFor(() => expect(screen.queryByTestId('system-demo-confirm')).toBeNull())
    expect(requests('resetDemo')).toHaveLength(0)
  })

  it('confirmed: one POST to operation 75; the toast waits for the snapshot of the NEW epoch, not for the answer', async () => {
    const fanStall = (idle: SimState): SimState => ({ ...idle, faults: { active: [{ kind: 'FAN_STALL', since: idle.clock.now, target: null }] } })
    const { bed, page } = await liveSystem({ served: fanStall })
    const epochBefore = bed.fake.position.epoch
    const rebuild = scriptRebuild('resetDemo', (now) => createIdleState({ now, seed: DEFAULT_SEED }))
    const body = await openPanel()
    expect(body.getByTestId('system-demo-active-count')).toHaveTextContent(D.activeCount_one.replace('{{count}}', '1'))
    fireEvent.click(body.getByTestId('system-demo-reset'))
    fireEvent.click(within(await screen.findByTestId('system-demo-confirm')).getByTestId('system-demo-confirm-go'))
    await waitFor(() => expect(requests('resetDemo')).toHaveLength(1))
    await bed.flush()
    expect(requests('resetDemo')[0]).toMatchObject({ method: 'POST', path: '/api/v1/demo/reset' })
    expect(rebuild.epoch()).toBe(epochBefore + 1)
    // Answered, but the snapshot of the new epoch has not arrived: nothing is announced yet.
    expect(toastWith(D.resetDone)).toHaveLength(0)
    expect(screen.getByTestId('system-demo-body')).toHaveAttribute('aria-busy', 'true')
    expect(page.live.store.getState().faults.active).toHaveLength(1)

    await act(async () => {
      rebuild.sendSnapshot()
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(D.resetDone)).toHaveLength(1))
    // CL-18: when the toast shows, the store already holds the new epoch's dataset (no fault).
    expect(page.live.store.getState().faults.active).toHaveLength(0)
    expect(body.getByTestId('system-demo-active-count')).toHaveTextContent(D.activeCount_other.replace('{{count}}', '0'))
    expect(screen.getByTestId('system-demo-body')).not.toHaveAttribute('aria-busy')
  })

  it('a scenario load: confirmed, one POST with the name, the toast after the snapshot of the new epoch', async () => {
    await liveSystem()
    const rebuild = scriptRebuild('loadScenario', (now) => ({ ...createIdleState({ now, seed: DEFAULT_SEED }), meta: { ...createIdleState({ now, seed: DEFAULT_SEED }).meta, scenario: 'recording' } }))
    const body = await openPanel()
    fireEvent.click(within(body.getByTestId('system-demo-scenario')).getByRole('button'))
    fireEvent.click(await screen.findByRole('option', { name: D.scenarios.recording }))
    fireEvent.click(body.getByTestId('system-demo-load'))
    const dialog = await screen.findByTestId('system-demo-confirm')
    expect(dialog).toHaveTextContent(L.confirmScenarioTitle.replace('{{scenario}}', D.scenarios.recording))
    fireEvent.click(within(dialog).getByTestId('system-demo-confirm-go'))
    await waitFor(() => expect(requests('loadScenario')).toHaveLength(1))
    expect(requests('loadScenario')[0]).toMatchObject({ body: { name: 'recording' } })
    await act(async () => {
      rebuild.sendSnapshot()
    })
    await waitFor(() => expect(toastWith(D.scenarioLoaded.replace('{{scenario}}', D.scenarios.recording))).toHaveLength(1))
  })

  it('AC-C-48: the `notPermitted` 403 of operation 75 names the Supervisor role; a 403 DEMO_DISABLED is the flag\'s sentence; an outage the outage\'s', async () => {
    const { bed } = await liveSystem()
    const body = await openPanel()
    const resetOnce = async () => {
      fireEvent.click(body.getByTestId('system-demo-reset'))
      fireEvent.click(within(await screen.findByTestId('system-demo-confirm')).getByTestId('system-demo-confirm-go'))
      await bed.flush()
    }
    bed.fake.answerOnce('resetDemo', bed.fake.example('resetDemo', 403, 'notPermitted'))
    await resetOnce()
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.SUPERVISOR))

    bed.fake.answerOnce('resetDemo', bed.fake.example('resetDemo', 403, 'demoDisabled'))
    await resetOnce()
    await waitFor(() => expect(toastWith(DEMO_DISABLED)).toHaveLength(1))

    bed.fake.failOnce('resetDemo')
    await resetOnce()
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(D.resetDone)).toHaveLength(0)
    expect(requests('resetDemo')).toHaveLength(3)
  })

  it('a 503 while the Core rebuilds (another reset holds it) reads "The Core server is starting"; nothing is announced (CONTRACT-GAP-W76-1: `details.reason` does not reach the page)', async () => {
    const { bed } = await liveSystem()
    bed.fake.answerOnce('resetDemo', refusal(503, 'NOT_READY', 'The Core server is not ready.', { reason: 'RESET_IN_PROGRESS' }))
    const body = await openPanel()
    fireEvent.click(body.getByTestId('system-demo-reset'))
    fireEvent.click(within(await screen.findByTestId('system-demo-confirm')).getByTestId('system-demo-confirm-go'))
    await waitFor(() => expect(toastWith(STARTING)).toHaveLength(1))
    expect(toastWith(D.resetDone)).toHaveLength(0)
  })
})

// ── The control group: the panel in Simulated mode, as before this row ───────────────────────

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

describe('Simulated mode is unchanged (AC-C-52, second half)', () => {
  const sims: Sim[] = []
  afterEach(() => {
    for (const sim of sims.splice(0)) sim.stop()
  })

  it('an INVESTIGATOR sees the panel as today; a reset asks nothing and lands in the press', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    const clock = createManualClock(Date.now())
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: clock.now() })
    const sim = createSim({ storage: null, authStorage, clock, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined, scenario: 'recording' })
    sims.push(sim)
    const router = createAppRouter(
      { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/system'] }) },
    )
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-system')
    expect(screen.getByTestId('system-panel-demo')).toBeInTheDocument()
    const body = await openPanel()
    expect(screen.getByTestId('system-demo-asof')).toHaveTextContent('Simulator clock')
    fireEvent.click(body.getByTestId('system-demo-reset'))
    expect(screen.queryByTestId('system-demo-confirm')).toBeNull()
    expect(sim.store.getState().meta.scenario).toBe('idle')
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('SCENARIO_LOADED')
    await waitFor(() => expect(toastWith(D.resetDone)).toHaveLength(1))
    vi.unstubAllGlobals()
  })
})
