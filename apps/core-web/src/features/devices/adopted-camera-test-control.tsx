import { useState } from 'react'
import { Alert, Button, Spinner } from '@heroui/react'
import { PlugZap } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE, CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES } from '@dems/shared/api'
import { useCorePermission } from '@dems/shared/live'
import { formatClock } from '@dems/shared/realtime'
import { hasActiveSession, Permission, selectCan, useSim, useSimInstance } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { CORE_QUERY_KEYS, useWebLive } from '@/runtime'
import { adoptedTestRefusal, adoptedTestResultOf, testAdoptedCamera, type AdoptedTestFailure, type AdoptedTestRefusal, type AdoptedTestResult } from './adopted-camera-test'
import { reportDevicesError } from './report'

/** The fixed sentences of the page's own record. */
const TEST_THREW_RECORD = 'The connection test of a registered camera could not be sent.'
const TEST_FAILED_RECORD = 'The connection test of a registered camera was not carried out.'

export interface AdoptedCameraTestProps {
  /** The registered production camera to test. */
  deviceId: string
  /** Where the control is drawn: part of its test ids (`adopted-test-<place>`). */
  place: string
  /** The caller's own gate (the selector's edit block): the control is drawn but cannot be pressed. */
  isDisabled?: boolean
}

/**
 * "Test connection" of an ADOPTED production camera (task 4 row W6; operation 108; decisions C117, C126 (d)).
 * Drawn where the selector says a camera has no stored stream profile and in the camera's device entry.
 *
 * | Rule | How it is kept |
 * |------|----------------|
 * | One request per press, never repeated by itself | ONE call site of `testAdoptedCamera`: the press; the control is pending meanwhile |
 * | No credential | the operation has no body: the Core reads the password it stored at adoption |
 * | `PROFILES_STORED` shows at once | the Core's device list is read again (operation 77); the replicated slice does the same |
 * | `STREAM_PROFILE_DIFFERS` says what is left to do | its own sentence: nothing stored, the stored profiles stand, adopt again |
 * | Every refusal with its words | `adoptedTestRefusal`; the contract's three sentences for its `409` reasons; the presenter for an outage |
 *
 * Web console only, as the operation (a tablet session is refused by the Core). Offered to an operator who
 * holds `CAPTURE_CONFIG`; with a session open the press is closed (the Core would refuse it: `CAPTURE_CONFIG_LOCKED`).
 */
export function AdoptedCameraTest({ deviceId, place, isDisabled = false }: AdoptedCameraTestProps) {
  const { t } = useTranslation()
  const live = useWebLive()
  const sim = useSimInstance()
  const queryClient = useQueryClient()
  const presentCoreError = useCoreErrorPresenter()
  const control = usePendingControl()
  const { ref: testRef } = control
  const coreCan = useCorePermission(Permission.CAPTURE_CONFIG)
  const simCan = useSim((state) => selectCan(state, Permission.CAPTURE_CONFIG))
  const can = live === null ? simCan : coreCan
  const sessionOpen = useSim(hasActiveSession)
  // `until`: the clock time a lock-out guard pause ends, taken when the refusal arrived (it does not count down).
  const [answer, setAnswer] = useState<{ readonly deviceId: string; readonly result: AdoptedTestResult | null; readonly refusal: AdoptedTestRefusal | null; readonly until?: number | null } | null>(null)
  // A result belongs to the camera it was asked for: another camera of the same place starts without one.
  const shown = answer !== null && answer.deviceId === deviceId ? answer : null

  const refused = (failure: AdoptedTestFailure) => {
    const kind = adoptedTestRefusal(failure)
    if (kind.kind === 'OTHER') {
      // The presenter first (an outage, a time-out, a 5xx); what it leaves is one record of the page.
      if (failure.failure === null || presentCoreError(failure.failure) === null) {
        reportDevicesError('features/devices.adoptedCameraTest', null, TEST_FAILED_RECORD, { operationId: 'testCaptureDeviceConnection', deviceId, status: failure.status, code: failure.code })
      }
    }
    setAnswer({ deviceId, result: null, refusal: kind, until: kind.kind === 'LOCKOUT_GUARD' && kind.seconds !== null ? Date.now() + kind.seconds * 1000 : null })
  }

  // THE ONE PLACE the request is sent from: the operator's press.
  const onTest = () => {
    if (!can || sessionOpen || isDisabled) return
    control.run((release) => {
      void testAdoptedCamera({ live, sim }, deviceId)
        .then(async (reply) => {
          if (!reply.ok) {
            refused(reply)
            return
          }
          const result = adoptedTestResultOf(reply.data)
          setAnswer({ deviceId, result, refusal: null })
          // The stored profiles are part of the device entry: read the list again so they are offered at once.
          if (result.kind === 'PROFILES_STORED' && live !== null) await queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.captureDevices, exact: true })
        })
        .catch((error: unknown) => {
          reportDevicesError('features/devices.adoptedCameraTest', error, TEST_THREW_RECORD, { operationId: 'testCaptureDeviceConnection', deviceId })
          setAnswer({ deviceId, result: null, refusal: { kind: 'OTHER' } })
        })
        .finally(release)
    })
  }

  return (
    <div className="dev-adopted-test" data-testid={`adopted-test-${place}`} data-device={deviceId} aria-busy={control.busy || undefined}>
      <Button
        ref={testRef}
        size="sm"
        variant="outline"
        isDisabled={!can || sessionOpen || isDisabled}
        isPending={control.pending}
        onPress={onTest}
        data-testid={`adopted-test-button-${place}`}
      >
        {control.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <PlugZap aria-hidden="true" size={14} />}
        {control.pending ? t('common.captureConnect.testing') : t('common.captureConnect.test')}
      </Button>
      <p className="dev-sel-reason" data-testid={`adopted-test-hint-${place}`}>
        {sessionOpen ? t('web.adoptedTest.locked') : t('web.adoptedTest.hint')}
      </p>
      {shown?.result ? <ResultAlert result={shown.result} place={place} /> : null}
      {shown?.refusal ? <RefusalAlert refusal={shown.refusal} until={shown.until ?? null} place={place} /> : null}
    </div>
  )
}

function ResultAlert({ result, place }: { result: AdoptedTestResult; place: string }) {
  const { t } = useTranslation()
  const stored = result.kind === 'PROFILES_STORED'
  const title =
    result.kind === 'PROFILES_STORED'
      ? t('web.adoptedTest.result.PROFILES_STORED')
      : result.kind === 'STREAM_PROFILE_DIFFERS'
        ? t('web.adoptedTest.result.STREAM_PROFILE_DIFFERS')
        : result.kind === 'SCHEME_NOT_ALLOWED'
          ? t('common.captureConnectTarget.schemeNotAllowed')
          : result.kind === 'PASSWORD_REFUSED'
            ? t('web.adoptedTest.result.PASSWORD_REFUSED')
            : result.outcome === 'REACHABLE'
              ? t('web.adoptedTest.result.REACHABLE')
              : t(`common.captureConnect.outcome.${result.outcome}`)
  // What stays the same: every answer but PROFILES_STORED stored no profile (STREAM_PROFILE_DIFFERS and REACHABLE say it in their own sentence).
  const detail =
    result.kind === 'PASSWORD_REFUSED'
      ? t('common.captureConnect.attemptsLeft', { count: result.attemptsLeft })
      : result.kind === 'SCHEME_NOT_ALLOWED' || (result.kind === 'OUTCOME' && result.outcome !== 'REACHABLE')
        ? t('web.adoptedTest.nothingStored')
        : null
  return (
    <Alert
      status={stored || (result.kind === 'OUTCOME' && result.outcome === 'REACHABLE') ? 'success' : result.kind === 'PASSWORD_REFUSED' || result.kind === 'SCHEME_NOT_ALLOWED' ? 'danger' : 'warning'}
      role={stored ? 'status' : 'alert'}
      data-testid={`adopted-test-result-${place}`}
      data-result={result.kind === 'OUTCOME' ? result.outcome : result.kind}
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {detail === null ? null : <Alert.Description>{detail}</Alert.Description>}
      </Alert.Content>
    </Alert>
  )
}

function RefusalAlert({ refusal, until, place }: { refusal: AdoptedTestRefusal; until: number | null; place: string }) {
  const { t } = useTranslation()
  let title: string
  switch (refusal.kind) {
    case 'REASON':
      title = CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES[refusal.reason]
      break
    case 'NOT_READY':
      title = CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE
      break
    case 'LOCKOUT_GUARD':
      // A clock time from the Core's own number of seconds, taken when the refusal arrived; it does not count down.
      title = until === null ? t('devices.search.lockoutNoTime') : t('common.captureConnect.lockoutGuard', { time: formatClock(until) })
      break
    case 'RATE_LIMITED':
      title = refusal.seconds === null ? t('common.coreErrors.limitedNoTime') : t('common.coreErrors.limited', { seconds: refusal.seconds })
      break
    default:
      title = t(`web.adoptedTest.refusal.${refusal.kind}`)
  }
  return (
    <Alert status={refusal.kind === 'OTHER' ? 'danger' : 'warning'} role="alert" data-testid={`adopted-test-refusal-${place}`} data-refusal={refusal.kind} data-reason={refusal.kind === 'REASON' ? refusal.reason : undefined}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
      </Alert.Content>
    </Alert>
  )
}
