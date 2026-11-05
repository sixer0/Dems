// Plan row W50: the data mode of the web console (backend task 04_client_integration_spec §3.1
// MD-1, MD-2, MD-4, MD-5, MD-6; §3.3; §4.1 WT-2a).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-19 dev build, nothing stored, no preselection: Simulated; the simulator is built and the Live module is not requested | "the resolver"; "the entry: Simulated" |
// | AC-C-20 packaged or production build: SIMULATED whatever is stored or set; no choice offered | "the resolver"; "the entry: a build that offers no choice" |
// | AC-C-21 (the entry's half) a stored LIVE builds the Live source and never the simulator | "the entry: Live" |
// | AC-C-22 `VITE_DEMS_CORE_MODE=live` selects Live; a stored SIMULATED wins over it | "the resolver" |
// | AC-C-23 (the runtime's half) a switch signs out, stores the key and reloads to /login | "changing the mode" |
// | WT-2a a Live page under `localhost` is refused with the cause named; Simulated works there | "a page under localhost" |
// | DF-23 / D25 N3 / D29 Q6 (audit row 106): `VITE_DEMS_PRODUCTION_LOCK=1` is LIVE with no Simulated choice anywhere; unset keeps the choice | "the production console lock" |
//
// The confirmation dialog of AC-C-23 is the Login page's and the shell's (rows W54, W55).
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { CORE_MODES, CoreMode } from '@dems/shared/live'
import {
  ALWAYS_VISIBLE,
  AuthStatus,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  selectAuth,
  type Sim,
} from '@dems/shared/sim'
import { i18n } from '@/i18n'
import { CORE_ORIGIN_ENV_KEY, SAME_ORIGIN_CORE } from '@/lib/packaged-csp'
import { bootCoreRuntime, createCoreModeControl, type BootCoreRuntimeOptions } from '@/runtime/boot'
import {
  CORE_MODE_ENV_KEY,
  CORE_MODE_LOCK_ENV_KEY,
  CORE_MODE_STORAGE_KEY,
  CoreModeSource,
  parseCoreModeEnv,
  readStoredCoreMode,
  resolveCoreMode,
  writeStoredCoreMode,
} from '@/runtime/core-mode'
import { createErrorSink } from '@/runtime/error-sink'
import { liveConsoleOrigin, liveHostRefusal } from '@/runtime/live-host'
import { LiveHostRefusalScreen } from '@/runtime/live-host-refusal'
import {
  createLiveTestBed,
  createMemoryStorage,
  createTestLocation,
  SUPERVISOR_SESSION,
  type LiveTestBed,
} from '@/runtime/testing/live-harness'

const sims: Sim[] = []
let bed: LiveTestBed | undefined

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
})

/** A simulator as the route tests build it: no engine ticks, memory storage. */
function simulator(signedIn = true): Sim {
  const authStorage = createMemoryAuthStorage()
  if (signedIn) authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: Date.now() })
  const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  return sim
}

const DEV = { dev: true, packaged: false, stored: null, env: undefined } as const

describe('the resolver (MD-2): one rule decides, in order', () => {
  it('AC-C-19: a dev build with nothing stored and no preselection is Simulated, and the choice is offered', () => {
    expect(resolveCoreMode(DEV)).toEqual({ mode: 'SIMULATED', selectable: true, source: CoreModeSource.DEFAULT })
  })

  it('AC-C-20: a packaged build and a production build are SIMULATED whatever is stored or set, with no choice', () => {
    for (const build of [
      { dev: true, packaged: true },
      { dev: false, packaged: false },
      { dev: false, packaged: true },
    ]) {
      for (const stored of [null, 'LIVE', 'SIMULATED', 'nonsense']) {
        for (const env of [undefined, 'live', 'simulated']) {
          expect(resolveCoreMode({ ...build, stored, env })).toEqual({ mode: 'SIMULATED', selectable: false, source: CoreModeSource.BUILD })
        }
      }
    }
  })

  it('AC-C-21, AC-C-22: a stored value wins; the preselection decides only when nothing valid is stored', () => {
    expect(resolveCoreMode({ ...DEV, stored: 'LIVE' })).toEqual({ mode: 'LIVE', selectable: true, source: CoreModeSource.STORED })
    expect(resolveCoreMode({ ...DEV, stored: 'LIVE', env: 'simulated' }).mode).toBe('LIVE')
    expect(resolveCoreMode({ ...DEV, env: 'live' })).toEqual({ mode: 'LIVE', selectable: true, source: CoreModeSource.ENV })
    // A stored SIMULATED wins over the lane's preselection.
    expect(resolveCoreMode({ ...DEV, stored: 'SIMULATED', env: 'live' })).toEqual({
      mode: 'SIMULATED',
      selectable: true,
      source: CoreModeSource.STORED,
    })
    expect(resolveCoreMode({ ...DEV, env: 'simulated' })).toEqual({ mode: 'SIMULATED', selectable: true, source: CoreModeSource.ENV })
  })

  it('any other stored or environment value counts as absent', () => {
    for (const stored of ['live', 'Live', ' LIVE', 'LIVE ', '', 'true', '1', 'HEARTBEAT', '"LIVE"']) {
      expect(resolveCoreMode({ ...DEV, stored }), `stored ${JSON.stringify(stored)}`).toEqual({
        mode: 'SIMULATED',
        selectable: true,
        source: CoreModeSource.DEFAULT,
      })
      // A stored value that is not valid does not hide the preselection either.
      expect(resolveCoreMode({ ...DEV, stored, env: 'live' }).source).toBe(CoreModeSource.ENV)
    }
    for (const env of ['LIVE', 'Live', ' live', 'true', '1', '', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(parseCoreModeEnv(env), `env ${JSON.stringify(env)}`).toBeNull()
      expect(resolveCoreMode({ ...DEV, env }).source).toBe(CoreModeSource.DEFAULT)
    }
    expect(parseCoreModeEnv(undefined)).toBeNull()
    expect(parseCoreModeEnv(1)).toBeNull()
    expect(parseCoreModeEnv('live')).toBe('LIVE')
    expect(parseCoreModeEnv('simulated')).toBe('SIMULATED')
  })

  it('MD-1: the key and the variable have the names the specification pins, and the key is none of the eight existing ones', () => {
    expect(CORE_MODE_STORAGE_KEY).toBe('dems.core.mode.v1')
    expect(CORE_MODE_ENV_KEY).toBe('VITE_DEMS_CORE_MODE')
    expect([
      'dems.sim.v1',
      'dems.auth',
      'dems.system.prefs.v1',
      'dems.system.demoControls.v1',
      'dems.motion.reduced',
      'dems.shell.rail',
      'dems.presentation.v1',
      'dems.shell.intro',
    ]).not.toContain(CORE_MODE_STORAGE_KEY)
  })

  it('the storage helpers never throw: a storage that fails reads as "nothing stored" and writes as "not stored"', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(readStoredCoreMode(broken)).toBeNull()
    expect(writeStoredCoreMode(broken, CoreMode.LIVE)).toBe(false)
    expect(readStoredCoreMode(null)).toBeNull()
    expect(writeStoredCoreMode(null, CoreMode.LIVE)).toBe(false)
    const storage = createMemoryStorage()
    expect(writeStoredCoreMode(storage, CoreMode.LIVE)).toBe(true)
    expect(storage.getItem('dems.core.mode.v1')).toBe('LIVE')
    expect(readStoredCoreMode(storage)).toBe('LIVE')
  })
})

/** The entry's dependencies as spies: which module was requested, and what was built. */
function entry(overrides: Partial<BootCoreRuntimeOptions> = {}) {
  const sim = simulator(false)
  const createSimSpy = vi.fn(() => sim)
  const loadSimulator = vi.fn(async () => ({ createSim: createSimSpy }))
  let resolveReady!: () => void
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  const liveSource = { ready }
  const stop = vi.fn()
  const startLiveRuntime = vi.fn(() => ({ live: liveSource, sim, owedSignOutPersisted: true, stop }))
  const loadLive = vi.fn(async () => ({ startLiveRuntime }))
  const onSimError = vi.fn()
  const sink = createErrorSink({ dev: false })
  const storage = createMemoryStorage()
  const location = createTestLocation()
  const options = {
    onSimError,
    dev: true,
    packaged: false,
    env: undefined,
    storage,
    location,
    storageEvents: null,
    sink,
    loadSimulator,
    loadLive,
    ...overrides,
  } as unknown as BootCoreRuntimeOptions
  return { options, sim, createSimSpy, loadSimulator, loadLive, startLiveRuntime, resolveReady, stop, onSimError, sink, storage, location }
}

describe('the entry (MD-5): exactly one data source per page load', () => {
  it('AC-C-19: Simulated by default: the simulator is built as before, and the Live module is not requested', async () => {
    const parts = entry()
    const runtime = await bootCoreRuntime(parts.options)
    expect(runtime.kind).toBe('SIMULATED')
    expect(runtime.resolution).toEqual({ mode: 'SIMULATED', selectable: true, source: 'DEFAULT' })
    expect(parts.loadSimulator).toHaveBeenCalledTimes(1)
    // Exactly what `main.tsx` has always passed: `createSim({ onError })`.
    expect(parts.createSimSpy.mock.calls).toEqual([[{ onError: parts.onSimError }]])
    expect(parts.loadLive).not.toHaveBeenCalled()
    expect(parts.startLiveRuntime).not.toHaveBeenCalled()
    if (runtime.kind !== 'SIMULATED') throw new Error('unreachable')
    expect(runtime.sim).toBe(parts.sim)
    expect(runtime.coreMode).toMatchObject({ mode: 'SIMULATED', selectable: true })
  })

  it('AC-C-20: a packaged build (`vi.stubEnv`) is Simulated with a stored LIVE and a preselected live; the stored key is not even read', async () => {
    vi.stubEnv(CORE_ORIGIN_ENV_KEY, SAME_ORIGIN_CORE)
    vi.stubEnv(CORE_MODE_ENV_KEY, 'live')
    const storage = createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'LIVE' })
    const getItem = vi.spyOn(storage, 'getItem')
    // `packaged` and `env` are left to their defaults: the build flags decide.
    const parts = entry({ storage, packaged: undefined, env: undefined })
    const runtime = await bootCoreRuntime(parts.options)
    expect(runtime.kind).toBe('SIMULATED')
    expect(runtime.resolution).toEqual({ mode: 'SIMULATED', selectable: false, source: 'BUILD' })
    expect(parts.loadLive).not.toHaveBeenCalled()
    expect(parts.createSimSpy).toHaveBeenCalledTimes(1)
    expect(getItem).not.toHaveBeenCalled()
    if (runtime.kind !== 'SIMULATED') throw new Error('unreachable')
    expect(runtime.coreMode.selectable).toBe(false)
    // No choice: a switch changes nothing and loads nothing.
    await expect(runtime.coreMode.switchTo(CoreMode.LIVE)).resolves.toBe(false)
    expect(storage.getItem(CORE_MODE_STORAGE_KEY)).toBe('LIVE')
    expect(parts.location.assigned).toEqual([])
  })

  it('AC-C-20, MD-6: a production build, and a build that has no Live module, are Simulated whatever is stored', async () => {
    for (const build of [{ dev: false }, { loadLive: null }] as const) {
      const storage = createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'LIVE' })
      const parts = entry({ storage, env: 'live', ...build })
      const runtime = await bootCoreRuntime(parts.options)
      expect(runtime.kind, JSON.stringify(build)).toBe('SIMULATED')
      expect(runtime.resolution).toEqual({ mode: 'SIMULATED', selectable: false, source: 'BUILD' })
      expect(parts.loadLive).not.toHaveBeenCalled()
      expect(parts.createSimSpy).toHaveBeenCalledTimes(1)
    }
  })

  it('AC-C-21, AC-C-22: a stored LIVE, or the preselection `live`, builds the Live source; the simulator is never built', async () => {
    for (const choice of [{ storage: createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'LIVE' }) }, { env: 'live' }]) {
      const parts = entry(choice)
      let settled = false
      const booting = bootCoreRuntime(parts.options).then((runtime) => {
        settled = true
        return runtime
      })
      for (let turn = 0; turn < 20; turn += 1) await Promise.resolve()
      // §5.1 step 5: the entry waits for the bootstrap of the Live source.
      expect(parts.startLiveRuntime).toHaveBeenCalledTimes(1)
      expect(settled).toBe(false)
      parts.resolveReady()
      const runtime = await booting
      expect(runtime.kind).toBe('LIVE')
      expect(parts.loadLive).toHaveBeenCalledTimes(1)
      expect(parts.loadSimulator).not.toHaveBeenCalled()
      expect(parts.createSimSpy).not.toHaveBeenCalled()
      // The page's own address, the origin's storage and the sink go to the start-up.
      expect(parts.startLiveRuntime.mock.calls[0]).toEqual([
        { location: parts.location, storage: parts.options.storage, sink: parts.sink, storageEvents: null },
      ])
      if (runtime.kind !== 'LIVE') throw new Error('unreachable')
      expect(runtime.coreMode).toMatchObject({ mode: 'LIVE', selectable: true })
      runtime.stop()
      expect(parts.stop).toHaveBeenCalledTimes(1)
    }
  })

  it('a stored SIMULATED on a lane that preselects live is Simulated: the Live module is not requested', async () => {
    const parts = entry({ storage: createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'SIMULATED' }), env: 'live' })
    const runtime = await bootCoreRuntime(parts.options)
    expect(runtime.kind).toBe('SIMULATED')
    expect(runtime.resolution.source).toBe('STORED')
    expect(parts.loadLive).not.toHaveBeenCalled()
  })
})

describe('a page under localhost (WT-2a): Live mode does not start, and says why', () => {
  it('the rule: only http://127.0.0.1 on any port may start Live mode', () => {
    for (const allowed of ['http://127.0.0.1:5173/', 'http://127.0.0.1:5178/login?redirect=%2Fdashboard', 'http://127.0.0.1/']) {
      expect(liveHostRefusal(createTestLocation(allowed)), allowed).toBeNull()
    }
    for (const refused of [
      'http://localhost:5178/',
      'http://LOCALHOST:5178/',
      'http://[::1]:5178/',
      'http://192.168.1.20:5178/',
      'http://127.0.0.2:5178/',
      'http://127.0.0.1.example.test:5178/',
      'https://127.0.0.1:5178/',
    ]) {
      expect(liveHostRefusal(createTestLocation(refused))?.cause, refused).toBe('HOST_NOT_ALLOWED')
    }
  })

  it('the refusal names the address that was opened and the same page at the address to open', () => {
    expect(liveHostRefusal(createTestLocation('http://localhost:5178/login?redirect=%2Fevidence#top'))).toEqual({
      cause: 'HOST_NOT_ALLOWED',
      current: 'http://localhost:5178',
      expected: 'http://127.0.0.1:5178',
      href: 'http://127.0.0.1:5178/login?redirect=%2Fevidence#top',
    })
    // Without a port in the address the expected origin has none either.
    expect(liveConsoleOrigin({ port: '' })).toBe('http://127.0.0.1')
    expect(liveConsoleOrigin({ port: '5176' })).toBe('http://127.0.0.1:5176')
  })

  it('the entry builds NO data source: neither the Live module nor the simulator is requested, and the log names the cause', async () => {
    const storage = createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'LIVE' })
    const location = createTestLocation('http://localhost:5178/dashboard')
    const parts = entry({ storage, location })
    const runtime = await bootCoreRuntime(parts.options)
    expect(runtime.kind).toBe('REFUSED')
    expect(parts.loadLive).not.toHaveBeenCalled()
    expect(parts.startLiveRuntime).not.toHaveBeenCalled()
    // ADQ-7: Live never falls back to the simulator by itself.
    expect(parts.loadSimulator).not.toHaveBeenCalled()
    expect(parts.createSimSpy).not.toHaveBeenCalled()
    if (runtime.kind !== 'REFUSED') throw new Error('unreachable')
    expect(runtime.refusal).toMatchObject({ current: 'http://localhost:5178', expected: 'http://127.0.0.1:5178', href: 'http://127.0.0.1:5178/dashboard' })
    const records = parts.sink.records()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', source: 'runtime.liveHost', context: { cause: 'HOST_NOT_ALLOWED' } })
    expect(records[0]?.message).toContain('http://localhost:5178')
    expect(records[0]?.message).toContain('ORIGIN_NOT_ALLOWED')
    expect(records[0]?.message).toContain('Open http://127.0.0.1:5178/dashboard')

    // The way out: Simulated mode at this address, after a reload.
    expect(runtime.useSimulated()).toBe(true)
    expect(storage.getItem(CORE_MODE_STORAGE_KEY)).toBe('SIMULATED')
    expect(location.reloads).toBe(1)
  })

  it('the preselection of a lane is refused under localhost in the same way', async () => {
    const parts = entry({ env: 'live', location: createTestLocation('http://localhost:5178/') })
    const runtime = await bootCoreRuntime(parts.options)
    expect(runtime.kind).toBe('REFUSED')
    expect(parts.loadLive).not.toHaveBeenCalled()
    expect(parts.loadSimulator).not.toHaveBeenCalled()
  })

  it('Simulated mode under localhost works as before', async () => {
    for (const choice of [{}, { storage: createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'SIMULATED' }), env: 'live' }]) {
      const parts = entry({ ...choice, location: createTestLocation('http://localhost:5173/') })
      const runtime = await bootCoreRuntime(parts.options)
      expect(runtime.kind).toBe('SIMULATED')
      expect(parts.createSimSpy).toHaveBeenCalledTimes(1)
      expect(parts.sink.records()).toEqual([])
    }
  })

  it('the screen shows the cause, links the address to open, and offers Simulated mode', () => {
    const refusal = liveHostRefusal(createTestLocation('http://localhost:5178/login'))
    if (refusal === null) throw new Error('unreachable')
    const onUseSimulated = vi.fn(() => true)
    render(
      <I18nextProvider i18n={i18n}>
        <LiveHostRefusalScreen refusal={refusal} onUseSimulated={onUseSimulated} />
      </I18nextProvider>,
    )
    const screenRoot = screen.getByTestId('live-host-refusal')
    expect(screenRoot).toHaveAttribute('data-cause', 'HOST_NOT_ALLOWED')
    const cause = screen.getByTestId('live-host-refusal-cause').textContent ?? ''
    expect(cause).toContain('http://localhost:5178')
    expect(cause).toContain('http://127.0.0.1:5178')
    const link = screen.getByTestId('live-host-refusal-open')
    expect(link).toHaveAttribute('href', 'http://127.0.0.1:5178/login')
    expect(link.textContent).toContain('http://127.0.0.1:5178/login')
    expect(screen.queryByTestId('live-host-refusal-not-stored')).toBeNull()
    fireEvent.click(screen.getByTestId('live-host-refusal-simulated'))
    expect(onUseSimulated).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('live-host-refusal-not-stored')).toBeNull()
  })

  it('the screen says so when the choice could not be stored', () => {
    const refusal = liveHostRefusal(createTestLocation('http://localhost:5178/'))
    if (refusal === null) throw new Error('unreachable')
    render(
      <I18nextProvider i18n={i18n}>
        <LiveHostRefusalScreen refusal={refusal} onUseSimulated={() => false} />
      </I18nextProvider>,
    )
    fireEvent.click(screen.getByTestId('live-host-refusal-simulated'))
    expect(screen.getByTestId('live-host-refusal-not-stored')).toBeInTheDocument()
  })
})

describe('the production console lock (audit row 106; DF-23, D25 N3, D29 Q6; register S1-S5)', () => {
  it('S1/S2: the variable has the pinned name, and only the exact value `1` turns it on', () => {
    expect(CORE_MODE_LOCK_ENV_KEY).toBe('VITE_DEMS_PRODUCTION_LOCK')
    expect(CoreModeSource.PRODUCTION_LOCK).toBe('PRODUCTION_LOCK')
    for (const lock of [undefined, '', '0', 'true', 'TRUE', ' 1', '1 ', '01', 'yes', 'on']) {
      // Off: a dev run or a lane keeps rules 2 to 4 and the choice.
      expect(resolveCoreMode({ ...DEV, lock }), `lock ${JSON.stringify(lock)}`).toEqual({
        mode: 'SIMULATED',
        selectable: true,
        source: CoreModeSource.DEFAULT,
      })
      expect(resolveCoreMode({ ...DEV, env: 'live', lock })).toEqual({ mode: 'LIVE', selectable: true, source: CoreModeSource.ENV })
    }
  })

  it('S4: set, a dev build is LIVE with no choice, whatever is stored or preselected', () => {
    for (const stored of [null, 'LIVE', 'SIMULATED', 'nonsense']) {
      for (const env of [undefined, 'live', 'simulated']) {
        expect(resolveCoreMode({ ...DEV, stored, env, lock: '1' })).toEqual({
          mode: 'LIVE',
          selectable: false,
          source: CoreModeSource.PRODUCTION_LOCK,
        })
      }
    }
  })

  it('S4: rule 1 still answers first: a packaged or production build is SIMULATED with the lock set', () => {
    for (const build of [
      { dev: true, packaged: true },
      { dev: false, packaged: false },
    ]) {
      expect(resolveCoreMode({ ...build, stored: 'LIVE', env: 'live', lock: '1' })).toEqual({
        mode: 'SIMULATED',
        selectable: false,
        source: CoreModeSource.BUILD,
      })
    }
  })

  it('the entry: the unit\'s variable (`vi.stubEnv`) builds the Live source over a stored SIMULATED, offers no switch, and still hands the storage to the start-up', async () => {
    vi.stubEnv(CORE_MODE_LOCK_ENV_KEY, '1')
    const storage = createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'SIMULATED' })
    // `lock` is left to its default: the unit's environment decides.
    const parts = entry({ storage, lock: undefined })
    const booting = bootCoreRuntime(parts.options)
    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve()
    parts.resolveReady()
    const runtime = await booting
    expect(runtime.kind).toBe('LIVE')
    expect(runtime.resolution).toEqual({ mode: 'LIVE', selectable: false, source: 'PRODUCTION_LOCK' })
    expect(parts.loadSimulator).not.toHaveBeenCalled()
    expect(parts.startLiveRuntime.mock.calls[0]).toEqual([expect.objectContaining({ storage })])
    if (runtime.kind !== 'LIVE') throw new Error('unreachable')
    expect(runtime.coreMode).toMatchObject({ mode: 'LIVE', selectable: false })
    // No Simulated choice: a switch changes nothing and loads nothing.
    await expect(runtime.coreMode.switchTo(CoreMode.SIMULATED)).resolves.toBe(false)
    expect(storage.getItem(CORE_MODE_STORAGE_KEY)).toBe('SIMULATED')
    expect(parts.location.assigned).toEqual([])
    runtime.stop()
  })

  it('the entry: unset, the same stored SIMULATED is Simulated with the choice (the lanes and dev runs keep it)', async () => {
    const parts = entry({ storage: createMemoryStorage({ [CORE_MODE_STORAGE_KEY]: 'SIMULATED' }), env: 'live' })
    const runtime = await bootCoreRuntime(parts.options)
    expect(runtime.kind).toBe('SIMULATED')
    expect(runtime.resolution).toEqual({ mode: 'SIMULATED', selectable: true, source: 'STORED' })
  })

  it('a locked page under localhost is refused, and its way out is NOT Simulated mode', async () => {
    const storage = createMemoryStorage()
    const location = createTestLocation('http://localhost:5178/login')
    const parts = entry({ storage, location, lock: '1' })
    const runtime = await bootCoreRuntime(parts.options)
    expect(runtime.kind).toBe('REFUSED')
    if (runtime.kind !== 'REFUSED') throw new Error('unreachable')
    expect(runtime.resolution.selectable).toBe(false)
    expect(runtime.useSimulated()).toBe(false)
    expect(storage.getItem(CORE_MODE_STORAGE_KEY)).toBeNull()
    expect(location.reloads).toBe(0)
    expect(parts.loadSimulator).not.toHaveBeenCalled()
  })

  it('the refusal screen without a Simulated way out shows the cause and the address only', () => {
    const refusal = liveHostRefusal(createTestLocation('http://localhost:5178/login'))
    if (refusal === null) throw new Error('unreachable')
    render(
      <I18nextProvider i18n={i18n}>
        <LiveHostRefusalScreen refusal={refusal} />
      </I18nextProvider>,
    )
    expect(screen.getByTestId('live-host-refusal-open')).toHaveAttribute('href', 'http://127.0.0.1:5178/login')
    expect(screen.queryByTestId('live-host-refusal-simulated')).toBeNull()
    expect(screen.getByTestId('live-host-refusal').textContent).not.toContain(en.common.liveHost.simulatedNote)
  })
})

describe('the shared words of the mode (`common.coreMode`)', () => {
  it('every map is keyed by the two wire values of the mode, and the sentence of §3.3 is the confirmation text', () => {
    const words = en.common.coreMode
    for (const map of [words.chip, words.name, words.switchTitle, words.switchConfirm]) {
      expect(Object.keys(map).sort()).toEqual([...CORE_MODES].sort())
    }
    expect(words.chip).toEqual({ SIMULATED: 'SIMULATED', LIVE: 'LIVE' })
    expect(words.chipOffline).toBe('LIVE · OFFLINE')
    expect(words.chipReconnecting).toBe('LIVE · RECONNECTING')
    expect(`${words.switchTitle.LIVE} ${words.switchBody}`).toBe(
      'Switch to Live mode? You will be signed out and the console reloads. Simulated data and Live data are separate.',
    )
    // §3.5: the link notice and its two actions.
    expect(`${en.common.coreLink.lostTitle}. ${en.common.coreLink.lostBody}`).toBe(
      'Core server unreachable. The screen shows the last state received. Reconnecting…',
    )
    expect(en.common.coreLink.retryNow).toBe('Retry now')
    expect(words.switchConfirm.SIMULATED).toBe('Switch to Simulated mode')
    expect(en.common.coreLink.restored).toBe('Reconnected to the Core')
    expect(en.common.coreLink.starting).toBe('The Core server is starting')
    expect(words.useSimulated).toBe('Use Simulated mode')
  })
})

describe('changing the mode (§3.3 steps 2 to 4; AC-C-23): sign out, store, reload to /login', () => {
  const selectable = { mode: CoreMode.SIMULATED, selectable: true, source: CoreModeSource.DEFAULT } as const

  it('Simulated to Live: the simulator is signed out and flushed, the key is written, the page is loaded again at /login', async () => {
    const sim = simulator()
    expect(selectAuth(sim.store.getState()).status).toBe(AuthStatus.SIGNED_IN)
    const storage = createMemoryStorage()
    const location = createTestLocation()
    const order: string[] = []
    const signOut = vi.spyOn(sim.actions, 'signOut').mockImplementation((reason) => {
      order.push(`signOut:${String(reason)}`)
      sim.store.setState((state) => ({ auth: { ...state.auth, status: AuthStatus.SIGNED_OUT, operatorId: null } }))
    })
    vi.spyOn(sim, 'flush').mockImplementation(() => void order.push('flush'))
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => void order.push(`store:${key}=${value}`))
    const stop = vi.fn(() => void order.push('stop'))
    vi.spyOn(location, 'assign').mockImplementation((url) => void order.push(`assign:${url}`))
    const control = createCoreModeControl({ resolution: selectable, sim, storage, location, sink: createErrorSink({ dev: false }), stop })

    await expect(control.switchTo(CoreMode.LIVE)).resolves.toBe(true)
    expect(order).toEqual(['signOut:USER', 'flush', 'store:dems.core.mode.v1=LIVE', 'stop', 'assign:/login'])
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('with nobody signed in no sign-out is sent, and the rest is the same', async () => {
    const sim = simulator(false)
    const signOut = vi.spyOn(sim.actions, 'signOut')
    const storage = createMemoryStorage()
    const location = createTestLocation()
    const control = createCoreModeControl({ resolution: selectable, sim, storage, location, sink: createErrorSink({ dev: false }), stop: vi.fn() })
    await expect(control.switchTo(CoreMode.LIVE)).resolves.toBe(true)
    expect(signOut).not.toHaveBeenCalled()
    expect(storage.getItem(CORE_MODE_STORAGE_KEY)).toBe('LIVE')
    expect(location.assigned).toEqual(['/login'])
  })

  it('nothing happens when the build offers no choice, when the mode is already the one asked for, or when nothing can be stored', async () => {
    const sink = createErrorSink({ dev: false })
    const cases = [
      { resolution: { ...selectable, selectable: false }, storage: createMemoryStorage(), next: CoreMode.LIVE, reports: 0 },
      { resolution: selectable, storage: createMemoryStorage(), next: CoreMode.SIMULATED, reports: 0 },
      // No storage: asked BEFORE anybody is signed out, so the session stays.
      { resolution: selectable, storage: null, next: CoreMode.LIVE, reports: 1 },
    ] as const
    for (const { resolution, storage, next, reports } of cases) {
      sink.clear()
      const sim = simulator()
      const signOut = vi.spyOn(sim.actions, 'signOut')
      const location = createTestLocation()
      const stop = vi.fn()
      const control = createCoreModeControl({ resolution, sim, storage, location, sink, stop })
      await expect(control.switchTo(next)).resolves.toBe(false)
      expect(signOut).not.toHaveBeenCalled()
      expect(stop).not.toHaveBeenCalled()
      expect(location.assigned).toEqual([])
      expect(selectAuth(sim.store.getState()).status).toBe(AuthStatus.SIGNED_IN)
      expect(sink.records().map((record) => record.source)).toEqual(Array.from({ length: reports }, () => 'runtime.modeSwitch'))
    }
  })

  it('a storage that refuses the write leaves the mode as it is: no reload, and the log says why', async () => {
    const sim = simulator(false)
    const storage = createMemoryStorage()
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const location = createTestLocation()
    const sink = createErrorSink({ dev: false })
    const stop = vi.fn()
    const control = createCoreModeControl({ resolution: selectable, sim, storage, location, sink, stop })
    await expect(control.switchTo(CoreMode.LIVE)).resolves.toBe(false)
    expect(location.assigned).toEqual([])
    expect(stop).not.toHaveBeenCalled()
    expect(sink.records()).toHaveLength(1)
    expect(sink.records()[0]).toMatchObject({ level: 'error', source: 'runtime.modeSwitch', context: { from: 'SIMULATED', to: 'LIVE' } })
  })

  it('Live to Simulated: ONE sign-out reaches the Core, the source is stopped, the key is written, the page is loaded again at /login', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_IN)
    const control = createCoreModeControl({
      resolution: { mode: CoreMode.LIVE, selectable: true, source: CoreModeSource.STORED },
      sim: page.runtime.sim,
      storage: bed.storage,
      location: bed.location,
      sink: page.sink,
      stop: () => page.runtime.stop(),
    })
    const switching = control.switchTo(CoreMode.SIMULATED)
    await bed.flush()
    await expect(switching).resolves.toBe(true)
    const signOuts = bed.fake.log.requestsOf('signOut')
    expect(signOuts).toHaveLength(1)
    expect(signOuts[0]?.body).toEqual({ reason: 'USER' })
    expect(bed.core.alive()).toBe(false)
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
    expect(page.live.isRunning()).toBe(false)
    expect(bed.storage?.getItem(CORE_MODE_STORAGE_KEY)).toBe('SIMULATED')
    expect(bed.location.assigned).toEqual(['/login'])
  })

  it('Live to Simulated with the Core unreachable: the session ends here, and the switch still completes', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    bed.core.unreachable()
    await bed.flush()
    const control = createCoreModeControl({
      resolution: { mode: CoreMode.LIVE, selectable: true, source: CoreModeSource.STORED },
      sim: page.runtime.sim,
      storage: bed.storage,
      location: bed.location,
      sink: page.sink,
      stop: () => page.runtime.stop(),
    })
    const switching = control.switchTo(CoreMode.SIMULATED)
    await bed.flush()
    await expect(switching).resolves.toBe(true)
    // Nothing could be sent; the session ended on this console (brief list row 16).
    expect(bed.fake.log.requestsOf('signOut')).toHaveLength(0)
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
    expect(bed.storage?.getItem(CORE_MODE_STORAGE_KEY)).toBe('SIMULATED')
    expect(bed.location.assigned).toEqual(['/login'])
  })
})
