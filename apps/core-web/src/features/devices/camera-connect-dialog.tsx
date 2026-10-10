import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { Alert, Button, Checkbox, Label, Modal, Spinner, Switch } from '@heroui/react'
import { Cable, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  CAPTURE_CONNECTION_TEST_TIMEOUT_MS,
  CAPTURE_CREDENTIAL_SECRET_MAX_LENGTH,
  CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH,
  CaptureConnectionOutcome,
  CaptureConnectionTestReason,
  CaptureSourceClass,
  type CaptureCandidate,
  type CaptureCandidateAdoption,
  type CaptureConnectionTest,
} from '@dems/shared/api'
import { formatClock } from '@dems/shared/realtime'
import { useSim, useSimInstance } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { useWebLive } from '@/runtime'
import {
  adoptCandidate,
  CONNECT_FIELD,
  connectRefusal,
  credentialOf,
  hasConnectErrors,
  OUTCOME_TONE,
  outcomeRole,
  testCandidateConnection,
  validateConnectForm,
  type ConnectFailure,
  type ConnectFormErrors,
  type ConnectFormValues,
  type ConnectOperation,
  type ConnectRefusal,
} from './camera-connect'
import { candidateName, makeModelOf } from './camera-search'
import { DevicesErrorBoundary } from './panel'
import { reportDevicesError } from './report'
import { DevelopmentSourceBadge } from './source-badge'

/** The fixed sentences of the page's own record. They name the operation and the answer's codes; never anything the operator typed. */
const CONNECT_FAILED_RECORD = 'A step of the camera connect flow was not carried out.'
const CONNECT_THREW_RECORD = 'A step of the camera connect flow could not be sent.'

export type ConnectDialogExit =
  /** Closed: nothing more to do. */
  | { readonly kind: 'CLOSED' }
  /** "Assign to a camera slot": close and go to the selector (flow 1). */
  | { readonly kind: 'ASSIGN' }
  /** The result is no longer kept: close and search again (flow 9). */
  | { readonly kind: 'SEARCH_AGAIN' }
  | { readonly kind: 'VIEW_DEVICE'; readonly deviceId: string }

export interface CameraConnectDialogProps {
  /** The row whose Connect was pressed, or `null` (closed). */
  readonly candidate: CaptureCandidate | null
  /** A session is open now (`captureConfig.locked`): Test and Add are disabled with the sentence, in an open dialog too. */
  readonly locked: boolean
  /** The label of a registered device ("CAM-03 · Camera 3"), for the sentences that name one. */
  readonly deviceLabel: (deviceId: string) => string
  /** Reads operation 94 again after an answer of 95 or 96, so the row shows what the Core holds. */
  readonly onAnswered: () => void
  readonly onExit: (exit: ConnectDialogExit) => void
}

/**
 * The connect dialog (ux §8d; web console only, D80(3)): the target and what is known of it, the
 * camera user name and password, the confirmation tick, ONE connection test, its outcome, and "Add
 * as camera". The order cannot be skipped: Test connection is enabled only after the tick
 * (SEC35-31), and Add as camera exists only after an outcome that says the camera can be added.
 *
 * The body is mounted only while the dialog is open and is keyed by the row, so every opening starts
 * with two empty fields and closing unmounts them: nothing typed outlives the dialog (R-9 AC-8).
 *
 * WHERE THE TYPED TEXT IS (review row 69, finding R69-04; decision D134): in the two `<input>`
 * elements and nowhere else. They are UNCONTROLLED - no `value`, no `defaultValue` - so React never
 * writes the typed text into the `value` attribute, and no state, prop or form library holds it:
 * the text is read from the element at the press, and "both fields have text" is two booleans. They
 * are plain inputs with the kit's classes, not the kit `TextField`: react-aria always controls its
 * input (`useTextField`), which is what wrote the attribute.
 * While a request is out the dialog cannot be closed (the request cannot be recalled).
 */
export function CameraConnectDialog({ candidate, locked, deviceLabel, onAnswered, onExit }: CameraConnectDialogProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  // A new body for every opening, of the same row too.
  const [opening, setOpening] = useState(0)
  const [shownId, setShownId] = useState<string | null>(null)
  const openId = candidate?.candidateId ?? null
  if (openId !== shownId) {
    setShownId(openId)
    if (openId !== null) setOpening((count) => count + 1)
  }
  const title = candidate === null ? t('common.captureConnect.action') : t('common.captureConnect.title', { name: candidateName(candidate) })
  return (
    <Modal.Backdrop
      isOpen={candidate !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onExit({ kind: 'CLOSED' })
      }}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      variant="blur"
    >
      <Modal.Container size="md" placement="center">
        <Modal.Dialog aria-label={title} data-testid="camera-connect-dialog" data-candidate={openId ?? undefined}>
          {candidate === null ? null : (
            // Its own boundary: a failure inside the dialog shows the fallback there and never blanks the page (layer 3).
            <DevicesErrorBoundary panel="camera-connect">
              <ConnectBody key={`${candidate.candidateId}:${opening}`} candidate={candidate} locked={locked} deviceLabel={deviceLabel} onAnswered={onAnswered} onExit={onExit} onBusy={setBusy} />
            </DevicesErrorBoundary>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

/** A refusal the dialog words itself, with the facts its sentence needs. Codes, ids and Core instants only. */
interface RefusalView {
  readonly kind: Exclude<ConnectRefusal, 'CREDENTIAL_REQUIRED' | 'INVALID_INPUT' | 'ROLE'>
  readonly operationId: ConnectOperation
  readonly deviceId: string | null
  readonly outcome: CaptureConnectionOutcome | null
  /** `LOCKOUT_GUARD`: the Core instant after which a test is taken again. A clock time, never a countdown. */
  readonly until: number | null
  /** `RATE_LIMITED`: the Core's own number of seconds, written once. */
  readonly seconds: number | null
}

type Phase = 'FORM' | 'TESTING' | 'ADDING' | 'ADDED'

function ConnectBody({
  candidate,
  locked,
  deviceLabel,
  onAnswered,
  onExit,
  onBusy,
}: Omit<CameraConnectDialogProps, 'candidate'> & { readonly candidate: CaptureCandidate; readonly onBusy: (busy: boolean) => void }) {
  const { t } = useTranslation()
  const live = useWebLive()
  const sim = useSimInstance()
  const presentCoreError = useCoreErrorPresenter()
  const coreNow = useSim((state) => state.clock.now)
  const development = candidate.sourceClass === CaptureSourceClass.DEVELOPMENT
  const [fieldErrors, setFieldErrors] = useState<ConnectFormErrors>({})
  /** A development source needs no password; the switch shows the two fields for a test camera that has one. */
  const [withCredential, setWithCredential] = useState(!development)
  const [confirmed, setConfirmed] = useState(false)
  /** D86 C-1: off by default; back to hidden on blur, on submit and on close (the body unmounts). */
  const [reveal, setReveal] = useState(false)
  const [phase, setPhase] = useState<Phase>('FORM')
  const [tested, setTested] = useState<CaptureConnectionTest | null>(null)
  const [refusal, setRefusal] = useState<RefusalView | null>(null)
  const [requestFailed, setRequestFailed] = useState(false)
  const [adoption, setAdoption] = useState<CaptureCandidateAdoption | null>(null)
  const [pausedFor, setPausedFor] = useState<number | null>(null)
  const inFlight = useRef(false)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const revealRef = useRef<HTMLButtonElement | null>(null)
  const outcomeRef = useRef<HTMLDivElement | null>(null)
  const usernameRef = useRef<HTMLInputElement | null>(null)
  /** Whether each field holds text: two facts, never the text (the Test button needs no more). */
  const [filledUsername, setFilledUsername] = useState(false)
  const [filledPassword, setFilledPassword] = useState(false)
  const fieldId = useId()
  /** The typed values, read from the two elements at the press and handed straight to the check and the call. */
  const typedValues = (): ConnectFormValues => ({ username: usernameRef.current?.value ?? '', password: passwordRef.current?.value ?? '' })
  const clearPassword = () => {
    if (passwordRef.current !== null) passwordRef.current.value = ''
    setFilledPassword(false)
  }
  const clearBoth = () => {
    if (usernameRef.current !== null) usernameRef.current.value = ''
    setFilledUsername(false)
    clearPassword()
  }
  const showCredential = (on: boolean) => {
    // The two inputs unmount with the switch: what they held is gone with them.
    setFilledUsername(false)
    setFilledPassword(false)
    setFieldErrors({})
    setWithCredential(on)
  }

  const busy = phase === 'TESTING' || phase === 'ADDING'
  const reachable = tested?.outcome === CaptureConnectionOutcome.REACHABLE
  const guardClosed = tested?.outcome === CaptureConnectionOutcome.AUTHENTICATION_FAILED && tested.failedAttemptsRemaining === 0
  const paused = pausedFor !== null
  const lockedNow = locked || refusal?.kind === 'LOCKED'
  const stopped = refusal !== null && ['RESULT_GONE', 'ALREADY_REGISTERED', 'NOT_TESTABLE', 'SEARCH_NOT_READY', 'LOCKOUT_GUARD'].includes(refusal.kind)
  const fieldsReadOnly = busy || reachable
  const filled = !withCredential || (filledUsername && filledPassword)
  const canTest = confirmed && filled && !busy && !reachable && !lockedNow && !paused && !guardClosed && !stopped
  const canAdd = reachable && !busy && !lockedNow && !paused && !stopped && refusal?.kind !== 'STORE_NOT_READY'

  // The pause after a rate limit or the lock-out guard ends by itself at the instant the Core named:
  // the buttons re-enable, nothing is sent, and no label counts down.
  useEffect(() => {
    if (pausedFor === null) return undefined
    const timer = setTimeout(() => setPausedFor(null), pausedFor * 1000)
    return () => clearTimeout(timer)
  }, [pausedFor])

  // ux §14.3: the outcome receives focus when it arrives.
  useEffect(() => {
    if (tested !== null || refusal !== null) outcomeRef.current?.focus()
  }, [tested, refusal])

  const settleFailure = (failure: ConnectFailure) => {
    const kind = connectRefusal(failure)
    if (kind === 'CREDENTIAL_REQUIRED') {
      if (!withCredential) showCredential(true)
      setFieldErrors({ username: 'required', password: 'required' })
      return
    }
    if (kind === 'INVALID_INPUT') {
      setFieldErrors({ username: 'charset', password: 'charset' })
      return
    }
    if (kind === 'ROLE' || kind === 'OTHER') {
      // The shared presenter first (an outage, a time-out, a 403); what it leaves is said here and recorded with codes only.
      if (failure.failure !== null && presentCoreError(failure.failure) !== null) return
      reportDevicesError('features/devices.cameraConnect', null, CONNECT_FAILED_RECORD, { operationId: failure.operationId, status: failure.status, code: failure.code, reason: failure.reason })
      setRequestFailed(true)
      return
    }
    const seconds = failure.retryAfterSeconds === null ? null : Math.max(1, failure.retryAfterSeconds)
    if (kind === 'LOCKOUT_GUARD' || kind === 'RATE_LIMITED') setPausedFor(seconds ?? 1)
    // The passing test is no longer one: the fields open again and a new test is needed.
    if (kind === 'NOT_TESTED' || kind === 'FINAL_CHECK_FAILED') setTested(null)
    setRefusal({
      kind,
      operationId: failure.operationId,
      deviceId: failure.deviceId,
      outcome: failure.outcome,
      until: kind === 'LOCKOUT_GUARD' && seconds !== null ? coreNow + seconds * 1000 : null,
      seconds: kind === 'RATE_LIMITED' ? seconds : null,
    })
  }

  /** One request per press. Nothing here sends a second one: a retry is the operator's next press. */
  const send = async <T,>(next: Phase, operationId: ConnectOperation, call: () => Promise<{ readonly ok: true; readonly data: T } | ConnectFailure>, ok: (data: T) => void) => {
    if (inFlight.current) return
    inFlight.current = true
    setReveal(false)
    setRefusal(null)
    setRequestFailed(false)
    setPhase(next)
    onBusy(true)
    let done: Phase = 'FORM'
    try {
      const answer = await call()
      if (answer.ok) {
        ok(answer.data)
        if (next === 'ADDING') done = 'ADDED'
      } else settleFailure(answer)
    } catch (error) {
      // A call that could not even be made (a programming error of the client): the class of the error, never its text.
      reportDevicesError('features/devices.cameraConnect', error, CONNECT_THREW_RECORD, { operationId })
      setRequestFailed(true)
    } finally {
      inFlight.current = false
      setPhase(done)
      onBusy(false)
      onAnswered()
    }
  }

  const onTest = () => {
    if (!canTest) return
    const values = typedValues()
    if (withCredential) {
      // Field and message key only: the result of the check holds no typed character.
      const errors = validateConnectForm(values)
      setFieldErrors(errors)
      if (hasConnectErrors(errors)) return
    }
    const credential = withCredential ? credentialOf(values) : null
    setTested(null)
    void send('TESTING', 'testCaptureCandidateConnection', () => testCandidateConnection({ live, sim }, candidate.candidateId, credential), (result) => {
      setTested(result)
      if (result.outcome === CaptureConnectionOutcome.AUTHENTICATION_FAILED) {
        // The password leaves the field; the user name stays. After a refused password the focus goes to the
        // password field; a camera whose sign-in method is not answered (R69-13) was sent nothing, and typing again does not help.
        clearPassword()
        if (result.reason !== CaptureConnectionTestReason.SCHEME_NOT_ALLOWED) passwordRef.current?.focus()
      }
    })
  }

  const onAdd = () => {
    if (!canAdd) return
    // Exactly what was tested: the fields have been read-only since the passing test.
    const credential = withCredential ? credentialOf(typedValues()) : null
    void send('ADDING', 'adoptCaptureCandidate', () => adoptCandidate({ live, sim }, candidate.candidateId, credential), (result) => {
      setAdoption(result)
      // The typed values have done their work: they leave the fields with the answer.
      clearBoth()
    })
  }

  const onChangeValues = () => {
    setTested(null)
    setRefusal(null)
  }

  const close = () => {
    if (!busy) onExit({ kind: 'CLOSED' })
  }

  const name = candidateName(candidate)
  const makeModel = makeModelOf(candidate)
  /** R69-12 (decision D178): what the Core will connect to - scheme, host, port, path - as the Core sent it; the host alone where it sent none (Simulated capture). */
  const target = candidate.connectionTarget ?? null
  const schemeNotAllowed = tested?.outcome === CaptureConnectionOutcome.AUTHENTICATION_FAILED && tested.reason === CaptureConnectionTestReason.SCHEME_NOT_ALLOWED

  if (phase === 'ADDED' && adoption !== null) {
    return (
      <>
        <Modal.Header>
          <Modal.Icon>
            <Cable className="size-5" aria-hidden="true" />
          </Modal.Icon>
          <Modal.Heading>{t('common.captureConnect.added', { device: adoption.deviceId })}</Modal.Heading>
        </Modal.Header>
        <Modal.Body className="dev-connect-body" data-testid="camera-connect-added" data-device={adoption.deviceId} data-credential-set={adoption.credentialSet ? 'true' : 'false'}>
          <p className="dev-connect-line">
            <bdi>{makeModel ?? t('common.captureSearch.makeModelUnknown')}</bdi>
          </p>
          {/* The fact only: no value, no length, no hint (ux §8d.6; row 137: a stored credential is never rendered). */}
          <p className="dev-connect-line" data-testid="camera-connect-credential-fact">
            {t(adoption.credentialSet ? 'common.captureConnect.passwordStored' : 'common.captureConnect.noPasswordUsed')}
          </p>
          <p className="dev-connect-line">{t('common.captureConnect.addedNext')}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onPress={close} data-testid="camera-connect-done">
            {t('common.actions.done')}
          </Button>
          <Button variant="primary" onPress={() => onExit({ kind: 'ASSIGN' })} data-testid="camera-connect-assign">
            {t('common.captureConnect.assign')}
          </Button>
        </Modal.Footer>
      </>
    )
  }

  return (
    <>
      <Modal.Header>
        <Modal.Icon>
          <Cable className="size-5" aria-hidden="true" />
        </Modal.Icon>
        <Modal.Heading>
          <bdi>{t('common.captureConnect.title', { name })}</bdi>
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body className="dev-connect-body" data-testid="camera-connect-body" data-phase={phase} aria-busy={busy || undefined}>
        {/* SEC35-31 (3): what the operator needs to know of the target, as plain text — never a link. */}
        <dl className="dev-connect-target" data-testid="camera-connect-target">
          <div>
            <dt>{t('common.captureSearch.columns.address')}</dt>
            <dd className="font-mono" data-testid="camera-connect-address">
              {candidate.host}
            </dd>
          </div>
          {target === null ? null : (
            // The full target, as plain text and never a link: its scheme, port and path are what the device announced.
            <div className="dev-connect-target-full">
              <dt>{t('common.captureConnectTarget.label')}</dt>
              <dd className="font-mono" data-testid="camera-connect-target-full">
                <bdi>{target}</bdi>
              </dd>
            </div>
          )}
          <div>
            <dt>{t('common.captureSearch.columns.makeModel')}</dt>
            <dd>
              <bdi>{makeModel ?? t('common.captureSearch.makeModelUnknown')}</bdi>
            </dd>
          </div>
          <div>
            <dt>{t('common.captureConnect.reference')}</dt>
            <dd className="font-mono" data-testid="camera-connect-reference">
              <bdi>{candidate.endpointRef ?? t('devices.search.notAnnounced')}</bdi>
            </dd>
          </div>
        </dl>
        <p className="dev-connect-line" data-testid="camera-connect-unverified">
          {t('common.captureConnect.unverified')}
        </p>
        {development ? <DevelopmentSourceBadge adapter={candidate.adapter} kind="CAMERA" testId="camera-connect-badge" /> : null}

        {development ? (
          <>
            <p className="dev-connect-line" data-testid="camera-connect-no-password">
              {t('common.captureConnect.noPasswordNeeded')}
            </p>
            <Switch isSelected={withCredential} onChange={showCredential} isDisabled={fieldsReadOnly} data-testid="camera-connect-with-credential">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Label>{t('common.captureConnect.enterPassword')}</Label>
              </Switch.Content>
            </Switch>
          </>
        ) : null}

        {withCredential ? (
          // No <form>: nothing is submitted natively, and a browser has no sign-in form to match (SEC35-37).
          <div className="dev-connect-fields" data-testid="camera-connect-fields">
            <p className="dev-connect-line">{t('common.captureConnect.intro')}</p>
            <p className="dev-connect-line">{t('common.captureConnect.digestNote')}</p>
            {/* Two plain UNCONTROLLED inputs with the kit's field classes (see the comment of the dialog): no `value`, no `defaultValue`. */}
            <div className="textfield" data-invalid={fieldErrors.username === undefined ? undefined : 'true'}>
              <label className="label" htmlFor={`${fieldId}-username`}>
                {t('common.captureConnect.username')}
              </label>
              <div className="input-group input-group--full-width" data-slot="input-group" data-invalid={fieldErrors.username === undefined ? undefined : 'true'}>
                <input
                  {...CONNECT_FIELD.input}
                  ref={usernameRef}
                  id={`${fieldId}-username`}
                  className="input-group__input"
                  data-slot="input-group-input"
                  type="text"
                  name={CONNECT_FIELD.username.name}
                  autoComplete={CONNECT_FIELD.username.autoComplete}
                  maxLength={CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH}
                  readOnly={fieldsReadOnly}
                  aria-invalid={fieldErrors.username === undefined ? undefined : true}
                  aria-describedby={fieldErrors.username === undefined ? undefined : `${fieldId}-username-error`}
                  autoFocus
                  onChange={(event) => {
                    // A fact about the text, never the text.
                    setFilledUsername(event.currentTarget.value.trim().length > 0)
                    setFieldErrors(({ username: _username, ...rest }) => rest)
                  }}
                  data-testid="camera-connect-username"
                />
              </div>
              {fieldErrors.username === undefined ? null : (
                <p className="field-error" data-slot="field-error" data-visible="true" id={`${fieldId}-username-error`} data-testid="camera-connect-username-error">
                  {t(`common.captureConnect.${fieldErrors.username}`)}
                </p>
              )}
            </div>
            <div className="textfield" data-invalid={fieldErrors.password === undefined ? undefined : 'true'}>
              <label className="label" htmlFor={`${fieldId}-password`}>
                {t('common.captureConnect.password')}
              </label>
              <div className="input-group input-group--full-width" data-slot="input-group" data-invalid={fieldErrors.password === undefined ? undefined : 'true'}>
                <input
                  {...CONNECT_FIELD.input}
                  ref={passwordRef}
                  id={`${fieldId}-password`}
                  className="input-group__input"
                  data-slot="input-group-input"
                  type={reveal ? 'text' : 'password'}
                  name={CONNECT_FIELD.password.name}
                  autoComplete={CONNECT_FIELD.password.autoComplete}
                  maxLength={CAPTURE_CREDENTIAL_SECRET_MAX_LENGTH}
                  readOnly={fieldsReadOnly}
                  aria-invalid={fieldErrors.password === undefined ? undefined : true}
                  aria-describedby={fieldErrors.password === undefined ? `${fieldId}-password-description` : `${fieldId}-password-error`}
                  onChange={(event) => {
                    setFilledPassword(event.currentTarget.value.length > 0)
                    setFieldErrors(({ password: _password, ...rest }) => rest)
                  }}
                  data-testid="camera-connect-password"
                  data-reveal={reveal ? 'on' : 'off'}
                  // Leaving the field hides the text again, unless the focus went to the reveal button itself.
                  onBlur={(event) => {
                    if (event.relatedTarget !== revealRef.current) setReveal(false)
                  }}
                />
                <span className="input-group__suffix" data-slot="input-group-suffix">
                  <Button
                    ref={revealRef}
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={t(reveal ? 'common.captureConnect.reveal.hide' : 'common.captureConnect.reveal.show')}
                    aria-pressed={reveal}
                    isDisabled={fieldsReadOnly}
                    onPress={() => setReveal((on) => !on)}
                    onBlur={(event) => {
                      if (event.relatedTarget !== passwordRef.current) setReveal(false)
                    }}
                    data-testid="camera-connect-reveal"
                  >
                    {reveal ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
                  </Button>
                </span>
              </div>
              {fieldErrors.password === undefined ? (
                <p className="description" data-slot="description" id={`${fieldId}-password-description`}>
                  {t('common.captureConnect.charset')}
                </p>
              ) : (
                <p className="field-error" data-slot="field-error" data-visible="true" id={`${fieldId}-password-error`} data-testid="camera-connect-password-error">
                  {t(`common.captureConnect.${fieldErrors.password}`)}
                </p>
              )}
            </div>
            {reachable ? (
              <Button size="sm" variant="ghost" onPress={onChangeValues} isDisabled={busy} data-testid="camera-connect-change">
                {t('common.captureConnect.change')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* SEC35-31 (3): Test connection is enabled only after this tick. */}
        <Checkbox isSelected={confirmed} onChange={setConfirmed} isDisabled={busy} data-testid="camera-connect-confirm">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Label>{target === null ? t('common.captureConnect.confirmDevice', { address: candidate.host }) : t('common.captureConnectTarget.confirm', { target })}</Label>
          </Checkbox.Content>
        </Checkbox>

        {busy ? (
          <p className="dev-connect-line" role="status" aria-live="polite" data-testid="camera-connect-progress">
            {phase === 'TESTING'
              ? `${t('common.captureConnect.testing')} ${t('common.captureConnect.testingHint', { seconds: CAPTURE_CONNECTION_TEST_TIMEOUT_MS / 1000 })}`
              : t('common.captureConnect.adding')}
          </p>
        ) : null}

        {tested !== null && !busy ? (
          <Alert
            ref={outcomeRef}
            tabIndex={-1}
            status={OUTCOME_TONE[tested.outcome]}
            role={outcomeRole(tested.outcome)}
            data-testid="camera-connect-outcome"
            data-outcome={tested.outcome}
            data-reason={tested.reason}
          >
            <Alert.Indicator />
            <Alert.Content>
              {/* R69-13: nothing was sent to a camera whose sign-in method is not answered - never worded as a refused password. */}
              <Alert.Title>{schemeNotAllowed ? t('common.captureConnectTarget.schemeNotAllowed') : t(`common.captureConnect.outcome.${tested.outcome}`)}</Alert.Title>
              {schemeNotAllowed ? <Alert.Description data-testid="camera-connect-scheme">{t('common.captureConnectTarget.schemeNotAllowedDetail')}</Alert.Description> : null}
              {reachable ? <Alert.Description>{t('common.captureConnect.profiles', { count: tested.usableProfileCount })}</Alert.Description> : null}
              {tested.outcome === CaptureConnectionOutcome.AUTHENTICATION_FAILED ? (
                <Alert.Description data-testid="camera-connect-attempts">
                  {guardClosed ? t('devices.search.lockoutNoTime') : t('common.captureConnect.attemptsLeft', { count: tested.failedAttemptsRemaining })}
                </Alert.Description>
              ) : null}
            </Alert.Content>
          </Alert>
        ) : null}

        {lockedNow ? (
          // Not a danger state and never a toast (D80(4)): a session is open, so no camera is connected now.
          <Alert status="accent" data-testid="camera-connect-locked">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('common.captureConnect.locked')}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}

        {refusal !== null && refusal.kind !== 'LOCKED' && !busy ? (
          <RefusalNotice ref={tested === null ? outcomeRef : undefined} refusal={refusal} deviceLabel={deviceLabel} onExit={onExit} />
        ) : null}

        {requestFailed && !busy ? (
          <Alert status="danger" role="alert" data-testid="camera-connect-request-failed">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('devices.search.requestFailed')}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close} isDisabled={busy} data-testid="camera-connect-close">
          {t('common.actions.close')}
        </Button>
        <Button variant={reachable ? 'outline' : 'primary'} onPress={onTest} isDisabled={!canTest} isPending={phase === 'TESTING'} data-testid="camera-connect-test">
          {phase === 'TESTING' ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
          {t('common.captureConnect.test')}
        </Button>
        {/* Add as camera exists only after an outcome that says the camera can be added (ux §8d.2 "Order"). */}
        {reachable || phase === 'ADDING' ? (
          <Button variant="primary" onPress={onAdd} isDisabled={!canAdd} isPending={phase === 'ADDING'} data-testid="camera-connect-add">
            {phase === 'ADDING' ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
            {t('common.captureConnect.add')}
          </Button>
        ) : null}
      </Modal.Footer>
    </>
  )
}

const REFUSAL_TONE: Readonly<Record<RefusalView['kind'], 'warning' | 'danger' | 'accent'>> = {
  LOCKED: 'accent',
  RESULT_GONE: 'warning',
  ALREADY_REGISTERED: 'accent',
  NOT_TESTABLE: 'warning',
  IN_PROGRESS: 'accent',
  NOT_TESTED: 'warning',
  FINAL_CHECK_FAILED: 'danger',
  STORE_NOT_READY: 'warning',
  SEARCH_NOT_READY: 'warning',
  LOCKOUT_GUARD: 'warning',
  RATE_LIMITED: 'warning',
  OTHER: 'danger',
}

function RefusalNotice({
  ref,
  refusal,
  deviceLabel,
  onExit,
}: {
  ref: Ref<HTMLDivElement> | undefined
  refusal: RefusalView
  deviceLabel: (deviceId: string) => string
  onExit: (exit: ConnectDialogExit) => void
}) {
  const { t } = useTranslation()
  const device = refusal.deviceId === null ? null : deviceLabel(refusal.deviceId)
  let title: string
  let detail: string | null = null
  switch (refusal.kind) {
    case 'RESULT_GONE':
      title = t('common.captureConnect.resultGone')
      break
    case 'ALREADY_REGISTERED':
      title = device === null ? t('common.captureSearch.status.REGISTERED') : t('common.captureConnect.alreadyRegistered', { device })
      break
    case 'NOT_TESTABLE':
      title = t('common.captureSearch.notTestableBody')
      break
    case 'IN_PROGRESS':
      title = t('common.captureConnect.inProgress')
      break
    case 'NOT_TESTED':
      title = t('common.captureConnect.testTooOld')
      break
    case 'FINAL_CHECK_FAILED':
      title = t('common.captureConnect.finalCheckFailed')
      detail = refusal.outcome === null ? null : t(`common.captureConnect.outcome.${refusal.outcome}`)
      break
    case 'STORE_NOT_READY':
      title = t('common.captureConnect.storeNotReady')
      break
    case 'SEARCH_NOT_READY':
      title = t('common.captureSearch.unavailable')
      break
    case 'LOCKOUT_GUARD':
      // A clock time from the Core's own instant; it does not count down.
      title = refusal.until === null ? t('devices.search.lockoutNoTime') : t('common.captureConnect.lockoutGuard', { time: formatClock(refusal.until) })
      break
    case 'RATE_LIMITED':
      title = refusal.seconds === null ? t('common.coreErrors.limitedNoTime') : t('common.coreErrors.limited', { seconds: refusal.seconds })
      break
    case 'LOCKED':
    case 'OTHER':
      title = t('devices.search.requestFailed')
      break
  }
  return (
    <Alert ref={ref} tabIndex={-1} status={REFUSAL_TONE[refusal.kind]} role="alert" data-testid="camera-connect-refusal" data-refusal={refusal.kind}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {detail === null ? null : <Alert.Description>{detail}</Alert.Description>}
      </Alert.Content>
      {refusal.kind === 'RESULT_GONE' ? (
        <Button size="sm" variant="outline" onPress={() => onExit({ kind: 'SEARCH_AGAIN' })} data-testid="camera-connect-search-again">
          {t('common.captureSearch.again')}
        </Button>
      ) : null}
      {refusal.kind === 'ALREADY_REGISTERED' && refusal.deviceId !== null ? (
        <Button size="sm" variant="outline" onPress={() => onExit({ kind: 'VIEW_DEVICE', deviceId: refusal.deviceId! })} data-testid="camera-connect-view-device">
          {t('common.captureSearch.viewDevice')}
        </Button>
      ) : null}
    </Alert>
  )
}
