import { useCallback, useEffect, useState, type RefObject } from 'react'
import { Alert, Button, Chip, Spinner, toast } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { CircleCheck, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LiveLinkState, settle, useLiveLink } from '@dems/shared/live'
import { useRetryCooldown } from '@dems/shared/realtime'
import { selectOperatorById, useSim } from '@dems/shared/sim'
import { CoreErrorNoticeKind, useCoreErrorPresenter, type CoreErrorNotice } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { useMotionPolicy } from '@/motion'
import { CORE_QUERY_KEYS, useWebLive } from '@/runtime'
import { codeCancelledHere, codeEnded, codeReplaced, clearOutcome, holdCode, markRevealed, useCodeMemory } from './code-memory'
import { CodeDigits, CodeQr, Countdown } from './code-display'
import { callFailureOf, cancelCode, issueCode, PAIRING_PERMISSION, type PairingReads } from './live-data'
import { closedReasonOf, formatCountdown, issuePanelState, IssuePanelKind, secondsLeft, type IssuePanelState } from './model'
import { Panel } from './panel'
import { PAIRING_RECORD, reportPairingError } from './report'

/** Notices after which the issue call shows the panel's Error state (§10.3 "Error: the issue call failed (not 403)"). A 429 is a limit: the control returns to idle (LB-10). */
const ISSUE_ERROR_NOTICES: ReadonlySet<CoreErrorNotice['kind']> = new Set([
  CoreErrorNoticeKind.NOT_SENT,
  CoreErrorNoticeKind.TIMED_OUT,
  CoreErrorNoticeKind.STARTING,
  CoreErrorNoticeKind.OFFLINE,
  CoreErrorNoticeKind.UNAVAILABLE,
  CoreErrorNoticeKind.ORIGIN_NOT_ALLOWED,
])

/**
 * "Pair a device", the hero panel (backend task 04_client_integration_spec §10.3, the issue-code
 * panel; AC-C-92 to AC-C-97, AC-C-99, AC-C-106; plan row W81).
 *
 * The state comes from `issuePanelState` (`model.ts`): what this page load holds (`code-memory.ts`),
 * operation 16's status, operation 19's registry and the replica's audit ring, on the Live clock.
 * Issue and cancel are presses on `usePendingControl()` (LB-1: busy at once, the kit's spinner after
 * the reveal time; `ref` marks the pressed button). The answer of the issue goes to `holdCode` and to
 * nothing else: no toast, no record, no query key, no URL (rule 4; AC-C-96, AC-C-107).
 */
export function IssuePanel({ reads }: { reads: PairingReads }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const live = useWebLive()
  const linkUp = useLiveLink() === LiveLinkState.ONLINE
  const presentCoreError = useCoreErrorPresenter()
  const memory = useCodeMemory(queryClient)
  const now = useSim((s) => Math.floor(s.clock.now / 1000)) * 1000
  const heldCodeId = memory.held?.codeId ?? null
  const closedReason = useSim((s) => closedReasonOf(s.audit.rows, heldCodeId))
  // Destructured: the busy mark's `ref` goes to the pressed button, the flags to the render.
  const { run: runIssue, busy: issueBusy, pending: issuePending, ref: issueRef } = usePendingControl()
  const { run: runCancel, busy: cancelBusy, pending: cancelPending, ref: cancelRef } = usePendingControl()
  const [issueFailed, setIssueFailed] = useState(false)

  // `dataUpdatedAt` is read so this panel renders again on every status answer, also an equal one;
  // the count says whether that answer came after the held code was issued (model rule 2).
  const statusAnsweredAt = reads.status.dataUpdatedAt
  const statusCount = statusAnsweredAt === 0 ? 0 : (queryClient.getQueryState(CORE_QUERY_KEYS.pairingCode)?.dataUpdateCount ?? 0)
  const state = issuePanelState({
    held: memory.held,
    outcome: memory.outcome,
    status: reads.status.data,
    statusCount,
    devices: reads.devices.data?.devices,
    closedReason,
    cancelledHere: memory.cancelledHere,
    now,
  })

  // The digits go as soon as the code is spent (redeemed, closed after wrong attempts, cancelled or
  // replaced elsewhere); what the panel says about it stays as the outcome. No Core call here.
  const held = memory.held
  const stateKind = state.kind
  const redeemedId = state.kind === IssuePanelKind.REDEEMED ? state.deviceId : null
  const redeemedName = state.kind === IssuePanelKind.REDEEMED ? state.deviceName : null
  useEffect(() => {
    if (held === null) return
    if (stateKind === IssuePanelKind.REDEEMED && redeemedId !== null && redeemedName !== null) {
      codeEnded(queryClient, { kind: 'REDEEMED', codeId: held.codeId, deviceId: redeemedId, deviceName: redeemedName, at: now })
    } else if (stateKind === IssuePanelKind.EXHAUSTED) {
      codeEnded(queryClient, { kind: 'EXHAUSTED', codeId: held.codeId, at: now })
    } else if (stateKind === IssuePanelKind.CANCELLED_ELSEWHERE) {
      codeEnded(queryClient, { kind: 'CANCELLED_ELSEWHERE', codeId: held.codeId, at: now })
    } else if (stateKind === IssuePanelKind.ACTIVE_UNKNOWN) {
      codeReplaced(queryClient, held.codeId)
    }
  }, [held, stateKind, redeemedId, redeemedName, now, queryClient])

  // Redeemed returns to Idle after 4 s (the model stops showing it; the outcome is then forgotten).
  const outcomeKind = memory.outcome?.kind ?? null
  useEffect(() => {
    if (outcomeKind === 'REDEEMED' && stateKind !== IssuePanelKind.REDEEMED) clearOutcome(queryClient)
  }, [outcomeKind, stateKind, queryClient])

  const issue = () => {
    if (live === null) return
    setIssueFailed(false)
    runIssue((release) =>
      settle(() => issueCode(live), {
        ok: (issued) => {
          // The ONE place the answer goes (§10.3): the page load's memory.
          holdCode(queryClient, issued)
          void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.pairingCode })
        },
        fail: (error) => {
          const notice = presentCoreError(error, { permission: PAIRING_PERMISSION })
          if (notice !== null) {
            // A time-out may have issued a code after all: the status says so (Active, code not known).
            if (notice.kind === CoreErrorNoticeKind.TIMED_OUT) void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.pairingCode })
            if (ISSUE_ERROR_NOTICES.has(notice.kind)) setIssueFailed(true)
            return
          }
          const failure = callFailureOf(error)
          reportPairingError('features/paired-devices.issue', error, PAIRING_RECORD.issue, {
            operationId: 'issuePairingCode',
            code: failure?.error.code ?? null,
            status: failure?.status ?? null,
          })
          setIssueFailed(true)
        },
        done: release,
      }),
    )
  }

  const cancel = (codeId: string | null) => {
    if (live === null) return
    runCancel((release) =>
      settle(() => cancelCode(live), {
        ok: () => {
          if (codeId !== null) codeCancelledHere(queryClient, codeId)
          // The Core answered 204: no code is active now. The refetch confirms it.
          queryClient.setQueryData(CORE_QUERY_KEYS.pairingCode, { active: null })
          void queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.pairingCode })
          toast.success(t('pairedDevices.toasts.cancelled'))
        },
        fail: (error) => {
          if (presentCoreError(error, { permission: PAIRING_PERMISSION }) !== null) return
          const failure = callFailureOf(error)
          reportPairingError('features/paired-devices.cancel', error, PAIRING_RECORD.cancel, {
            operationId: 'cancelPairingCode',
            code: failure?.error.code ?? null,
            status: failure?.status ?? null,
            codeId,
          })
          toast.danger(t('pairedDevices.toasts.cancelFailed'))
        },
        done: release,
      }),
    )
  }

  // Stable for the code shown, so the digits' first showing records the reveal once.
  const onRevealed = useCallback(() => {
    if (heldCodeId !== null) markRevealed(queryClient, heldCodeId)
  }, [heldCodeId, queryClient])

  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(issue)
  const busy = issueBusy || cancelBusy

  return (
    <Panel id="issue" icon={KeyRound} title={t('pairedDevices.issue.title')} busy={busy}>
      <div className="pd-issue" data-testid="pd-issue-panel" data-state={state.kind}>
        <IssueBody
          state={state}
          held={memory.held}
          now={now}
          linkUp={linkUp}
          issueBusy={issueBusy}
          issuePending={issuePending}
          issueRef={issueRef}
          cancelBusy={cancelBusy}
          cancelPending={cancelPending}
          cancelRef={cancelRef}
          issueFailed={issueFailed}
          onIssue={issue}
          onCancel={() => cancel(state.kind === IssuePanelKind.ACTIVE_UNKNOWN ? (reads.status.data?.active?.codeId ?? null) : heldCodeId)}
          onRevealed={onRevealed}
          retry={{ retry, canRetry, label: exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry') }}
        />
      </div>
    </Panel>
  )
}

interface IssueBodyProps {
  state: IssuePanelState
  held: ReturnType<typeof useCodeMemory>['held']
  now: number
  linkUp: boolean
  issueBusy: boolean
  issuePending: boolean
  issueRef: RefObject<HTMLButtonElement | null>
  cancelBusy: boolean
  cancelPending: boolean
  cancelRef: RefObject<HTMLButtonElement | null>
  issueFailed: boolean
  onIssue: () => void
  onCancel: () => void
  onRevealed: () => void
  retry: { retry: () => void; canRetry: boolean; label: string }
}

function IssueBody(props: IssueBodyProps) {
  const { state, held, now, linkUp, issueBusy, issuePending, issueRef, cancelBusy, cancelPending, cancelRef, issueFailed, onIssue, onCancel, onRevealed, retry } = props
  const { t } = useTranslation()
  const m = useMotionPolicy()

  const issueButton = (label: string, testId: string) => (
    <Button
      ref={issueRef}
      variant="primary"
      onPress={onIssue}
      isDisabled={!linkUp || cancelBusy}
      isPending={issuePending}
      data-busy={issueBusy || undefined}
      data-testid={testId}
    >
      {issuePending ? <Spinner size="sm" color="current" /> : null}
      {label}
    </Button>
  )

  const cancelButton = (
    <Button
      ref={cancelRef}
      variant="outline"
      onPress={onCancel}
      isDisabled={!linkUp || issueBusy}
      isPending={cancelPending}
      data-busy={cancelBusy || undefined}
      data-testid="pd-cancel-code"
    >
      {cancelPending ? <Spinner size="sm" color="current" /> : null}
      {t('pairedDevices.issue.cancel')}
    </Button>
  )

  const errorBlock = issueFailed ? (
    <Alert status="danger" data-testid="pd-issue-error">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('pairedDevices.issue.error')}</Alert.Title>
      </Alert.Content>
      <Button size="sm" variant="outline" onPress={retry.retry} isDisabled={!retry.canRetry || !linkUp || issueBusy} data-testid="pd-issue-retry">
        {retry.label}
      </Button>
    </Alert>
  ) : null

  switch (state.kind) {
    case IssuePanelKind.ACTIVE_KNOWN:
      return held === null ? null : (
        <div className="pd-active">
          <div className="pd-active-code">
            <CodeDigits code={held.code} revealed={held.revealed} onRevealed={onRevealed} />
            <CodeQr payload={held.qrPayload} />
          </div>
          <p className="pd-caption">{t('pairedDevices.issue.caption')}</p>
          <Countdown issuedAt={state.issuedAt} expiresAt={state.expiresAt} now={now} />
          <p className="pd-attempts" data-testid="pd-attempts">
            {t('pairedDevices.issue.attemptsLeft', { count: state.attemptsRemaining })}
          </p>
          <div className="pd-actions">{cancelButton}</div>
        </div>
      )
    case IssuePanelKind.ACTIVE_UNKNOWN:
      return (
        <div className="pd-active-elsewhere">
          <Alert status="accent" data-testid="pd-code-active-elsewhere">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('pairedDevices.issue.activeElsewhereTitle')}</Alert.Title>
              <Alert.Description>
                <IssuerSentence issuedBy={state.issuedBy} expiresAt={state.expiresAt} now={now} />
              </Alert.Description>
            </Alert.Content>
          </Alert>
          {errorBlock}
          <div className="pd-actions">
            <div className="pd-action-with-hint">
              {issueButton(t('pairedDevices.issue.issueNew'), 'pd-issue-new')}
              <p className="pd-hint">{t('pairedDevices.issue.issueNewHint')}</p>
            </div>
            {cancelButton}
          </div>
        </div>
      )
    case IssuePanelKind.REDEEMED:
      return (
        <div className="pd-redeemed" data-testid="pd-code-redeemed">
          <motion.div variants={m.variants.stamp} initial="hidden" animate="visible" className="pd-redeemed-chip">
            <Chip color="success" variant="soft">
              <CircleCheck aria-hidden="true" className="size-4" />
              <Chip.Label>{t('pairedDevices.issue.pairedChip')}</Chip.Label>
            </Chip>
          </motion.div>
          <p className="pd-redeemed-text">{t('pairedDevices.issue.redeemed', { deviceId: state.deviceId, deviceName: state.deviceName })}</p>
          {errorBlock ?? <div className="pd-actions">{issueButton(t('pairedDevices.issue.issueAnother'), 'pd-issue')}</div>}
        </div>
      )
    case IssuePanelKind.EXPIRED:
      return (
        <div className="pd-ended">
          {held !== null ? (
            <div className="pd-active-code">
              <CodeDigits code={held.code} revealed onRevealed={onRevealed} dimmed />
              <CodeQr payload={held.qrPayload} dimmed />
            </div>
          ) : null}
          <Alert status="warning" data-testid="pd-code-expired">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('pairedDevices.issue.expired')}</Alert.Title>
            </Alert.Content>
          </Alert>
          {errorBlock ?? <div className="pd-actions">{issueButton(t('pairedDevices.issue.button'), 'pd-issue')}</div>}
        </div>
      )
    case IssuePanelKind.EXHAUSTED:
    case IssuePanelKind.CANCELLED_ELSEWHERE: {
      const exhaustedCode = state.kind === IssuePanelKind.EXHAUSTED
      return (
        <div className="pd-ended">
          <Alert status={exhaustedCode ? 'danger' : 'default'} data-testid={exhaustedCode ? 'pd-code-closed' : 'pd-code-cancelled'}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{exhaustedCode ? t('pairedDevices.issue.closed') : t('pairedDevices.issue.cancelled')}</Alert.Title>
            </Alert.Content>
          </Alert>
          {errorBlock ?? <div className="pd-actions">{issueButton(t('pairedDevices.issue.button'), 'pd-issue')}</div>}
        </div>
      )
    }
    case IssuePanelKind.IDLE:
    default:
      return (
        <div className="pd-idle">
          <ol className="pd-steps">
            <li>{t('pairedDevices.issue.steps.one')}</li>
            <li>{t('pairedDevices.issue.steps.two')}</li>
            <li>{t('pairedDevices.issue.steps.three')}</li>
          </ol>
          {errorBlock ?? <div className="pd-actions">{issueButton(t('pairedDevices.issue.button'), 'pd-issue')}</div>}
        </div>
      )
  }
}

/** "A pairing code is active (issued by {{name}}, expires in mm:ss) …", the issuer's name from the replica. */
function IssuerSentence({ issuedBy, expiresAt, now }: { issuedBy: string; expiresAt: number; now: number }) {
  const { t } = useTranslation()
  const name = useSim((s) => selectOperatorById(s, issuedBy)?.displayName ?? issuedBy)
  return <>{t('pairedDevices.issue.activeElsewhere', { name, time: formatCountdown(secondsLeft(expiresAt, now)) })}</>
}
