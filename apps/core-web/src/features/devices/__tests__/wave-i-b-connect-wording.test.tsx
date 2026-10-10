// Fix wave I, driver B - findings G70b-02 and G70b-05 of re-gate 70 (`gateway_check/09b_m4_regate.md`,
// `w2_conn_no_credential.png`, `w2_conn_AUTH_SCHEME.png`), as ruled by driver A2 in
// `delegation_progress/contract_wave_i_a2.md` sections 1 and 2:
//
// | Where | Condition | Sentence |
// |---|---|---|
// | Dialog, DEVELOPMENT candidate, before a test | `sourceClass: DEVELOPMENT` | "A development source can be tested without a password. If the test asks for one, ..." - never "needs no password" |
// | Result | `AUTHENTICATION_FAILED && authenticated === false` | "This camera asks for a user name and a password. None was sent." + what to do; never "refused this user name or password"; NO remaining-attempts line |
// | Result | `AUTHENTICATION_FAILED && reason === SCHEME_NOT_ALLOWED` | the scheme sentences; NO remaining-attempts line (nothing was counted) |
// | Result | `AUTHENTICATION_FAILED && authenticated === true`, no reason | unchanged: "The camera refused ..." + the remaining-attempts line (CONTROL) |
//
// The answers are the contract's: the documented example of operation 95 (`CORE_API_EXAMPLES`) for the
// rule, and the shared simulator's own answer of a test without a credential for the dialog.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CAPTURE_DISCOVERY_EXAMPLES, CaptureConnectionOutcome, CaptureConnectionTestReason, CaptureConnectionTestSchema, type CaptureConnectionTest } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS, setSimConnectionTestOutcome } from '@dems/shared/sim'
import { getMissingI18nKeys } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { connectionTestWording } from '../camera-connect'
import { installDevicesBed, mountDevices } from './search-bed'

const C = en.common.captureConnect
const W = enWeb.web.connect
const NEW_ID = 'CND-000000000001'

/** Operation 95's documented answer of a refused credential (the contract example, parsed by its schema). */
const REFUSED: CaptureConnectionTest = CaptureConnectionTestSchema.parse(CAPTURE_DISCOVERY_EXAMPLES['testCaptureCandidateConnection']!.responses[200]!['authenticationFailed']!.value)
const REACHABLE: CaptureConnectionTest = CaptureConnectionTestSchema.parse(CAPTURE_DISCOVERY_EXAMPLES['testCaptureCandidateConnection']!.responses[200]!['reachable']!.value)

describe('the rule (contract note A2, sections 1 and 2)', () => {
  it('CONTROL - a credential was sent and refused: the refused sentence and the remaining-attempts line', () => {
    expect(REFUSED).toMatchObject({ outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true })
    expect(REFUSED.reason).toBeUndefined()
    expect(connectionTestWording(REFUSED)).toEqual({ kind: 'CREDENTIAL_REFUSED', showAttempts: true })
  })

  it('no credential was sent (`authenticated: false`): its own sentence, no remaining-attempts line', () => {
    expect(connectionTestWording({ ...REFUSED, authenticated: false })).toEqual({ kind: 'NO_CREDENTIAL_SENT', showAttempts: false })
  })

  it('G70b-05 - a scheme refusal: no remaining-attempts line beside "Typing the password again does not help."', () => {
    expect(connectionTestWording({ ...REFUSED, reason: CaptureConnectionTestReason.SCHEME_NOT_ALLOWED })).toEqual({ kind: 'SCHEME_NOT_ALLOWED', showAttempts: false })
    // The scheme reason wins over the credential fact: nothing was sent either way.
    expect(connectionTestWording({ ...REFUSED, authenticated: false, reason: CaptureConnectionTestReason.SCHEME_NOT_ALLOWED })).toEqual({ kind: 'SCHEME_NOT_ALLOWED', showAttempts: false })
  })

  it('every other outcome: its own message, no remaining-attempts line', () => {
    expect(connectionTestWording(REACHABLE)).toEqual({ kind: 'OUTCOME', showAttempts: false })
    expect(connectionTestWording({ ...REFUSED, outcome: CaptureConnectionOutcome.UNREACHABLE })).toEqual({ kind: 'OUTCOME', showAttempts: false })
  })
})

installDevicesBed()

async function openConnect() {
  const { sim } = await mountDevices('idle', OPERATOR_IDS.ANDI)
  fireEvent.click(await screen.findByTestId('search-cameras-button-panel'))
  fireEvent.click(await screen.findByTestId(`camera-search-connect-${NEW_ID}`))
  await screen.findByTestId('camera-connect-body')
  return sim
}
const tick = () => fireEvent.click(within(screen.getByTestId('camera-connect-confirm')).getByRole('checkbox'))

describe('the dialog (G70b-02)', { timeout: 60_000 }, () => {
  it('a development source: "can be tested without a password", never "needs no password"', async () => {
    await openConnect()
    const line = screen.getByTestId('camera-connect-no-password')
    expect(line).toHaveTextContent(W.developmentHint)
    // Closing pass J: the shared key now holds the ruled wording, so both keys are one sentence; the refused words stay refused.
    expect(C.noPasswordNeeded).toBe(W.developmentHint)
    expect(line).not.toHaveTextContent(/needs no password/)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a test WITHOUT a credential that the camera refuses: "None was sent." + what to do; not "refused this user name or password"; no attempts count', async () => {
    const sim = await openConnect()
    // The shared simulator answers as the Core does: AUTHENTICATION_FAILED with `authenticated: false` (no credential in the body).
    setSimConnectionTestOutcome(sim.store, CaptureConnectionOutcome.AUTHENTICATION_FAILED)
    expect(screen.queryByTestId('camera-connect-fields')).not.toBeInTheDocument()
    tick()
    const test = screen.getByTestId('camera-connect-test')
    await waitFor(() => expect(test).toBeEnabled())
    fireEvent.click(test)
    const outcome = await screen.findByTestId('camera-connect-outcome')
    await waitFor(() => expect(outcome).toHaveAttribute('data-outcome', 'AUTHENTICATION_FAILED'))
    expect(outcome).toHaveAttribute('data-authenticated', 'false')
    expect(outcome).toHaveTextContent(W.noCredentialSent)
    expect(screen.getByTestId('camera-connect-no-credential')).toHaveTextContent(W.noCredentialNext)
    expect(outcome).not.toHaveTextContent(C.outcome.AUTHENTICATION_FAILED)
    expect(screen.queryByTestId('camera-connect-attempts')).not.toBeInTheDocument()
    expect(outcome).not.toHaveTextContent(/more attempts? before/)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL - a test WITH a credential that the camera refuses keeps "The camera refused ..." and the attempts line', async () => {
    const sim = await openConnect()
    setSimConnectionTestOutcome(sim.store, CaptureConnectionOutcome.AUTHENTICATION_FAILED)
    fireEvent.click(within(screen.getByTestId('camera-connect-with-credential')).getByRole('switch'))
    await screen.findByTestId('camera-connect-fields')
    tick()
    fireEvent.change(screen.getByTestId('camera-connect-username'), { target: { value: 'operator' } })
    fireEvent.change(screen.getByTestId('camera-connect-password'), { target: { value: 'fixture-pass' } })
    const test = screen.getByTestId('camera-connect-test')
    await waitFor(() => expect(test).toBeEnabled())
    fireEvent.click(test)
    const outcome = await screen.findByTestId('camera-connect-outcome')
    await waitFor(() => expect(outcome).toHaveAttribute('data-outcome', 'AUTHENTICATION_FAILED'))
    expect(outcome).toHaveTextContent(C.outcome.AUTHENTICATION_FAILED)
    expect(screen.getByTestId('camera-connect-attempts')).toHaveTextContent(/more attempts? before testing this camera is paused\./)
    expect(screen.queryByTestId('camera-connect-no-credential')).not.toBeInTheDocument()
  })
})
