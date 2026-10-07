// CPW1-7 (closing-fix round C2; decision D190 O-7): what `main.tsx` does when the start-up of its
// data source rejects. Before the fix `#root` stayed empty (a white page and an unhandled rejection).
//
// | Holds | How it is seen here |
// |-------|---------------------|
// | One static sentence in `#root` | The text of `#root`, one `role="alert"` element |
// | No fallback to the simulator (AC-C-25, ADQ-7) | `createSim` and `createAppRouter` are never called; the start-up is asked once |
// | One record in the page's own log, without the error's text | `webErrorSink.records()`; a marker in the error message is in no record, no console line and not on the page |
// | No unhandled rejection | Importing `main.tsx` resolves |
//
// `main.tsx` is the module under test, imported once per case after `vi.resetModules()`. The
// start-up, the router and the simulator's constructor are replaced by spies; i18n is the real one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spies = vi.hoisted(() => ({
  bootCoreRuntime: vi.fn(),
  createAppRouter: vi.fn(),
  createSim: vi.fn(),
}))

vi.mock('../runtime/boot', () => ({ bootCoreRuntime: spies.bootCoreRuntime }))
vi.mock('../router', () => ({ createAppRouter: spies.createAppRouter }))
vi.mock('@dems/shared/sim', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dems/shared/sim')>()),
  createSim: spies.createSim,
}))

/**
 * FXR-W W92-2: makes `await import(...)` of one start-up chunk reject, as a chunk the browser cannot
 * fetch does (for example after a rebuild renamed the chunks under an open tab). `vi.doMock` replaces
 * the module for the next import only; `afterEach` puts the hoisted mocks back.
 */
function failChunk(path: '../router' | '../i18n' | '../runtime/live-host-refusal', error: unknown) {
  vi.doMock(path, () => {
    throw error
  })
}

const SENTENCE = 'The console could not start; reload the page to try again.'
/** Stands for what a start-up error may carry: a token-like value and an address. */
const MARKER = 'c2-marker-7f3a'
const ERROR_TEXT = `ses_${MARKER} at http://127.0.0.1:4100/api/v1/${MARKER}`

beforeEach(() => {
  vi.resetModules()
  for (const spy of Object.values(spies)) spy.mockReset()
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.doMock('../router', () => ({ createAppRouter: spies.createAppRouter }))
  vi.doUnmock('../i18n')
  vi.doUnmock('../runtime/live-host-refusal')
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('a start-up that rejects (CPW1-7)', () => {
  it.each([
    ['an Error', () => Promise.reject(new Error(ERROR_TEXT)), 'Error'],
    ['a chunk that fails to load (TypeError)', () => Promise.reject(new TypeError(`Failed to fetch dynamically imported module: ${ERROR_TEXT}`)), 'TypeError'],
    ['a value that is not an Error', () => Promise.reject(ERROR_TEXT), 'string'],
    ['a synchronous throw', () => {
      throw new Error(ERROR_TEXT)
    }, 'Error'],
  ])('with %s: the page shows the one sentence, starts no simulator and records once without the error text', async (_case, start, errorName) => {
    spies.bootCoreRuntime.mockImplementation(start)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // No unhandled rejection: the module's top-level await resolves.
    await expect(import('../main')).resolves.toBeDefined()
    const { webErrorSink } = await import('../runtime/error-sink')

    const root = document.getElementById('root')
    expect(root?.textContent).toBe(SENTENCE)
    expect(root?.querySelectorAll('[role="alert"]')).toHaveLength(1)

    // Nothing in its place: the start-up was asked once, no simulator, no router.
    expect(spies.bootCoreRuntime).toHaveBeenCalledTimes(1)
    expect(spies.createSim).not.toHaveBeenCalled()
    expect(spies.createAppRouter).not.toHaveBeenCalled()

    // One record, the error named by its kind only.
    const records = webErrorSink.records()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', source: 'main.boot', context: { errorName } })
    expect(records[0]?.stack).toBeUndefined()
    expect(JSON.stringify(records)).not.toContain(MARKER)
    expect(document.body.innerHTML).not.toContain(MARKER)
    for (const call of [...consoleError.mock.calls, ...consoleWarn.mock.calls]) {
      expect(JSON.stringify(call)).not.toContain(MARKER)
    }
  })
})

describe('a start-up chunk that fails to load (FXR-W W92-2)', () => {
  it.each([
    ['./router', '../router'],
    ['./i18n', '../i18n'],
  ] as const)('when %s rejects: the page shows the one sentence, starts nothing and records once without the error text', async (_label, module) => {
    failChunk(module, new TypeError(`Failed to fetch dynamically imported module: ${ERROR_TEXT}`))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // No unhandled rejection: before the fix this import rejected and `#root` stayed empty.
    await expect(import('../main')).resolves.toBeDefined()
    const { webErrorSink } = await import('../runtime/error-sink')

    const root = document.getElementById('root')
    expect(root?.textContent).toBe(SENTENCE)
    expect(root?.querySelectorAll('[role="alert"]')).toHaveLength(1)

    // The chunks load before the data source starts, so nothing was started at all.
    expect(spies.bootCoreRuntime).not.toHaveBeenCalled()
    expect(spies.createSim).not.toHaveBeenCalled()
    expect(spies.createAppRouter).not.toHaveBeenCalled()

    const records = webErrorSink.records()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', source: 'main.boot' })
    expect(records[0]?.stack).toBeUndefined()
    expect(JSON.stringify(records)).not.toContain(MARKER)
    expect(document.body.innerHTML).not.toContain(MARKER)
    for (const call of [...consoleError.mock.calls, ...consoleWarn.mock.calls]) {
      expect(JSON.stringify(call)).not.toContain(MARKER)
    }
  })

  it('when the router itself throws while it is built: the same sentence, one record', async () => {
    spies.bootCoreRuntime.mockResolvedValue({ kind: 'SIMULATED', sim: {}, coreMode: 'SIMULATED' })
    spies.createAppRouter.mockImplementation(() => {
      throw new Error(ERROR_TEXT)
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(import('../main')).resolves.toBeDefined()
    const { webErrorSink } = await import('../runtime/error-sink')

    expect(document.getElementById('root')?.textContent).toBe(SENTENCE)
    const records = webErrorSink.records()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', source: 'main.boot', context: { errorName: 'Error' } })
    expect(JSON.stringify(records)).not.toContain(MARKER)
  })

  it('when the Live refusal screen chunk rejects: the same sentence, one record', async () => {
    failChunk('../runtime/live-host-refusal', new TypeError(`Failed to fetch dynamically imported module: ${ERROR_TEXT}`))
    spies.bootCoreRuntime.mockResolvedValue({ kind: 'REFUSED', refusal: { reason: 'LOCALHOST' }, useSimulated: () => undefined })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(import('../main')).resolves.toBeDefined()
    const { webErrorSink } = await import('../runtime/error-sink')

    expect(document.getElementById('root')?.textContent).toBe(SENTENCE)
    expect(webErrorSink.records()).toHaveLength(1)
    expect(JSON.stringify(webErrorSink.records())).not.toContain(MARKER)
    expect(spies.createAppRouter).not.toHaveBeenCalled()
  })
})
