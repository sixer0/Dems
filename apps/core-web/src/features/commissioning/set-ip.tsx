/**
 * The set-IP screens of the commissioning area (task 4, blueprint row 113, package WP-22c;
 * operations 106 `setCameraNetwork` and 107 `getCameraNetworkJob` as built by
 * `implementation/111_set_ip_job.md`; decisions C1, C7, U10; requirement S13-12 (d)). One panel of
 * `/admin/commissioning`, TECHNICIAN only: the page draws it only behind its role gate.
 *
 * | State | What the panel shows |
 * |-------|----------------------|
 * | No camera chosen | What the job does, and that the camera is chosen in a row of the last scan |
 * | A camera of the last scan is chosen | THE DEVICE THAT WILL BE RE-ADDRESSED: its present address, the hardware address the scan read from the neighbour table, what it announced. Then the new address (optional), the gateway (optional), the camera account, the tick "this is the camera I mean", Start and Cancel |
 * | A job runs or has ended | THE THREE HARDWARE ADDRESSES side by side - the neighbour table's, the one the camera stated after sign-in, the one answering at the new address - with the TARGET address, the step, and whether the first two say "the same device". A mismatch is said as a stop: nothing was set |
 *
 * THE TYPED CAMERA ACCOUNT (decisions C1, C7; the discipline of the connect dialog, fix F-M4):
 *   1. It is in the two UNCONTROLLED inputs and nowhere else: no React state, no form library, no
 *      `value` attribute. The state holds two FACTS ("this field holds text"), never the text.
 *   2. It is read at the press, handed to the checks and to the ONE call, and referenced by nothing
 *      of this component when the handler returns.
 *   3. Both fields are EMPTIED: at the press that starts the job (before the request leaves), on
 *      Cancel, when the form unmounts (the job started, another camera was chosen, a new scan
 *      arrived, the page was left), on every navigation of the router (also one that keeps the page
 *      mounted) and when the document is hidden for good (`pagehide`).
 *   4. It is never put in a URL, the router's state, a query or mutation cache, browser storage, a
 *      log record or an error boundary's message: no code path here hands it to any of them, and
 *      the folder's error boundary quotes no error (`parts.tsx`).
 *   5. The fields are never pre-filled: no `value`, no `defaultValue`, and attributes that keep a
 *      browser from offering the console's own login.
 * No `<form>` element: nothing is submitted natively, and a browser has no sign-in form to match.
 *
 * A CORE THAT CANNOT RUN THE JOB answers `409 COMMISSIONING_NOT_AVAILABLE` - a Core that is not in
 * production capture operation, AND a production Core whose host does not provide the job's inputs
 * (record 111, section 8). The panel says both in plain words; it does not claim to know which.
 *
 * Kit: `@heroui/react` (Alert, Button, Checkbox, Chip, TextField); the two account inputs are plain
 * inputs with the kit's field classes, as in the connect dialog, because the kit's field keeps its
 * text in component state.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Button, Checkbox, Chip, Description, FieldError, Input, Label, Spinner, TextField } from '@heroui/react'
import { useRouter } from '@tanstack/react-router'
import { ArrowRightLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  CAMERA_NETWORK_SET_WAIT_MS,
  CAPTURE_COMMISSIONING_REFUSAL_SENTENCES,
  CAPTURE_CREDENTIAL_SECRET_MAX_LENGTH,
  CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH,
  CameraNetworkJobFailure,
  CameraNetworkJobState,
  type CameraNetworkJob,
  type FactoryCamera,
} from '@dems/shared/api'
import { usePendingControl } from '@/lib/pending-control'
import { credentialOf, hasConnectErrors, validateConnectForm, type ConnectFormErrors } from '../devices/camera-connect'
import type { CommissioningTarget } from './model'
import { Panel, RetryButton, SentenceAlert } from './parts'
import { usePresentUnworded, useRefusalSentence } from './refusal'
import { COMMISSIONING_RECORD, reportCommissioningError } from './report'
import {
  SET_IP_FIELD,
  SET_IP_POLL_MAX_FAILURES,
  SET_IP_POLL_MS,
  macVerdict,
  readCameraNetworkJob,
  setIpBodyOf,
  setIpRefusal,
  startCameraNetworkJob,
  validateSetIpAddresses,
  type SetIpAddressErrors,
  type SetIpAddressValues,
  type SetIpRefusal,
} from './set-ip-model'

// ── The panel ────────────────────────────────────────────────────────────────────────────

export interface SetIpPanelProps {
  readonly target: CommissioningTarget
  /** The camera chosen in a row of the LAST scan; `null` for none. The page drops it when a new scan arrives. */
  readonly picked: FactoryCamera | null
  /** The choice is given up (Cancel, or a job's view was closed). */
  readonly onClose: () => void
  /** A job of this panel runs / runs no more: the page offers no other camera meanwhile. */
  readonly onRunning: (running: boolean) => void
  /** A job ended (or was lost): the temporary host address may have changed - the page reads it again. */
  readonly onJobEnded: () => void
}

export function SetIpPanel({ target, picked, onClose, onRunning, onJobEnded }: SetIpPanelProps) {
  const { t } = useTranslation()
  /** The job this page started. It holds no credential (the contract's `CameraNetworkJob`). In memory only: never a URL, never storage. */
  const [job, setJob] = useState<CameraNetworkJob | null>(null)
  /** The registered camera the scan named at the job's address, for the closing note. */
  const [registered, setRegistered] = useState<string | null>(null)

  const close = () => {
    setJob(null)
    setRegistered(null)
    onRunning(false)
    onClose()
  }

  return (
    <Panel id="setip" icon={ArrowRightLeft} title={t('web.commissioning.setIp.title')} busy={job?.state === CameraNetworkJobState.RUNNING}>
      <p className="com-text">{t('web.commissioning.setIp.intro')}</p>
      {target.live === null ? (
        // SIMULATOR-ONLY: no camera is changed and no job starts; every start is answered "not available".
        <p className="com-text" data-testid="com-setip-simulated">
          {t('web.commissioning.setIp.simulated')}
        </p>
      ) : null}
      {job !== null ? (
        <JobView
          key={job.jobId}
          target={target}
          job={job}
          registered={registered}
          // An ended job is final: a late answer of an earlier read never replaces it.
          onJob={(next) => setJob((current) => (current === null || current.jobId !== next.jobId || current.state !== CameraNetworkJobState.RUNNING ? current : next))}
          onSettled={() => {
            onRunning(false)
            onJobEnded()
          }}
          onClose={close}
        />
      ) : picked === null ? (
        <p className="com-text" data-testid="com-setip-need-scan">
          {t('web.commissioning.setIp.needScan')}
        </p>
      ) : (
        <SetIpForm
          // Another camera is another form: the fields of the previous one unmount, and are emptied as they do.
          key={picked.address}
          target={target}
          camera={picked}
          onStarted={(started) => {
            setRegistered(picked.registeredDeviceId)
            setJob(started)
            onRunning(started.state === CameraNetworkJobState.RUNNING)
          }}
          onCancel={onClose}
        />
      )}
    </Panel>
  )
}

// ── The form ─────────────────────────────────────────────────────────────────────────────

function SetIpForm({ target, camera, onStarted, onCancel }: { target: CommissioningTarget; camera: FactoryCamera; onStarted: (job: CameraNetworkJob) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const router = useRouter()
  const presentUnworded = usePresentUnworded()
  const sentenceOf = useRefusalSentence()
  const control = usePendingControl()
  const { ref: startRef } = control
  const fieldId = useId()
  /**
   * The two account elements. Kept here past React's own detach of a ref, so that the unmount can
   * still empty them. The ONLY place the typed account can be read from.
   */
  const held = useRef<{ username: HTMLInputElement | null; password: HTMLInputElement | null }>({ username: null, password: null })
  const mounted = useRef(true)
  /** Whether each account field holds text: two facts, never the text (the Start button needs no more). */
  const [filledUsername, setFilledUsername] = useState(false)
  const [filledPassword, setFilledPassword] = useState(false)
  /** The two optional addresses: not credential material. */
  const [addresses, setAddresses] = useState<SetIpAddressValues>({ toAddress: '', gateway: '' })
  const [addressErrors, setAddressErrors] = useState<SetIpAddressErrors>({})
  const [accountErrors, setAccountErrors] = useState<ConnectFormErrors>({})
  const [confirmed, setConfirmed] = useState(false)
  const [refusal, setRefusal] = useState<SetIpRefusal | null>(null)

  /** Empties the two elements. Nothing else: safe after the unmount. */
  const emptyFields = () => {
    for (const element of [held.current.username, held.current.password]) {
      if (element !== null) element.value = ''
    }
  }
  /** Empties the two elements and the two facts about them. */
  const clearAccount = () => {
    emptyFields()
    if (!mounted.current) return
    setFilledUsername(false)
    setFilledPassword(false)
  }

  // CLEARED ON UNMOUNT: the job started, another camera was chosen, a new scan arrived, the role
  // changed, the page was left. A layout effect: its cleanup runs with the removal of the elements.
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      emptyFields()
    }
  }, [])

  // CLEARED ON NAVIGATION, also one that keeps this page mounted (a hash, a search parameter, the
  // same address again), and when the document is hidden for good (a reload, a closed tab, a
  // navigation outside the router). Nothing typed is handed to the router: the listener takes no
  // argument of this form.
  useEffect(() => {
    const clear = () => clearAccount()
    const stop = router.subscribe('onBeforeNavigate', clear)
    window.addEventListener('pagehide', clear)
    return () => {
      stop()
      window.removeEventListener('pagehide', clear)
    }
  }, [router])

  const cancel = () => {
    // CLEARED ON CANCEL, before the form goes.
    clearAccount()
    onCancel()
  }

  // THE ONE PLACE a set-network job is started from: the technician's press.
  const start = () => {
    if (control.busy) return
    // Read at the press, from the two elements; these two locals are all that holds the account here.
    const typed = { username: held.current.username?.value ?? '', password: held.current.password?.value ?? '' }
    const addressIssues = validateSetIpAddresses(camera.address, addresses)
    const accountIssues = validateConnectForm(typed)
    setAddressErrors(addressIssues)
    setAccountErrors(accountIssues)
    setRefusal(null)
    // Refused in the form: nothing leaves the page. A message names a field and a rule, never a typed character.
    if (addressIssues.toAddress !== undefined || addressIssues.gateway !== undefined || hasConnectErrors(accountIssues) || !confirmed) return
    // Row V6 (R119-04): the body carries the hardware address of the scan row the technician chose and confirmed.
    const body = setIpBodyOf(camera, addresses, credentialOf(typed))
    // CLEARED ON SUBMIT: both fields are empty before the request leaves, whatever the answer will be.
    clearAccount()
    setConfirmed(false)
    if (body === null) {
      setRefusal({ kind: 'INVALID_INPUT' })
      return
    }
    control.run((release) => {
      void startCameraNetworkJob(target, body)
        .then((answer) => {
          if (!mounted.current) return
          if (answer.ok) {
            onStarted(answer.data)
            return
          }
          const kind = setIpRefusal(answer)
          if (kind.kind === 'OTHER') presentUnworded(answer)
          setRefusal(kind)
        })
        .catch((error: unknown) => {
          // The record names the error by its class: its text is not trusted to be free of input.
          reportCommissioningError('features/commissioning.setIp', error, COMMISSIONING_RECORD.threw, { operationId: 'setCameraNetwork' })
          if (mounted.current) setRefusal({ kind: 'OTHER' })
        })
        .finally(release)
    })
  }

  const refusalSentence = (kind: SetIpRefusal): string => {
    switch (kind.kind) {
      case 'NOT_AVAILABLE':
        return t('web.commissioning.setIp.refusal.NOT_AVAILABLE')
      case 'ADDRESS_NOT_ALLOWED':
        return `${CAPTURE_COMMISSIONING_REFUSAL_SENTENCES.COMMISSIONING_ADDRESS_NOT_ALLOWED} ${t('web.commissioning.setIp.refusal.ADDRESS_NOT_ALLOWED')}`
      case 'LOCKOUT_GUARD':
        return t('web.commissioning.setIp.refusal.LOCKOUT_GUARD')
      case 'RATE_LIMITED':
        return t('web.commissioning.setIp.refusal.RATE_LIMITED')
      case 'OTHER':
        // Not answered: the console does not know whether a job exists.
        return t('web.commissioning.setIp.refusal.OTHER')
      default:
        return `${sentenceOf(kind)} ${t('web.commissioning.setIp.refusal.nothingSent')}`
    }
  }

  const announced = [camera.vendor, camera.model, camera.name].filter((part): part is string => part !== null && part !== '')
  // Row V6 (R119-04): a row whose scan showed no hardware address cannot be started - there is nothing to bind the job to.
  const canStart = confirmed && camera.mac !== null && filledUsername && filledPassword && !control.busy

  return (
    <div className="com-form" data-testid="com-setip-form" data-from={camera.address}>
      {/* THE DEVICE THAT WILL BE RE-ADDRESSED, before anything is typed. */}
      <dl className="com-facts" data-testid="com-setip-picked">
        <div>
          <dt>{t('web.commissioning.setIp.picked.from')}</dt>
          <dd className="font-mono" data-testid="com-setip-picked-address">
            {camera.address}
          </dd>
        </div>
        <div>
          <dt>{t('web.commissioning.setIp.picked.mac')}</dt>
          <dd data-testid="com-setip-picked-mac">{camera.mac === null ? <span className="com-text">{t('web.commissioning.setIp.picked.macUnknown')}</span> : <span className="font-mono">{camera.mac}</span>}</dd>
        </div>
        <div>
          <dt>{t('web.commissioning.setIp.picked.device')}</dt>
          {/* Untrusted device text: drawn as text only, in its own direction. */}
          <dd>{announced.length === 0 ? <span className="com-text">{t('web.commissioning.scan.deviceUnknown')}</span> : <bdi>{announced.join(' · ')}</bdi>}</dd>
        </div>
      </dl>
      {camera.onvifReachable ? null : (
        <p className="com-text" data-testid="com-setip-onvif-note">
          {t('web.commissioning.scan.onvifNo')}
        </p>
      )}
      {camera.registeredDeviceId === null ? null : (
        <p className="com-text" data-testid="com-setip-registered-note">
          {t('web.commissioning.setIp.picked.registeredNote', { device: camera.registeredDeviceId })}
        </p>
      )}

      <div className="com-numbers">
        {(['toAddress', 'gateway'] as const).map((name) => (
          <TextField
            key={name}
            value={addresses[name]}
            onChange={(value) => {
              setAddresses((current) => ({ ...current, [name]: value }))
              setAddressErrors(({ [name]: _cleared, ...rest }) => rest)
            }}
            isInvalid={addressErrors[name] !== undefined}
            isDisabled={control.busy}
          >
            <Label>{t(`web.commissioning.setIp.${name}.label`)}</Label>
            <Input className="font-mono" inputMode="decimal" autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid={`com-setip-${name}`} />
            {addressErrors[name] === undefined ? (
              <Description>{t(`web.commissioning.setIp.${name}.hint`)}</Description>
            ) : (
              <FieldError data-testid={`com-setip-${name}-error`}>{t(`web.commissioning.setIp.addressError.${addressErrors[name]}`)}</FieldError>
            )}
          </TextField>
        ))}
      </div>

      <p className="com-text" data-testid="com-setip-account-note">
        {t('web.commissioning.setIp.accountNote')}
      </p>
      {/* Two plain UNCONTROLLED inputs with the kit's field classes: no `value`, no `defaultValue` - never pre-filled, never in state. */}
      <div className="com-numbers" data-testid="com-setip-account">
        <div className="textfield" data-invalid={accountErrors.username === undefined ? undefined : 'true'}>
          <label className="label" htmlFor={`${fieldId}-username`}>
            {t('common.captureConnect.username')}
          </label>
          <div className="input-group input-group--full-width" data-slot="input-group" data-invalid={accountErrors.username === undefined ? undefined : 'true'}>
            <input
              {...SET_IP_FIELD.input}
              ref={(element) => {
                if (element !== null) held.current.username = element
              }}
              id={`${fieldId}-username`}
              className="input-group__input"
              data-slot="input-group-input"
              type="text"
              name={SET_IP_FIELD.username.name}
              autoComplete={SET_IP_FIELD.username.autoComplete}
              maxLength={CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH}
              readOnly={control.busy}
              aria-invalid={accountErrors.username === undefined ? undefined : true}
              aria-describedby={accountErrors.username === undefined ? undefined : `${fieldId}-username-error`}
              onChange={(event) => {
                // A fact about the text, never the text.
                setFilledUsername(event.currentTarget.value.trim().length > 0)
                setAccountErrors(({ username: _username, ...rest }) => rest)
              }}
              data-testid="com-setip-username"
            />
          </div>
          {accountErrors.username === undefined ? null : (
            <p className="field-error" data-slot="field-error" data-visible="true" id={`${fieldId}-username-error`} data-testid="com-setip-username-error">
              {t(`common.captureConnect.${accountErrors.username}`)}
            </p>
          )}
        </div>
        <div className="textfield" data-invalid={accountErrors.password === undefined ? undefined : 'true'}>
          <label className="label" htmlFor={`${fieldId}-password`}>
            {t('common.captureConnect.password')}
          </label>
          <div className="input-group input-group--full-width" data-slot="input-group" data-invalid={accountErrors.password === undefined ? undefined : 'true'}>
            <input
              {...SET_IP_FIELD.input}
              ref={(element) => {
                if (element !== null) held.current.password = element
              }}
              id={`${fieldId}-password`}
              className="input-group__input"
              data-slot="input-group-input"
              type="password"
              name={SET_IP_FIELD.password.name}
              autoComplete={SET_IP_FIELD.password.autoComplete}
              maxLength={CAPTURE_CREDENTIAL_SECRET_MAX_LENGTH}
              readOnly={control.busy}
              aria-invalid={accountErrors.password === undefined ? undefined : true}
              aria-describedby={accountErrors.password === undefined ? `${fieldId}-password-description` : `${fieldId}-password-error`}
              onChange={(event) => {
                setFilledPassword(event.currentTarget.value.length > 0)
                setAccountErrors(({ password: _password, ...rest }) => rest)
              }}
              data-testid="com-setip-password"
            />
          </div>
          {accountErrors.password === undefined ? (
            <p className="description" data-slot="description" id={`${fieldId}-password-description`}>
              {t('common.captureConnect.charset')}
            </p>
          ) : (
            <p className="field-error" data-slot="field-error" data-visible="true" id={`${fieldId}-password-error`} data-testid="com-setip-password-error">
              {t(`common.captureConnect.${accountErrors.password}`)}
            </p>
          )}
        </div>
      </div>

      {/* Start is enabled only after this tick: the technician states which device is meant. */}
      <Checkbox isSelected={confirmed} onChange={setConfirmed} isDisabled={control.busy || camera.mac === null} data-testid="com-setip-confirm">
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label>{camera.mac === null ? t('web.commissioning.setIp.confirmNoMac', { address: camera.address }) : t('web.commissioning.setIp.confirm', { address: camera.address, mac: camera.mac })}</Label>
        </Checkbox.Content>
      </Checkbox>

      {refusal === null ? null : (
        <SentenceAlert
          sentence={refusalSentence(refusal)}
          tone={refusal.kind === 'OTHER' ? 'danger' : 'warning'}
          testId="com-setip-refusal"
          kind={refusal.kind}
          reason={refusal.kind === 'REASON' ? refusal.reason : undefined}
        />
      )}

      <div className="com-row">
        <span />
        <Button ref={startRef} variant="primary" isDisabled={!canStart} isPending={control.pending} onPress={start} data-testid="com-setip-start">
          {control.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <ArrowRightLeft aria-hidden="true" size={14} />}
          {t('web.commissioning.setIp.start')}
        </Button>
        <Button variant="ghost" onPress={cancel} isDisabled={control.busy} data-testid="com-setip-cancel">
          {t('web.commissioning.setIp.cancel')}
        </Button>
      </div>
    </div>
  )
}

// ── The job ──────────────────────────────────────────────────────────────────────────────

function Mac({ value, pending, testId }: { value: string | null; pending: boolean; testId: string }) {
  const { t } = useTranslation()
  return (
    <dd data-testid={testId} data-known={value === null ? 'false' : 'true'}>
      {value === null ? <span className="com-text">{t(pending ? 'web.commissioning.setIp.job.macPending' : 'web.commissioning.setIp.job.macNone')}</span> : <span className="font-mono">{value}</span>}
    </dd>
  )
}

function JobView({
  target,
  job,
  registered,
  onJob,
  onSettled,
  onClose,
}: {
  target: CommissioningTarget
  job: CameraNetworkJob
  registered: string | null
  onJob: (job: CameraNetworkJob) => void
  onSettled: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  /** `404` of operation 107: the Core restarted, or the job is another session's. One answer for both; nothing more is known. */
  const [lost, setLost] = useState(false)
  /** Reads in a row that were not answered. */
  const [failures, setFailures] = useState(0)
  const mounted = useRef(true)
  const running = job.state === CameraNetworkJobState.RUNNING
  const asking = running && !lost && failures < SET_IP_POLL_MAX_FAILURES

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const read = () => {
    void readCameraNetworkJob(target, job.jobId)
      .then((answer) => {
        if (!mounted.current) return
        if (answer.ok) {
          setFailures(0)
          onJob(answer.data)
          return
        }
        if (answer.status === 404) {
          setLost(true)
          return
        }
        setFailures((count) => count + 1)
      })
      .catch((error: unknown) => {
        reportCommissioningError('features/commissioning.setIp', error, COMMISSIONING_RECORD.threw, { operationId: 'getCameraNetworkJob' })
        if (mounted.current) setFailures((count) => count + 1)
      })
  }

  /** The two callbacks as of the last render, for the two effects below. */
  const latest = useRef({ read, onSettled })
  useEffect(() => {
    latest.current = { read, onSettled }
  })

  // The console asks for a RUNNING job by itself: one read, `SET_IP_POLL_MS` after the last answer
  // (`job` is a new object at every answer, `failures` moves at every unanswered read).
  // The read carries the job's id and nothing else; no camera is asked by it.
  useEffect(() => {
    if (!asking) return undefined
    const timer = setTimeout(() => latest.current.read(), SET_IP_POLL_MS)
    return () => clearTimeout(timer)
  }, [job, asking, failures])

  // The job ended, or the Core no longer holds it: the page reads the temporary host address again.
  const settled = !running || lost
  useEffect(() => {
    if (settled) latest.current.onSettled()
  }, [settled])

  const verdict = macVerdict(job)
  const mismatch = job.failure === CameraNetworkJobFailure.MAC_MISMATCH
  return (
    <div className="com-card-body" data-testid="com-setip-job" data-job={job.jobId} data-state={lost ? 'LOST' : job.state} data-step={job.step} data-failure={job.failure ?? undefined}>
      <p className="com-text" role="status" data-testid="com-setip-job-status">
        {t('web.commissioning.setIp.job.title', { job: job.jobId })}
        {' · '}
        {t(`web.commissioning.setIp.job.step.${job.step}`, { seconds: CAMERA_NETWORK_SET_WAIT_MS / 1000 })}
      </p>
      <dl className="com-facts">
        <div>
          <dt>{t('web.commissioning.setIp.job.from')}</dt>
          <dd className="font-mono" data-testid="com-setip-job-from">
            {job.fromAddress}
          </dd>
        </div>
        <div>
          <dt>{t('web.commissioning.setIp.job.target')}</dt>
          <dd data-testid="com-setip-job-target">{job.toAddress === null ? <span className="com-text">{t('web.commissioning.setIp.job.targetUnknown')}</span> : <span className="font-mono">{job.toAddress}</span>}</dd>
        </div>
        <div>
          <dt>{t('web.commissioning.setIp.job.macNeighbour')}</dt>
          <Mac value={job.neighbourMac} pending={running} testId="com-setip-mac-neighbour" />
        </div>
        <div>
          <dt>{t('web.commissioning.setIp.job.macAuthenticated')}</dt>
          <Mac value={job.authenticatedMac} pending={running} testId="com-setip-mac-authenticated" />
        </div>
        <div>
          <dt>{t('web.commissioning.setIp.job.macConfirmed')}</dt>
          <Mac value={job.confirmedMac} pending={running} testId="com-setip-mac-confirmed" />
        </div>
        <div>
          <dt>{t('web.commissioning.setIp.job.verdictLabel')}</dt>
          <dd data-testid="com-setip-verdict" data-verdict={mismatch ? 'DIFFERENT' : verdict}>
            <Chip size="sm" variant="soft" color={mismatch || verdict === 'DIFFERENT' ? 'danger' : verdict === 'SAME' ? 'success' : 'default'}>
              <Chip.Label>{t(`web.commissioning.setIp.job.verdict.${mismatch ? 'DIFFERENT' : verdict}`)}</Chip.Label>
            </Chip>
          </dd>
        </div>
      </dl>

      {lost ? (
        <SentenceAlert sentence={t('web.commissioning.setIp.job.lost')} tone="danger" testId="com-setip-job-lost" />
      ) : running ? (
        <p className="com-text" data-testid="com-setip-job-running">
          {t('web.commissioning.setIp.job.running')}
        </p>
      ) : job.state === CameraNetworkJobState.COMPLETED ? (
        <SentenceAlert sentence={t('web.commissioning.setIp.job.completed', { address: job.toAddress ?? '' })} tone="success" testId="com-setip-job-completed" />
      ) : (
        // A MAC mismatch stops the job on the screen: said as a stop, with "nothing was set".
        <SentenceAlert
          sentence={t(`web.commissioning.setIp.job.failure.${job.failure ?? 'UNKNOWN'}`)}
          tone="danger"
          testId="com-setip-job-failure"
          kind={job.failure ?? undefined}
        />
      )}
      {job.state === CameraNetworkJobState.COMPLETED && registered !== null ? (
        <p className="com-text" data-testid="com-setip-job-registered">
          {t('web.commissioning.setIp.job.completedRegistered', { device: registered })}
        </p>
      ) : null}
      {running && !lost && !asking ? (
        <div className="com-fallback" role="alert" data-testid="com-setip-job-unread">
          <p className="com-text">{t('web.commissioning.setIp.job.unread')}</p>
          <RetryButton
            onRetry={() => {
              setFailures(0)
              read()
            }}
            testId="com-setip-job-retry"
          />
        </div>
      ) : null}
      <p className="com-text" data-testid="com-setip-account-gone">
        {t('web.commissioning.setIp.job.accountGone')}
      </p>
      <div className="com-row">
        <span />
        {asking ? (
          <Button size="sm" variant="outline" onPress={read} data-testid="com-setip-job-read">
            {t('web.commissioning.setIp.job.readNow')}
          </Button>
        ) : null}
        {settled || !asking ? (
          <Button size="sm" variant="ghost" onPress={onClose} data-testid="com-setip-job-close">
            {t('web.commissioning.setIp.job.close')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
