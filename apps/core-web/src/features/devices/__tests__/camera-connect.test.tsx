// Task 3 R-9, blueprint row 137: the connect flow of a found camera, web console only
// (`masterplan/08_client_ux_spec.md` §8d flow 10; `masterplan/03_api_contract.md` §2.6 ops 95, 96;
// `masterplan/09_security_design_review.md` §11 SEC35-31, SEC35-37; D80, D86 C-1 / C-2, D117).
//
// | Check | Where |
// |-------|-------|
// | M4-SEC-UI-1 (component half): both fields empty at open with the attributes against autofill; the dialog states the exact target address and its reference; Test connection is enabled only after the confirmation tick; the reveal control starts off and returns to off on blur, on submit and on close | "the dialog" |
// | M4-CONN-W (component half): each of the five outcomes with its message and next action; a development source added without a password, then "Assign to a camera slot" | "the five outcomes", "adding" |
// | M4-CONN-ABANDON-W (component half): every exit leaves 0 devices and an empty form at the next opening | "abandon" |
// | M4-CONN-GUARD-W (component half): the attempts-left text follows the Core's number; at 0 Test is disabled with the lock-out sentence; nothing retries by itself | "the five outcomes" |
// | M4-CONN-NOCRED-1 (UI half): a stored password is never rendered — the result says the fact only | "adding" |
// | ux §8d.5: what each refusal is | "the model" |
// | D117: the password is sent as typed; the check of the form holds no typed character | "the model" |
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CaptureConnectionOutcome } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS, setSimConnectionTestOutcome, type Sim } from '@dems/shared/sim'
import { getMissingI18nKeys } from '@/i18n'
import { CONNECT_FIELD, connectRefusal, credentialOf, OUTCOME_TONE, outcomeRole, validateConnectForm } from '../camera-connect'
import { enWeb } from '@/i18n-web'
import { installDevicesBed, mountDevices, toastTexts } from './search-bed'

const C = en.common.captureConnect
const NEW_ID = 'CND-000000000001'
const TEST_PATH = `/api/v1/capture/discovery/candidates/${NEW_ID}/test`
const ADOPT_PATH = `/api/v1/capture/discovery/candidates/${NEW_ID}/adopt`

describe('the model', () => {
  it('the form check names a field and a message, and holds no typed character; the password is never trimmed (D117)', () => {
    expect(validateConnectForm({ username: '', password: '' })).toEqual({ username: 'required', password: 'required' })
    expect(validateConnectForm({ username: '   ', password: ' ' })).toEqual({ username: 'required' })
    expect(validateConnectForm({ username: 'admin', password: 'pässword' })).toEqual({ password: 'charset' })
    expect(validateConnectForm({ username: 'ad<min', password: 'x' })).toEqual({ username: 'charset' })
    expect(validateConnectForm({ username: 'a'.repeat(121), password: 'x' })).toEqual({ username: 'charset' })
    const typed = { username: ' operator ', password: '  CANARY pass  ' }
    expect(validateConnectForm(typed)).toEqual({})
    expect(JSON.stringify(validateConnectForm({ username: 'CANARY<', password: 'CANARYé' }))).not.toContain('CANARY')
    // Sent exactly as typed: leading and trailing spaces are part of a password.
    expect(credentialOf(typed)).toEqual({ username: 'operator', secret: '  CANARY pass  ' })
  })

  it('each refusal of ux §8d.5 is told apart by status, code and reason', () => {
    const of = (status: number | null, code: string, reason: string | null = null) => connectRefusal({ status, code, reason })
    expect(of(409, 'CAPTURE_CONFIG_LOCKED')).toBe('LOCKED')
    expect(of(404, 'NOT_FOUND')).toBe('RESULT_GONE')
    expect(of(409, 'INVALID_STATE', 'CANDIDATE_ALREADY_REGISTERED')).toBe('ALREADY_REGISTERED')
    expect(of(409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE')).toBe('NOT_TESTABLE')
    expect(of(409, 'INVALID_STATE', 'CONNECTION_TEST_IN_PROGRESS')).toBe('IN_PROGRESS')
    expect(of(409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTED')).toBe('NOT_TESTED')
    expect(of(409, 'INVALID_STATE', 'CONNECTION_TEST_FAILED')).toBe('FINAL_CHECK_FAILED')
    expect(of(503, 'NOT_READY', 'CREDENTIAL_STORE_NOT_READY')).toBe('STORE_NOT_READY')
    expect(of(503, 'NOT_READY', 'DISCOVERY_NOT_READY')).toBe('SEARCH_NOT_READY')
    expect(of(429, 'RATE_LIMITED', 'CONNECTION_TEST_LOCKOUT_GUARD')).toBe('LOCKOUT_GUARD')
    expect(of(429, 'RATE_LIMITED', 'CONNECTION_TEST_RATE_LIMITED')).toBe('RATE_LIMITED')
    expect(of(422, 'INVALID_INPUT', 'CREDENTIAL_REQUIRED')).toBe('CREDENTIAL_REQUIRED')
    expect(of(422, 'INVALID_INPUT')).toBe('INVALID_INPUT')
    expect(of(403, 'NOT_PERMITTED')).toBe('ROLE')
    expect(of(null, 'CORE_OFFLINE')).toBe('OTHER')
  })

  it('a failed test is a result: five outcomes, each with its tone; only "can be added" is a status', () => {
    expect(Object.keys(OUTCOME_TONE).sort()).toEqual(Object.values(CaptureConnectionOutcome).sort())
    expect(OUTCOME_TONE.REACHABLE).toBe('success')
    expect(OUTCOME_TONE.AUTHENTICATION_FAILED).toBe('danger')
    expect(outcomeRole('REACHABLE')).toBe('status')
    for (const outcome of ['UNREACHABLE', 'AUTHENTICATION_FAILED', 'WRONG_PROFILE', 'NOT_H264'] as const) expect(outcomeRole(outcome)).toBe('alert')
  })
})

installDevicesBed()

const posts = (_sim: Sim, spy: ReturnType<typeof vi.spyOn>, path: string) => (spy.mock.calls as [Parameters<Sim['request']>[0]][]).filter(([call]) => call.method === 'POST' && call.path === path)
const cameras = (sim: Sim) => sim.store.getState().captureDevices.devices.filter((device) => device.kind === 'CAMERA').map((device) => device.id)
const username = () => screen.getByTestId('camera-connect-username') as HTMLInputElement
const password = () => screen.getByTestId('camera-connect-password') as HTMLInputElement

async function openConnect(prepare?: (sim: Sim) => void) {
  const { sim, queryClient } = await mountDevices('idle', OPERATOR_IDS.ANDI, prepare)
  const original = sim.request.bind(sim)
  const spy = vi.spyOn(sim, 'request')
  fireEvent.click(await screen.findByTestId('search-cameras-button-panel'))
  fireEvent.click(await screen.findByTestId(`camera-search-connect-${NEW_ID}`))
  await screen.findByTestId('camera-connect-body')
  return { sim, spy, queryClient, original }
}
/** The simulator's new candidate is a development source: the switch shows the two fields. */
const showFields = async () => {
  fireEvent.click(within(screen.getByTestId('camera-connect-with-credential')).getByRole('switch'))
  await screen.findByTestId('camera-connect-fields')
}
const tick = () => fireEvent.click(within(screen.getByTestId('camera-connect-confirm')).getByRole('checkbox'))
const type = (user: string, pass: string) => {
  fireEvent.change(username(), { target: { value: user } })
  fireEvent.change(password(), { target: { value: pass } })
}

describe('the dialog (SEC35-31, SEC35-37; ux §8d.2, §8d.3)', { timeout: 30_000 }, () => {
  it('states the exact target, opens with two empty fields that carry the attributes, and enables Test only after the tick', async () => {
    const { sim, spy } = await openConnect()
    expect(screen.getByTestId('camera-connect-address')).toHaveTextContent('127.0.0.1')
    expect(screen.getByTestId('camera-connect-reference')).not.toBeEmptyDOMElement()
    expect(screen.getByTestId('camera-connect-unverified')).toHaveTextContent(C.unverified)
    expect(screen.getByTestId('camera-connect-target').querySelector('a')).toBeNull()
    // A development source can be tested without a password: no field until the operator asks for them.
    // Fix wave I (G70b-02, contract note A2 section 1): the sentence no longer says "needs no password".
    expect(screen.getByTestId('camera-connect-no-password')).toHaveTextContent(enWeb.web.connect.developmentHint)
    // Closing pass J: the shared key `captureConnect.noPasswordNeeded` now IS the ruled sentence; the refused words stay refused.
    expect(C.noPasswordNeeded).toBe(enWeb.web.connect.developmentHint)
    expect(screen.getByTestId('camera-connect-no-password')).not.toHaveTextContent(/needs no password/)
    expect(screen.queryByTestId('camera-connect-fields')).not.toBeInTheDocument()
    await showFields()
    expect(username().value).toBe('')
    expect(password().value).toBe('')
    expect(password().type).toBe('password')
    expect(username().getAttribute('autocomplete')).toBe('off')
    expect(password().getAttribute('autocomplete')).toBe('new-password')
    for (const input of [username(), password()]) {
      expect(input.getAttribute('name')).toMatch(/^dems-camera-field-/)
      expect(input.getAttribute('name')).not.toMatch(/user|pass|login/i)
      expect(input.getAttribute('spellcheck')).toBe('false')
      expect(input.getAttribute('autocapitalize')).toBe('off')
      expect(input.getAttribute('autocorrect')).toBe('off')
      expect(input.closest('form')).toBeNull()
    }
    expect(CONNECT_FIELD.password.autoComplete).toBe('new-password')
    // Test connection: disabled without the tick, whatever is typed; enabled with it.
    const test = screen.getByTestId('camera-connect-test')
    expect(test).toBeDisabled()
    type('operator', 'fixture-pass')
    expect(test).toBeDisabled()
    fireEvent.click(test)
    expect(posts(sim, spy, TEST_PATH)).toHaveLength(0)
    expect(screen.getByTestId('camera-connect-confirm')).toHaveTextContent(C.confirmDevice.replace('{{address}}', '127.0.0.1'))
    tick()
    await waitFor(() => expect(test).toBeEnabled())
    // No Add as camera before an outcome that says so.
    expect(screen.queryByTestId('camera-connect-add')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('an empty field stops the test before any request, with the field message', async () => {
    const { sim, spy } = await openConnect()
    await showFields()
    type('operator', 'x')
    tick()
    fireEvent.change(password(), { target: { value: 'pässword' } })
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    expect(await screen.findByTestId('camera-connect-password-error')).toHaveTextContent(C.charset)
    expect(posts(sim, spy, TEST_PATH)).toHaveLength(0)
  })

  it('the reveal control: off by default, on at a press, off again on blur, on submit and on close; it has a name and a state', async () => {
    await openConnect()
    await showFields()
    const reveal = () => screen.getByTestId('camera-connect-reveal')
    expect(password()).toHaveAttribute('data-reveal', 'off')
    expect(reveal()).toHaveAccessibleName(C.reveal.show)
    expect(reveal()).toHaveAttribute('aria-pressed', 'false')
    type('operator', 'fixture-pass')
    fireEvent.click(reveal())
    await waitFor(() => expect(password().type).toBe('text'))
    expect(reveal()).toHaveAccessibleName(C.reveal.hide)
    expect(reveal()).toHaveAttribute('aria-pressed', 'true')
    // Blur.
    fireEvent.blur(password())
    await waitFor(() => expect(password().type).toBe('password'))
    // Submit.
    fireEvent.click(reveal())
    await waitFor(() => expect(password().type).toBe('text'))
    tick()
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    await screen.findByTestId('camera-connect-outcome')
    expect(password().type).toBe('password')
    // Close and open again: hidden, and both fields empty.
    fireEvent.click(screen.getByTestId('camera-connect-close'))
    await waitFor(() => expect(screen.queryByTestId('camera-connect-body')).not.toBeInTheDocument())
    fireEvent.click(await screen.findByTestId(`camera-search-connect-${NEW_ID}`))
    await screen.findByTestId('camera-connect-body')
    await showFields()
    expect(password()).toHaveAttribute('data-reveal', 'off')
    expect(username().value).toBe('')
    expect(password().value).toBe('')
  })
})

describe('the five outcomes (ux §8d.4; D86 C-2)', { timeout: 60_000 }, () => {
  it('each outcome once, with its message and its next action; one request per press and none by itself', async () => {
    const { sim, spy } = await openConnect()
    await showFields()
    tick()
    const test = screen.getByTestId('camera-connect-test')
    const outcome = () => screen.getByTestId('camera-connect-outcome')
    const run = async (kind: CaptureConnectionOutcome, sent: number) => {
      setSimConnectionTestOutcome(sim.store, kind)
      type('operator', 'fixture-pass')
      await waitFor(() => expect(test).toBeEnabled())
      fireEvent.click(test)
      await waitFor(() => expect(outcome()).toHaveAttribute('data-outcome', kind))
      expect(outcome()).toHaveTextContent(C.outcome[kind])
      expect(posts(sim, spy, TEST_PATH)).toHaveLength(sent)
    }
    await run('UNREACHABLE', 1)
    expect(outcome()).toHaveAttribute('role', 'alert')
    expect(screen.queryByTestId('camera-connect-add')).not.toBeInTheDocument()
    expect(password().value).toBe('fixture-pass')
    await run('WRONG_PROFILE', 2)
    await run('NOT_H264', 3)
    expect(screen.queryByTestId('camera-connect-add')).not.toBeInTheDocument()
    await run('AUTHENTICATION_FAILED', 4)
    // The refused password leaves the form, the user name stays; the attempts-left text is the Core's number.
    expect(password().value).toBe('')
    expect(username().value).toBe('operator')
    expect(screen.getByTestId('camera-connect-attempts')).toHaveTextContent('2 more attempts before testing this camera is paused.')
    expect(test).toBeDisabled()
    await run('REACHABLE', 5)
    expect(outcome()).toHaveAttribute('role', 'status')
    expect(outcome()).toHaveTextContent('1 usable video profile')
    // Reachable: the fields are read-only and keep what was tested; Add as camera and Change are offered.
    expect(password()).toHaveAttribute('readonly')
    expect(password().value).toBe('fixture-pass')
    expect(screen.getByTestId('camera-connect-add')).toBeEnabled()
    expect(test).toBeDisabled()
    fireEvent.click(screen.getByTestId('camera-connect-change'))
    await waitFor(() => expect(screen.queryByTestId('camera-connect-outcome')).not.toBeInTheDocument())
    expect(screen.queryByTestId('camera-connect-add')).not.toBeInTheDocument()
    expect(password()).not.toHaveAttribute('readonly')
    // A failed test is a result in the dialog: no toast, and nothing was sent that no press asked for.
    expect(toastTexts()).toEqual([])
    expect(posts(sim, spy, TEST_PATH)).toHaveLength(5)
    expect(posts(sim, spy, ADOPT_PATH)).toHaveLength(0)
    expect(cameras(sim)).toEqual(['CAM-01', 'CAM-02'])
  })

  it('the lock-out guard: at 0 attempts left Test is disabled with the sentence, and no label counts down', async () => {
    const { sim, spy, original } = await openConnect()
    await showFields()
    tick()
    setSimConnectionTestOutcome(sim.store, 'AUTHENTICATION_FAILED')
    spy.mockImplementation((call) => {
      const response = original(call)
      return call.path === TEST_PATH && response.status === 200 ? { ...response, body: { ...(response.body as object), failedAttemptsRemaining: 0 } } : response
    })
    type('operator', 'wrong-pass')
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    expect(await screen.findByTestId('camera-connect-attempts')).toHaveTextContent(en.devices.search.lockoutNoTime)
    type('operator', 'another-pass')
    expect(screen.getByTestId('camera-connect-test')).toBeDisabled()
    expect(screen.getByTestId('camera-connect-body').textContent ?? '').not.toMatch(/\d+\s*s\b|seconds/)
  })
})

describe('adding (ux §8d.6) and abandon (ux §8d.7)', { timeout: 60_000 }, () => {
  it('a development source is added without a password: the fact only, "Assign to a camera slot", and the selector offers the new camera', async () => {
    const { sim, spy } = await openConnect()
    tick()
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    await waitFor(() => expect(screen.getByTestId('camera-connect-outcome')).toHaveAttribute('data-outcome', 'REACHABLE'))
    expect(posts(sim, spy, TEST_PATH)[0]![0].body).toEqual({})
    expect(cameras(sim)).toEqual(['CAM-01', 'CAM-02'])
    fireEvent.click(screen.getByTestId('camera-connect-add'))
    const added = await screen.findByTestId('camera-connect-added')
    expect(added).toHaveAttribute('data-device', 'CAM-03')
    expect(screen.getByTestId('camera-connect-credential-fact')).toHaveTextContent(C.noPasswordUsed)
    expect(added).toHaveTextContent(C.addedNext)
    expect(added.querySelector('input')).toBeNull()
    expect(posts(sim, spy, ADOPT_PATH)).toHaveLength(1)
    expect(cameras(sim)).toEqual(['CAM-01', 'CAM-02', 'CAM-03'])
    // Adoption is not assignment: no track changed.
    expect(sim.store.getState().captureConfig.cameras.map((line) => line.deviceId)).toEqual(['CAM-01', 'CAM-02'])
    fireEvent.click(screen.getByTestId('camera-connect-assign'))
    await waitFor(() => expect(screen.queryByTestId('camera-connect-added')).not.toBeInTheDocument())
    // The row now reads as registered, and the existing selector offers the new device.
    await waitFor(() => expect(screen.getByTestId(`camera-search-row-${NEW_ID}`)).toHaveAttribute('data-kind', 'REGISTERED'))
    fireEvent.click(within(screen.getByTestId('selector-source-VIDEO-01')).getByRole('button'))
    expect(await screen.findByRole('option', { name: /CAM-03/ })).toBeInTheDocument()
  })

  it('added with a password: "Password stored." and no value anywhere in the result', async () => {
    await openConnect()
    await showFields()
    type('operator', 'fixture-pass-77')
    tick()
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    await waitFor(() => expect(screen.getByTestId('camera-connect-outcome')).toHaveAttribute('data-outcome', 'REACHABLE'))
    fireEvent.click(screen.getByTestId('camera-connect-add'))
    await screen.findByTestId('camera-connect-added')
    expect(screen.getByTestId('camera-connect-credential-fact')).toHaveTextContent(C.passwordStored)
    expect(document.body.innerHTML).not.toContain('fixture-pass-77')
    expect(document.body.innerHTML).not.toMatch(/\*{3,}|•{3,}/)
  })

  it('closing before a test, after a failed test and after a passing test registers nothing; the next opening has two empty fields', async () => {
    const { sim, spy } = await openConnect()
    const close = async () => {
      fireEvent.click(screen.getByTestId('camera-connect-close'))
      await waitFor(() => expect(screen.queryByTestId('camera-connect-body')).not.toBeInTheDocument())
    }
    const reopen = async () => {
      fireEvent.click(await screen.findByTestId(`camera-search-connect-${NEW_ID}`))
      await screen.findByTestId('camera-connect-body')
      await showFields()
      expect(username().value).toBe('')
      expect(password().value).toBe('')
    }
    // Before a test.
    await showFields()
    type('operator', 'typed-then-left')
    await close()
    expect(screen.getByTestId(`camera-search-row-${NEW_ID}`)).toHaveAttribute('data-kind', 'NEW')
    expect(screen.queryByTestId(`camera-search-last-test-${NEW_ID}`)).not.toBeInTheDocument()
    // After a failed test: the row keeps the outcome word of the last test.
    await reopen()
    setSimConnectionTestOutcome(sim.store, 'UNREACHABLE')
    type('operator', 'typed-then-left')
    tick()
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    await screen.findByTestId('camera-connect-outcome')
    await close()
    await waitFor(() => expect(screen.getByTestId(`camera-search-last-test-${NEW_ID}`)).toHaveAttribute('data-outcome', 'UNREACHABLE'))
    // After a passing test without adding.
    await reopen()
    setSimConnectionTestOutcome(sim.store, null)
    type('operator', 'typed-then-left')
    tick()
    fireEvent.click(screen.getByTestId('camera-connect-test'))
    await waitFor(() => expect(screen.getByTestId('camera-connect-outcome')).toHaveAttribute('data-outcome', 'REACHABLE'))
    await close()
    await waitFor(() => expect(screen.getByTestId(`camera-search-last-test-${NEW_ID}`)).toHaveTextContent(C.outcomeShort.REACHABLE))
    await reopen()
    expect(posts(sim, spy, ADOPT_PATH)).toHaveLength(0)
    expect(cameras(sim)).toEqual(['CAM-01', 'CAM-02'])
    expect(sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_CANDIDATE_ADOPTED')).toHaveLength(0)
    expect(document.body.innerHTML).not.toContain('typed-then-left')
  })
})
