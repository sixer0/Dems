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
// | First line: the form check holds a field name and a message key, never a value. Second line: the sink blanks the pair by its member names, and since integration pass D1a also a `{ field: 'credential.password', value }` / `{ field: 'credential.username', value }` record (the gap D-137-7 is closed; pass D2 item 7) | "the two lines" |
// | Negative control: the same search finds both values in the bodies that were sent | "sent" |
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CaptureCandidate, CaptureDiscoverySearch } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { enWeb } from '@/i18n-web'
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

async function openDialog(candidate: CaptureCandidate = CANDIDATE): Promise<LiveTestBed> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  let searched = false
  created.fake.answer('startCaptureDiscovery', () => {
    searched = true
    return { status: 202, body: SEARCH }
  })
  created.fake.answer('getCaptureDiscovery', () => ({ status: 200, body: searched ? { search: { ...SEARCH, created: false }, candidates: [candidate], truncated: false } : { search: null, candidates: [], truncated: false } }))
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

// Fix F-M4 (review row 69, findings R69-12 and R69-13; decision D178).
describe('what the operator confirms, and a camera whose sign-in method is not answered (Live mode, fake transport)', () => {
  const TARGET = 'https://192.0.2.44:8443/onvif/device_service'
  const T = en.common.captureConnectTarget

  it('R69-12: the full target the Core sent - scheme, host, port, path - is shown as text and is the sentence of the tick; without it the host is confirmed (control)', async () => {
    await openDialog({ ...CANDIDATE, connectionTarget: TARGET })
    expect(screen.getByTestId('camera-connect-target-full')).toHaveTextContent(TARGET)
    expect(screen.getByTestId('camera-connect-target').querySelector('a')).toBeNull()
    expect(screen.getByTestId('camera-connect-confirm')).toHaveTextContent(T.confirm.replace('{{target}}', TARGET))
    expect(screen.getByTestId('camera-connect-confirm')).not.toHaveTextContent(C.confirmDevice.replace('{{address}}', CANDIDATE.host))
    // Test connection stays disabled until that sentence is ticked.
    fireEvent.change(username(), { target: { value: USER } })
    fireEvent.change(password(), { target: { value: PASS } })
    expect(screen.getByTestId('camera-connect-test')).toBeDisabled()
    cleanup()
    bed?.dispose()
    await openDialog()
    expect(screen.queryByTestId('camera-connect-target-full')).not.toBeInTheDocument()
    expect(screen.getByTestId('camera-connect-confirm')).toHaveTextContent(C.confirmDevice.replace('{{address}}', CANDIDATE.host))
  })

  it('R69-13: AUTHENTICATION_FAILED with reason SCHEME_NOT_ALLOWED is never worded as a refused password, and nothing is sent again by itself; a refused password keeps its sentence (control)', async () => {
    const created = await openDialog()
    fireEvent.change(username(), { target: { value: USER } })
    fireEvent.change(password(), { target: { value: PASS } })
    fireEvent.click(within(screen.getByTestId('camera-connect-confirm')).getByRole('checkbox'))
    const unanswered = tested('AUTHENTICATION_FAILED', 1)
    created.fake.answerOnce('testCaptureCandidateConnection', { ...unanswered, body: { ...unanswered.body, reason: 'SCHEME_NOT_ALLOWED' } })
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    const outcome = await screen.findByTestId('camera-connect-outcome')
    await waitFor(() => expect(outcome).toHaveAttribute('data-reason', 'SCHEME_NOT_ALLOWED'))
    expect(outcome).toHaveTextContent(T.schemeNotAllowed)
    expect(screen.getByTestId('camera-connect-scheme')).toHaveTextContent(T.schemeNotAllowedDetail)
    expect(outcome).not.toHaveTextContent(C.outcome.AUTHENTICATION_FAILED)
    expect(password().value).toBe('')
    await act(async () => undefined)
    expect(created.fake.log.requestsOf('testCaptureCandidateConnection')).toHaveLength(1)

    // CONTROL: a refused password, with no reason.
    fireEvent.change(password(), { target: { value: PASS } })
    created.fake.answerOnce('testCaptureCandidateConnection', tested('AUTHENTICATION_FAILED', 0))
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    await waitFor(() => expect(screen.getByTestId('camera-connect-outcome')).not.toHaveAttribute('data-reason'))
    expect(screen.getByTestId('camera-connect-outcome')).toHaveTextContent(C.outcome.AUTHENTICATION_FAILED)
    expect(screen.queryByTestId('camera-connect-scheme')).not.toBeInTheDocument()
  })
})

describe('the row of a tested candidate (R69-13)', () => {
  it('a last test that ended SCHEME_NOT_ALLOWED does not read "Password refused" on the row; a refused password does (control)', async () => {
    const last = { outcome: 'AUTHENTICATION_FAILED', authenticated: true, testedAt: 5_000 } as const
    await openDialog({ ...CANDIDATE, lastTest: { ...last, reason: 'SCHEME_NOT_ALLOWED' } })
    const chip = screen.getByTestId(`camera-search-last-test-${ID}`)
    expect(chip).toHaveTextContent(en.common.captureConnectTarget.schemeNotAllowedShort)
    expect(chip).not.toHaveTextContent(C.outcomeShort.AUTHENTICATION_FAILED)
    cleanup()
    bed?.dispose()
    await openDialog({ ...CANDIDATE, lastTest: last })
    expect(screen.getByTestId(`camera-search-last-test-${ID}`)).toHaveTextContent(C.outcomeShort.AUTHENTICATION_FAILED)
  })
})

describe('the typed camera user name and password (Live mode, fake transport)', () => {
  // Fix F-M4 (review row 69, findings R69-04 and R69-10; decision D134). The case below reads the
  // attribute AFTER a remover ran, so it could not fail for the write it is about. This one can: an
  // observer that exists BEFORE the dialog (as a library loaded at page start does), on an ancestor,
  // asking for old values. With controlled inputs React wrote the typed text into the `value`
  // attribute at every keystroke, and the removal handed it to this observer a second time.
  it('an observer created before the dialog, asking for old values, never receives a typed character: the `value` attribute is never written', async () => {
    const seen: string[] = []
    const note = (records: MutationRecord[]) => {
      for (const record of records) seen.push(`${String(record.attributeName)}|${String(record.oldValue)}|${String((record.target as Element).getAttribute(record.attributeName ?? ''))}`)
    }
    const early = new MutationObserver(note)
    early.observe(document.body, { attributes: true, subtree: true, attributeOldValue: true })
    try {
      await openDialog()
      fireEvent.change(username(), { target: { value: USER } })
      fireEvent.change(password(), { target: { value: PASS } })
      await act(async () => undefined)
      // Shown as text, typed on, hidden again: every state the field has while it holds the password.
      fireEvent.click(screen.getByTestId('camera-connect-reveal'))
      fireEvent.change(password(), { target: { value: `${PASS}x` } })
      await act(async () => undefined)
      fireEvent.click(screen.getByTestId('camera-connect-reveal'))
      fireEvent.change(password(), { target: { value: PASS } })
      await act(async () => undefined)
      note(early.takeRecords())
      expect(password().value).toBe(PASS)
      expect(username().value).toBe(USER)
      expect(seen.filter((entry) => entry.startsWith('value|'))).toEqual([])
      expectNoCanary(seen.join('\n'))
      for (const input of [username(), password()]) expect(input.hasAttribute('value')).toBe(false)
      // CONTROL: an attribute that does hold the text reaches this observer - as the OLD VALUE of its removal,
      // which is how the remover of the former dialog handed the text on.
      password().setAttribute('data-planted', 'CANARY-planted')
      password().removeAttribute('data-planted')
      note(early.takeRecords())
      expect(seen.filter((entry) => entry.includes('CANARY-planted'))).toEqual(['data-planted|CANARY-planted|null'])
    } finally {
      early.disconnect()
    }
  })

  // Task 4 row W4 (review finding F3-06, the operator's side; the Core's half is row R2): operations 95 / 96 answer
  // `409 INVALID_STATE` with reason `COMMISSIONING_NOT_CONFIGURED` when no camera network is configured. The console
  // drew it as "The request failed"; it now says the cause and where the technician sets it.
  it('F3-06: a test refused because no camera network is configured says so and names the commissioning screen; not the general failure, no value reported', async () => {
    const created = await openDialog()
    fireEvent.change(username(), { target: { value: USER } })
    fireEvent.change(password(), { target: { value: PASS } })
    fireEvent.click(within(screen.getByTestId('camera-connect-confirm')).getByRole('checkbox'))
    created.fake.answerOnce('testCaptureCandidateConnection', {
      status: 409,
      body: { error: { code: 'INVALID_STATE', message: 'Never drawn.', details: { reason: 'COMMISSIONING_NOT_CONFIGURED' } } },
    })
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    const refusal = await screen.findByTestId('camera-connect-refusal')
    expect(refusal).toHaveAttribute('data-refusal', 'NETWORK_NOT_CONFIGURED')
    expect(refusal).toHaveAttribute('role', 'alert')
    expect(refusal).toHaveTextContent(enWeb.web.source.networkNotConfigured.title)
    expect(refusal).toHaveTextContent(enWeb.web.source.networkNotConfigured.detail.replace('{{screen}}', enWeb.web.commissioning.title))
    expect(refusal).toHaveTextContent('camera network of this Core is not configured')
    expect(refusal).toHaveTextContent(`"${enWeb.web.commissioning.title}" screen`)
    // Neither the general sentence, nor the Core's own message text, nor a toast.
    expect(refusal).not.toHaveTextContent(en.devices.search.requestFailed)
    expect(document.body).not.toHaveTextContent('Never drawn.')
    expect(toastTexts()).toEqual([])
    // The cause can be removed (the technician configures the network): the test can be pressed again.
    expect(screen.getByTestId('camera-connect-test')).not.toBeDisabled()
    expect(created.fake.log.requestsOf('testCaptureCandidateConnection')).toHaveLength(1)
    expectNoCanary(reported(created))
    // CONTROL: the refusal this one used to be told as (`CANDIDATE_NOT_TESTABLE`) keeps its own kind and sentence.
    created.fake.answerOnce('testCaptureCandidateConnection', {
      status: 409,
      body: { error: { code: 'INVALID_STATE', message: 'Never drawn.', details: { reason: 'CANDIDATE_NOT_TESTABLE' } } },
    })
    fireEvent.change(username(), { target: { value: USER } })
    fireEvent.change(password(), { target: { value: PASS } })
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    await waitFor(() => expect(screen.getByTestId('camera-connect-refusal')).toHaveAttribute('data-refusal', 'NOT_TESTABLE'))
    expect(screen.getByTestId('camera-connect-refusal')).not.toHaveTextContent(enWeb.web.source.networkNotConfigured.title)
  })

  it('sent as typed in operations 95 and 96, and reported nowhere: a refused password, the 503 before row 84, a 422, then close', async () => {
    const created = await openDialog()
    // A PRODUCTION camera: the two fields are there at once, and empty.
    expect(username().value).toBe('')
    expect(password().value).toBe('')
    fireEvent.change(username(), { target: { value: USER } })
    fireEvent.change(password(), { target: { value: PASS } })
    // ux §14.3: no value in any attribute of the password field while it is typed.
    // Since fix F-M4 the two inputs are uncontrolled: React writes no `value` attribute at all (the case above holds that at every instant).
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
    // D-137-7, closed by integration pass D1a (pass D2 item 7): a record that NAMES its field,
    // `{ field, value }`, is blanked too — the password and the account name. The dialog still never builds one.
    for (const [field, value] of [['credential.password', PASS], ['credential.username', USER]] as const) {
      const named = redactCredentials(JSON.stringify({ field, value }))
      expect(named).not.toContain('CANARY')
      expect(named).not.toContain('s3cr3t')
      expect(named).toContain(field)
    }
    // Control: the rule reads the field's name, not every `value` — a record about another field keeps its value.
    expect(redactCredentials(JSON.stringify({ field: 'model', value: 'kept-as-typed' }))).toContain('kept-as-typed')
  })
})
