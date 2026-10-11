// FXR-W, finding W92-5 (`verification/11_code_review_shared_web.md`; decision D242; D182 DC-6): three
// dev-console writers logged an error's `message` and `stack`. Live mode exists only in dev builds,
// so the text of a Live error, which may quote input, reached the console. Each now writes ONE record
// to the page's own log (`webErrorSink`) with a fixed sentence and the error's class, never its text;
// the root route's record is written once per error from an effect, not from the render body (which
// ran on every render and twice under StrictMode).
//
// | Site | Record source | Proven here |
// |------|---------------|-------------|
// | The router's error boundary (`components/shell/root-error.tsx`, used by `routes/__root.tsx`) | `routes/__root.RootError` | One record across re-renders and StrictMode; a new error gets its own; no marker anywhere |
// | The Devices panel boundary (`features/devices/panel.tsx`, was `motion.ts` `logDevicesError`) | `Devices.ErrorBoundary` | One record, the panel named, no marker |
// | The Login page (`features/login/report.ts`) | the caller's source | The entry and the record carry a fixed sentence and the class; no marker, no stack |
import { StrictMode, createElement } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RootError } from '@/components/shell/root-error'
import { DevicesErrorBoundary } from '@/features/devices/panel'
import { buildLoginLogEntry, reportLoginIssue } from '@/features/login/report'
import { i18n } from '@/i18n'
import { webErrorSink } from '@/runtime'

/** Stands for what an error's text may carry: a token-like value, an address and typed input. */
const MARKER = 'w92-5-marker-c41e'
const ERROR_TEXT = `ses_${MARKER} at http://127.0.0.1:4100/api/v1/x?q=${MARKER}`

let consoleCalls: unknown[][] = []

beforeEach(() => {
  webErrorSink.clear()
  consoleCalls = []
  for (const method of ['error', 'warn', 'info', 'log'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      consoleCalls.push(args)
    })
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The console lines the console itself wrote (React's own report of a caught error is not ours). */
const ownConsoleLines = () => consoleCalls.filter(([first]) => typeof first === 'string' && first.startsWith('[core-web]'))

function expectNoMarker() {
  expect(JSON.stringify(webErrorSink.records())).not.toContain(MARKER)
  for (const line of ownConsoleLines()) expect(JSON.stringify(line)).not.toContain(MARKER)
  for (const record of webErrorSink.records()) expect(record.stack).toBeUndefined()
}

describe('W92-5: the root route error boundary', () => {
  it('under StrictMode, rendered again three times: one record, a fixed sentence, the class only', async () => {
    const error = new TypeError(ERROR_TEXT)
    const view = render(createElement(StrictMode, null, createElement(I18nextProvider, { i18n }, createElement(RootError, { error, reset: () => undefined }))))
    for (let index = 0; index < 3; index += 1) {
      view.rerender(createElement(StrictMode, null, createElement(I18nextProvider, { i18n }, createElement(RootError, { error, reset: () => undefined }))))
    }
    await act(async () => undefined)
    const records = webErrorSink.records().filter((record) => record.source === 'routes/__root.RootError')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', context: { errorName: 'TypeError' } })
    expect(records[0]!.message).not.toBe('')
    expectNoMarker()
    // The screen says the friendly sentence, never the error.
    expect(document.body.textContent).not.toContain(MARKER)
  })

  it('a different error gets its own record', async () => {
    const view = render(<I18nextProvider i18n={i18n}><RootError error={new Error(ERROR_TEXT)} reset={() => undefined} /></I18nextProvider>)
    await act(async () => undefined)
    view.rerender(<I18nextProvider i18n={i18n}><RootError error={new RangeError(ERROR_TEXT)} reset={() => undefined} /></I18nextProvider>)
    await act(async () => undefined)
    const records = webErrorSink.records().filter((record) => record.source === 'routes/__root.RootError')
    expect(records.map((record) => record.context?.errorName)).toEqual(['Error', 'RangeError'])
    expectNoMarker()
  })
})

describe('W92-5: the Devices panel boundary', () => {
  it('a panel that throws while rendering: one record naming the panel and the class, never the text', async () => {
    function Broken(): never {
      throw new Error(ERROR_TEXT)
    }
    render(<I18nextProvider i18n={i18n}><DevicesErrorBoundary panel="cameras"><Broken /></DevicesErrorBoundary></I18nextProvider>)
    await act(async () => undefined)
    expect(screen.queryByText(new RegExp(MARKER))).toBeNull()
    const records = webErrorSink.records().filter((record) => record.source === 'Devices.ErrorBoundary')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ level: 'error', context: { panel: 'cameras', errorName: 'Error' } })
    expectNoMarker()
  })
})

describe('W92-5: the Login page', () => {
  it('an entry carries the source, a fixed sentence and the class; not the message, not the stack', () => {
    const entry = buildLoginLogEntry('error', 'login.signIn', new Error(ERROR_TEXT), { method: 'password' }, 'login-x-1')
    expect(entry).toMatchObject({ level: 'error', source: 'login.signIn', context: { method: 'password', errorName: 'Error' }, correlationId: 'login-x-1' })
    expect(JSON.stringify(entry)).not.toContain(MARKER)
    expect(entry.stack).toBeUndefined()
    expect(entry.message).toBe(buildLoginLogEntry('error', 'login.signIn', new Error('other text')).message)
  })

  it('a report goes to the page\'s own log once, with no marker in it or on the console', () => {
    reportLoginIssue('warn', 'login.preload.shell', new TypeError(ERROR_TEXT))
    reportLoginIssue('info', 'login.backdrop.bake', ERROR_TEXT)
    const records = webErrorSink.records()
    expect(records.map((record) => [record.level, record.source, record.context?.errorName])).toEqual([
      ['warn', 'login.preload.shell', 'TypeError'],
      ['warn', 'login.backdrop.bake', 'string'],
    ])
    expectNoMarker()
  })
})
