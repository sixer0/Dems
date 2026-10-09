/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Task 3 R-9, blueprint row 137: the typed camera user name and password stay in the dialog's form
// and in the two requests that carry them — in Live mode, on the contract-checked fake transport
// (`masterplan/08_client_ux_spec.md` §8d.3 "Where the typed values live"; SEC35-36, SEC35-37;
// D86 C-6: the user name is credential material too; D117; row 117's canary pattern).
//
// | Criterion | Where |
// |-----------|-------|
// | Operations 95 and 96 carry `credential: { username, secret }` exactly as typed (the password with its spaces), once per press | "sent" |
// | A refused password, the state before row 84 (`503 CREDENTIAL_STORE_NOT_READY`) and a `422` leave NEITHER value in the error sink, the page's log, a console call, a toast, the markup, a query key, a query entry or error, the mutation cache, a URL, the location or browser storage | "reported nowhere" |
// | No value in any attribute of either field, nor anywhere in the markup, while it is typed (ux §14.3) | "reported nowhere" |
// | First line: the form check holds a field name and a message key, never a value. Second line: the sink blanks the pair by its member names. A `{ field: 'credential.password', value }` record is NOT blanked by the second line, so the dialog must never build one | "the two lines" |
// | Negative control: the same search finds both values in the bodies that were sent | "sent" |
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CaptureCandidate, CaptureDiscoverySearch } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { redactCredentials, webErrorSink } from '@/runtime'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed, type MountedPage } from '@/runtime/testing/live-harness'
import { validateConnectForm } from '../camera-connect'
import { reportDevicesError } from '../report'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 40_000 })

const C = en.common.captureConnect
const USER = 'CANARYuser-7Qm'
const PASS = '  CANARYpass s3cr3t-9Zx  '
const ID = 'CND-0000000000AA'
const SEARCH: CaptureDiscoverySearch = {
  searchId: 'DSC-000042',
  scope: 'CAMERA_NETWORK',
  trigger: 'MANUAL',
  state: 'COMPLETE',
  startedAt: 1_000,
  windowMs: 3_000,
  completesAt: 4_000,
  expiresAt: 9_999_999_999_999,
  responderCount: 1,
  newCount: 1,
  registeredCount: 0,
  interfaceCount: 1,
  failureReason: null,
  created: true,
}
const CANDIDATE: CaptureCandidate = {
  candidateId: ID,
  adapter: 'ONVIF_RTSP',
  sourceClass: 'PRODUCTION',
  host: '192.0.2.44',
  endpointRef: 'urn:uuid:11111111-2222-3333-4444-555555555555',
  vendor: 'Acme',
  model: 'Dome 4',
  name: 'Lobby',
  status: 'NEW',
  deviceId: null,
  testable: true,
  conflict: false,
  addressChanged: false,
  lastTest: null,
  adoptable: false,
}
const tested = (outcome: string, remaining = 2) => ({ status: 200, body: { candidateId: ID, outcome, authenticated: true, testedAt: 5_000, usableProfileCount: outcome === 'REACHABLE' ? 2 : 0, failedAttemptsRemaining: remaining } })

let bed: LiveTestBed | undefined
let page: LivePage | undefined
let mounted: MountedPage | undefined
let consoleCalls: unknown[][] = []
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const username = () => screen.getByTestId('camera-connect-username') as HTMLInputElement
const password = () => screen.getByTestId('camera-connect-password') as HTMLInputElement

const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalPlay = HTMLMediaElement.prototype.play
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  Element.prototype.scrollIntoView ??= function scrollIntoView() {}
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
})
beforeEach(() => {
  resetCoreErrorPresenter()
  webErrorSink.clear()
  consoleCalls = []
  for (const level of ['error', 'warn', 'log', 'info', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void consoleCalls.push(parts))
  }
})
afterEach(() => {
  cleanup()
  toast.clear()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

async function openDialog(): Promise<LiveTestBed> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  let searched = false
  created.fake.answer('startCaptureDiscovery', () => {
    searched = true
    return { status: 202, body: SEARCH }
  })
  created.fake.answer('getCaptureDiscovery', () => ({ status: 200, body: searched ? { search: { ...SEARCH, created: false }, candidates: [CANDIDATE], truncated: false } : { search: null, candidates: [], truncated: false } }))
  page = await created.load()
  mounted = await created.mount(page, '/devices')
  await screen.findByTestId('page-devices')
  const button = await screen.findByTestId('search-cameras-button-panel')
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  fireEvent.click(await screen.findByTestId(`camera-search-connect-${ID}`))
  await screen.findByTestId('camera-connect-fields')
  return created
}

/** Everything a typed value could have been written to, as one text. */
function reported(created: LiveTestBed): string {
  const cache = mounted!.queryClient.getQueryCache().getAll()
  return JSON.stringify({
    sink: webErrorSink.records(),
    pageSink: page!.sink.records(),
    console: consoleCalls.map((call) => call.map((part) => (part instanceof Error ? `${part.message} ${part.stack}` : part))),
    toasts: toastTexts(),
    html: document.body.innerHTML,
    queryKeys: cache.map((query) => query.queryKey),
    queryData: cache.map((query) => ({ data: query.state.data, error: String(query.state.error) })),
    mutations: mounted!.queryClient.getMutationCache().getAll().map((mutation) => ({ variables: mutation.state.variables, data: mutation.state.data })),
    urls: created.fake.log.urls(),
    location: window.location.href,
    local: { ...window.localStorage },
    session: { ...window.sessionStorage },
  })
}
const expectNoCanary = (text: string) => {
  expect(text).not.toContain('CANARY')
  expect(text).not.toContain('s3cr3t')
}

describe('the typed camera user name and password (Live mode, fake transport)', () => {
  it('sent as typed in operations 95 and 96, and reported nowhere: a refused password, the 503 before row 84, a 422, then close', async () => {
    const created = await openDialog()
    // A PRODUCTION camera: the two fields are there at once, and empty.
    expect(username().value).toBe('')
    expect(password().value).toBe('')
    fireEvent.change(username(), { target: { value: USER } })
    fireEvent.change(password(), { target: { value: PASS } })
    // ux §14.3: no value in any attribute of the password field while it is typed.
    // The attribute React writes is taken off in the same task (a mutation observer): one turn of the microtask queue.
    await act(async () => undefined)
    for (const input of [username(), password()]) expect(Array.from(input.attributes).map((attribute) => attribute.value).join(' ')).not.toContain('CANARY')
    // The whole document while both values are in the form: in the two inputs' values, and in no markup.
    expect(document.body.innerHTML).not.toContain('CANARY')
    expect(password().value).toBe(PASS)
    fireEvent.click(within(screen.getByTestId('camera-connect-confirm')).getByRole('checkbox'))

    // 1. The camera refuses the password: an outcome, the password leaves the form.
    created.fake.answerOnce('testCaptureCandidateConnection', tested('AUTHENTICATION_FAILED', 1))
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    await waitFor(() => expect(screen.getByTestId('camera-connect-outcome')).toHaveAttribute('data-outcome', 'AUTHENTICATION_FAILED'))
    expect(screen.getByTestId('camera-connect-attempts')).toHaveTextContent('1 more attempt before testing this camera is paused.')
    expect(password().value).toBe('')
    expectNoCanary(reported(created))

    // 2. A 422 from the Core is a field message, never the value.
    fireEvent.change(password(), { target: { value: PASS } })
    created.fake.answerOnce('testCaptureCandidateConnection', { status: 422, body: { error: { code: 'INVALID_INPUT', message: 'The request does not match the expected input.', details: { in: 'body' } } } })
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    expect(await screen.findByTestId('camera-connect-password-error')).toHaveTextContent(C.charset)

    // 3. Reachable, then Add: the state before blueprint row 84.
    created.fake.answerOnce('testCaptureCandidateConnection', tested('REACHABLE'))
    fireEvent.change(password(), { target: { value: PASS } })
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    await waitFor(() => expect(screen.getByTestId('camera-connect-outcome')).toHaveAttribute('data-outcome', 'REACHABLE'))
    created.fake.answerOnce('adoptCaptureCandidate', { status: 503, body: { error: { code: 'NOT_READY', message: 'The Core credential store is not mounted.', details: { reason: 'CREDENTIAL_STORE_NOT_READY' } } } })
    fireEvent.click(screen.getByTestId('camera-connect-add'))
    const refusal = await screen.findByTestId('camera-connect-refusal')
    expect(refusal).toHaveAttribute('data-refusal', 'STORE_NOT_READY')
    expect(refusal).toHaveTextContent(C.storeNotReady)
    expect(refusal).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('camera-connect-add')).toBeDisabled()
    expect(toastTexts()).toEqual([])

    // Sent: once per press, exactly as typed (the password with its leading and trailing spaces).
    const tests = created.fake.log.requestsOf('testCaptureCandidateConnection')
    const adopts = created.fake.log.requestsOf('adoptCaptureCandidate')
    expect(tests).toHaveLength(3)
    expect(adopts).toHaveLength(1)
    for (const request of [...tests, ...adopts]) expect(request.body).toEqual({ credential: { username: USER, secret: PASS } })
    expect(tests[0]!.path).toBe(`/api/v1/capture/discovery/candidates/${ID}/test`)

    // A record that names the pair by its member names is blanked by the sink (the second line, SEC35-36).
    reportDevicesError('features/devices.cameraConnect', null, 'A step of the camera connect flow was not carried out.', { username: USER, secret: PASS })

    // Close: the form unmounts and both fields are gone from the document.
    fireEvent.click(screen.getByTestId('camera-connect-close'))
    await waitFor(() => expect(screen.queryByTestId('camera-connect-body')).not.toBeInTheDocument())
    await act(async () => created.flush())
    expectNoCanary(reported(created))
    // Negative control: the same search finds both values where they were sent.
    const sent = JSON.stringify([...tests, ...adopts].map((request) => request.body))
    expect(sent).toContain('CANARYuser')
    expect(sent).toContain('s3cr3t')
    // Nothing was registered.
    expect(screen.getByTestId(`camera-search-row-${ID}`)).toHaveAttribute('data-kind', 'NEW')
  })

  it('the two lines: the form check never holds a value (first line); the sink blanks the pair by its member names (second line)', () => {
    // First line: what the dialog could ever report about a field is its name and a message key.
    const errors = validateConnectForm({ username: `${USER}<`, password: `${PASS}é` })
    expect(errors).toEqual({ username: 'charset', password: 'charset' })
    expect(JSON.stringify(errors)).not.toContain('CANARY')
    // Second line: the shared blanking rules drop both members of the pair.
    const record = redactCredentials(JSON.stringify({ credential: { username: USER, secret: PASS } }))
    expect(record).not.toContain('CANARY')
    expect(record).not.toContain('s3cr3t')
    // Negative control, and the reason the first line is tested: a record shaped `{ field, value }` is NOT
    // blanked by the second line (the member name says nothing). The dialog never builds one.
    expect(redactCredentials(JSON.stringify({ field: 'credential.password', value: PASS }))).toContain('CANARY')
  })
})
