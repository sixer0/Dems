import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Card, Chip, ProgressBar, Table } from '@heroui/react'
import { Copy, KeyRound, PackageCheck, RotateCcw, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEMO_EVIDENCE_INDEX } from '@dems/shared/demo-data'
import { formatUtcOffset } from '@dems/shared/realtime'
import { EvidenceLifecycleStage } from '@dems/shared/domain'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { useSim } from '@dems/shared/sim'
import { Stepper, type StepperStep } from '@/components/composed/stepper'
import { useMotionPolicy } from '@/motion'
import { CheckList } from './check-list'
import { VerdictChip, type VerdictState } from './chips'
import { copyText } from './clipboard'
import { formatWibClockSeconds, formatWibDate, formatWibDateTime, shortHash, storedVerification, type EvidenceRow } from './model'
import { selectOperators } from './selectors'
import { useRetryCooldown } from './use-retry-cooldown'
import type { EvidenceVerification } from './use-verification'

const LIFECYCLE: EvidenceLifecycleStage[] = Object.values(EvidenceLifecycleStage)
/** M-C-09: the lifecycle connectors fill one stage after another on mount (spec: "fill up to the current stage"). */
export const LIFECYCLE_STEP_MS = 70

export interface IntegrityTabProps {
  row: EvidenceRow
  verification: EvidenceVerification
}

/**
 * R-W-1 (closing fix CF-W): a custody action code ("RECORDING_STOPPED", "SESSION_INCOMPLETE") may wrap
 * only after an underscore, so a narrow Action column shows "RECORDING_ / STOPPED" instead of making
 * the table wider than its card (a code has no other break opportunity). The words are unchanged:
 * `<wbr>` adds no text.
 */
function breakableCode(code: string): ReactNode {
  const parts = code.split('_')
  return parts.map((part, index) => (
    <Fragment key={`${index}:${part}`}>
      {part}
      {index < parts.length - 1 ? (
        <>
          _<wbr />
        </>
      ) : null}
    </Fragment>
  ))
}

/**
 * Hash & Integrity tab (01_specs §14.5.3; research/04 §5.1; D67 (b)(c); review 40 R2/M3; M-C-21).
 *
 * Shows PACKAGE data (the sealed per-track SHA-256, the manifest digest, the Ed25519 signature and
 * the DEMO certificate) and the REAL re-verification (`useEvidenceVerification`); never the
 * simulator's synthetic hashes or ECDSA certificate for a package-backed item. Items without a
 * package show the simulator's values, labelled SIMULATED. Below: the §19.1 lifecycle Stepper and the
 * chain-of-custody table (simulator custody log, which the verification and exports append to).
 *
 * Live mode (backend task, plan row W69; 04_client_integration_spec §8.2 A6, §14 point 7; §3.2):
 * the verdict chip, the check list and the custody table show the Core server's record (the custody
 * entry of a verification arrives with the answer's delta, CL-16). The bundled package's check, when
 * it runs, has its own line labelled "Bundled demo package", and an info Alert says so when the two
 * differ. An item without a bundled package shows the Core's values, labelled "Core record".
 *
 * Stored verdict (E-fix FX-W, E2E-W1-3): the card opens on the record's last verification
 * (`item.verification`, the Core server's in Live mode), never on "Not verified" when the record holds
 * a PASS or a FAIL, and a line under the mode names it: result, time and who (the actor of its custody
 * entry). A new Verify replaces the chip with its own verdict; the record's delta then moves the line
 * to the new run (CL-16) once the run has ended — while it runs the line holds the record of the
 * press (FXR-W W92-10), so the delta never shows the verdict before the run reveals it. The per-check list belongs to a run, so while the stored verdict shows, the
 * card says that Verify again lists each check instead of "0 of 6 checks".
 *
 * Custody times (E-fix FX-W, E2E-W1-7): the date and the clock are two tokens that never break inside
 * themselves; a narrow column puts the clock on a second line (`.evi-custody-time`).
 *
 * Custody table width (closing fix CF-W, R-W-1): the kit's automatic table layout never made the table
 * narrower than the sum of its columns' longest unbreakable words plus padding — the date token,
 * `RECORDING_STOPPED`, "Pratama", "supervisor": 472 px in a 441 px card at 1440x900, 97 px over at
 * 1280x800 with the Detail out of sight. The table now has fixed column widths (`evidence.css`), so it
 * is never wider than its card; an action code may wrap only after an underscore (`breakableCode`);
 * on a narrow card (< 26rem of content, the 1280 px layout) the Detail sits under the action, and on a
 * phone-width card (< 20rem) the actor too. The cells carry the classes that layout uses, and the row
 * says whether it has a Detail (`data-detail`).
 */
export function IntegrityTab({ row, verification }: IntegrityTabProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const live = useCoreMode() === CoreMode.LIVE
  const operators = useSim(selectOperators)
  const { state, run } = verification
  const retry = useRetryCooldown()
  const pkg = row.pkg

  const recordNow = storedVerification(row.item)
  // FXR-W W92-10 (D227 O-RF-T-3; the mobile card's CF-M2 rule): while a run is on screen the line keeps
  // the record's value from the run's start. In Live mode the Core's delta updates the record before
  // the run reveals its checks (CL-16), so the line would show the new verdict before the run does.
  // The first render of a run still holds the old record (the delta comes a round trip later); it is
  // pinned there, per run, and released when the run ends.
  const [pinned, setPinned] = useState<{ readonly runId: number; readonly stored: typeof recordNow } | null>(null)
  if (state.phase === 'running' && pinned?.runId !== state.runId) setPinned({ runId: state.runId, stored: recordNow })
  const stored = state.phase === 'running' ? (pinned?.runId === state.runId ? pinned.stored : recordNow) : recordNow
  // Nothing ran in this view yet: the card shows the verdict the record holds (E2E-W1-3).
  const showStored = state.phase === 'idle' && stored !== null
  const verdict: VerdictState =
    state.phase === 'running' ? 'RUNNING' : state.phase === 'error' ? 'ERROR' : (state.verdict ?? stored?.status ?? 'NOT_RUN')
  const done = state.checks.filter((check) => check.phase === 'pass' || check.phase === 'fail').length
  const total = state.checks.length

  const onVerify = async () => {
    if (state.phase === 'error' && !retry.consume()) return
    const result = await run()
    if (result?.phase === 'done') retry.reset()
  }

  // M-C-09 lifecycle: stages fill in sequence up to the current one (instant under reduced motion).
  const currentIndex = Math.max(0, LIFECYCLE.indexOf(row.item.lifecycleStage))
  const [stepped, setStepped] = useState(-1)
  const target = useRef(currentIndex)
  useEffect(() => {
    target.current = currentIndex
    if (m.reduced) return undefined
    const timer = setInterval(() => {
      setStepped((value) => {
        if (value >= target.current) {
          clearInterval(timer)
          return target.current
        }
        return value + 1
      })
    }, m.seconds(LIFECYCLE_STEP_MS) * 1000)
    return () => clearInterval(timer)
  }, [currentIndex, m])
  const revealed = m.reduced ? currentIndex : Math.min(stepped, currentIndex)
  const lifecycleSteps: StepperStep[] = LIFECYCLE.map((stage, index) => ({
    id: stage,
    label: t(`common.enums.evidenceLifecycleStage.${stage}`),
    status: index < revealed ? 'done' : index === revealed && index === currentIndex ? 'active' : 'pending',
  }))

  const nameOf = (actorId: string | null) =>
    actorId === null ? t('evidence.integrity.system') : (operators.find((operator) => operator.id === actorId)?.displayName ?? actorId)

  const lastLine = (() => {
    if (!stored) return null
    const result = t(`common.verificationStatus.${stored.status}`)
    if (stored.at === null) return t('evidence.verify.last.resultOnly', { result })
    const at = `${formatWibDateTime(stored.at)} UTC${formatUtcOffset()}`
    return stored.actorKnown
      ? t('evidence.verify.last.full', { result, at, actor: nameOf(stored.actorId) })
      : t('evidence.verify.last.noActor', { result, at })
  })()

  const copy = (value: string) =>
    void copyText(value, { ok: t('evidence.detail.integrity.hashCopied'), failed: t('evidence.integrity.copyFailed') }, 'integrity.copy')

  const hashes = useMemo(() => {
    if (pkg) {
      return pkg.tracks.map((track) => ({ id: track.trackId, label: t(`common.tracks.${track.trackId}`), value: track.sealedSha256 }))
    }
    return row.item.tracks.map((track) => ({ id: track.trackId, label: t(`common.tracks.${track.trackId}`), value: track.sha256 }))
  }, [pkg, row.item.tracks, t])

  return (
    <div className="evi-integrity" data-testid="evidence-integrity" data-mode={state.mode}>
      <div className="evi-integrity-main">
        <Card className="evi-verify-card" data-testid="evidence-verify-card" data-verdict-source={showStored ? 'record' : state.phase === 'idle' ? 'none' : 'run'}>
          <div className="evi-verify-head">
            <VerdictChip verdict={verdict} runKey={state.runId} size="lg" />
            <div className="evi-verify-text">
              <span className="evi-strong">
                {state.mode === 'core'
                  ? t('evidence.live.verify.mode')
                  : state.mode === 'package'
                    ? t('evidence.verify.packageMode')
                    : t('evidence.verify.simulatedMode')}
              </span>
              <span className="evi-caption" data-testid="evidence-verify-label">
                {state.mode === 'core'
                  ? t('evidence.live.verify.note')
                  : (state.label ?? (state.mode === 'package' ? t('evidence.verify.trustNote') : t('evidence.verify.simulatedNote')))}
              </span>
              {lastLine ? (
                <span className="evi-caption evi-verify-last" data-testid="evidence-verify-last" data-status={stored?.status}>
                  {lastLine}
                </span>
              ) : null}
            </div>
            <Button
              variant="primary"
              onPress={() => void onVerify()}
              isPending={state.phase === 'running'}
              isDisabled={state.phase === 'error' && !retry.canRetry}
              data-testid="evidence-verify"
              className="ml-auto"
            >
              {state.phase === 'error' ? <RotateCcw className="size-4" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
              {state.phase === 'running'
                ? t('evidence.detail.integrity.verifying')
                : state.phase === 'error'
                  ? retry.exhausted
                    ? t('evidence.verify.retryExhausted')
                    : retry.cooldownSeconds > 0
                      ? t('common.actions.retryIn', { seconds: retry.cooldownSeconds })
                      : t('common.actions.retry')
                  : state.phase === 'done' || showStored
                    ? t('evidence.verify.again')
                    : t('evidence.detail.integrity.verify')}
            </Button>
          </div>
          {showStored ? (
            <span className="evi-caption" data-testid="evidence-verify-stored-hint">
              {t('evidence.verify.storedHint')}
            </span>
          ) : (
            <>
              <ProgressBar aria-label={t('evidence.verify.progress', { done, total })} value={total === 0 ? 0 : (done / total) * 100} className="evi-verify-progress" size="sm">
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <span className="evi-caption">{t('evidence.verify.progress', { done, total })}</span>
            </>
          )}
          <CheckList state={state} variant="full" />
          {state.bundled ? (
            <div className="evi-bundled" data-testid="evidence-bundled" data-phase={state.bundled.phase} data-verdict={state.bundled.verdict ?? undefined}>
              <PackageCheck className="size-4 text-foreground-2" aria-hidden="true" />
              <div className="flex min-w-0 flex-col">
                <span className="evi-strong">{t('evidence.live.verify.bundledTitle')}</span>
                <span className="evi-caption">
                  {state.bundled.phase === 'running'
                    ? t('evidence.live.verify.bundledRunning')
                    : state.bundled.phase === 'error'
                      ? t('evidence.live.verify.bundledError')
                      : `${state.bundled.label ?? ''} · ${t('evidence.live.verify.bundledNote')}`}
                </span>
              </div>
              {state.bundled.verdict ? (
                <Chip size="sm" variant="soft" color={state.bundled.verdict === 'PASS' ? 'success' : 'danger'} className="ml-auto font-semibold uppercase">
                  <Chip.Label>{t(`common.verificationStatus.${state.bundled.verdict}`)}</Chip.Label>
                </Chip>
              ) : null}
            </div>
          ) : null}
          {state.differs ? (
            <Alert status="accent" data-testid="evidence-bundled-differs">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('evidence.live.verify.differsTitle')}</Alert.Title>
                <Alert.Description>{t('evidence.live.verify.differs')}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
        </Card>

        <Card className="evi-hash-card" data-testid="evidence-hashes" data-source={pkg ? 'package' : live ? 'core' : 'simulated'}>
          <h3 className="evi-section-title">
            <KeyRound className="size-4 text-accent" aria-hidden="true" />
            {t('evidence.integrity.sealedValues')}
            <Chip size="sm" variant="secondary" className="evi-demo-chip">
              <Chip.Label>{pkg ? t('evidence.demo.chip') : live ? t('evidence.live.coreRecord') : t('common.simulated.chip')}</Chip.Label>
            </Chip>
          </h3>
          <ul className="evi-hash-list">
            {hashes.map((hash) => (
              <li key={hash.id} data-hash={hash.id}>
                <span className="evi-caption">{t('evidence.detail.integrity.trackHash', { track: `${hash.id} · ${hash.label}` })}</span>
                <span className="evi-hash-row">
                  <span className="evi-mono evi-hash" title={hash.value}>
                    {shortHash(hash.value, 16)}
                  </span>
                  <Button isIconOnly size="sm" variant="ghost" aria-label={t('evidence.detail.integrity.copyHash')} onPress={() => copy(hash.value)}>
                    <Copy className="size-3.5" aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ))}
            <li data-hash="manifest">
              <span className="evi-caption">{t('evidence.detail.integrity.manifestHash')}</span>
              <span className="evi-hash-row">
                <span className="evi-mono evi-hash">{shortHash(pkg ? pkg.signature.signedDigest : row.item.manifestHash, 16)}</span>
                <Button isIconOnly size="sm" variant="ghost" aria-label={t('evidence.detail.integrity.copyHash')} onPress={() => copy(pkg ? pkg.signature.signedDigest : row.item.manifestHash)}>
                  <Copy className="size-3.5" aria-hidden="true" />
                </Button>
              </span>
            </li>
            <li data-hash="signature">
              <span className="evi-caption">
                {pkg ? t('evidence.integrity.signatureDemo', { key: pkg.signature.keyId }) : t('evidence.detail.integrity.signature')}
              </span>
              <span className="evi-hash-row">
                <span className="evi-mono evi-hash">{shortHash(pkg ? pkg.signature.signatureHex : row.item.signature.value, 16)}</span>
              </span>
              <span className="evi-caption">
                {pkg ? t('evidence.integrity.signatureNoteDemo', { at: `${formatWibDateTime(Date.parse(pkg.signature.signedAt))} UTC${formatUtcOffset()}` }) : t('evidence.detail.integrity.signatureNote')}
              </span>
            </li>
            {pkg ? (
              <li data-hash="certificate">
                <span className="evi-caption">{t('evidence.integrity.certificate')}</span>
                <span className="evi-caption evi-cert-subject">{DEMO_EVIDENCE_INDEX.certificate.subject}</span>
                <span className="evi-mono evi-caption">
                  {t('evidence.integrity.certificateMeta', {
                    serial: shortHash(DEMO_EVIDENCE_INDEX.certificate.serialNumber, 6),
                    fingerprint: shortHash(DEMO_EVIDENCE_INDEX.certificate.sha256, 8),
                    until: DEMO_EVIDENCE_INDEX.certificate.notAfter.slice(0, 10),
                  })}
                </span>
              </li>
            ) : null}
            {pkg ? (
              <li data-hash="audit">
                <span className="evi-caption">{t('evidence.integrity.auditExtract')}</span>
                <span className="evi-mono evi-caption">
                  {t('evidence.integrity.auditMeta', { rows: pkg.audit.rows, first: pkg.audit.firstSeq, last: pkg.audit.lastSeq, head: shortHash(pkg.audit.lastHash, 8) })}
                </span>
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      <div className="evi-integrity-side">
        <Card className="evi-lifecycle-card" data-testid="evidence-lifecycle">
          <h3 className="evi-section-title">{t('evidence.detail.integrity.lifecycle')}</h3>
          <Stepper steps={lifecycleSteps} orientation="vertical" variant="wizard" ariaLabel={t('evidence.detail.integrity.lifecycle')} className="evi-lifecycle" />
        </Card>

        <Card className="evi-custody-card" data-testid="evidence-custody">
          <h3 className="evi-section-title">{t('evidence.detail.integrity.custody')}</h3>
          <Table variant="secondary" className="evi-custody-table">
            <Table.ScrollContainer>
              <Table.Content aria-label={t('evidence.detail.integrity.custody')}>
                <Table.Header>
                  <Table.Column id="time" isRowHeader className="evi-custody-col-time">
                    {/* AC-74 (step 45b, F45-04): the zone of the custody times, once in the header. */}
                    <span>
                      {t('evidence.detail.integrity.custodyColumns.time')}{' '}
                      <span className="evi-col-zone">{`UTC${formatUtcOffset()}`}</span>
                    </span>
                  </Table.Column>
                  <Table.Column id="action" className="evi-custody-col-action">
                    {t('evidence.detail.integrity.custodyColumns.action')}
                  </Table.Column>
                  <Table.Column id="actor" className="evi-custody-col-actor">
                    {t('evidence.detail.integrity.custodyColumns.actor')}
                  </Table.Column>
                  <Table.Column id="detail" className="evi-custody-col-detail">
                    {t('evidence.detail.integrity.custodyColumns.detail')}
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {row.item.custody
                    .map((entry, index) => ({ entry, index }))
                    .reverse()
                    .map(({ entry, index }) => (
                      <Table.Row
                        key={`${entry.at}-${index}`}
                        id={`${entry.at}-${index}`}
                        data-custody-action={entry.action}
                        data-detail={entry.detail ? 'true' : 'false'}
                      >
                        <Table.Cell className="evi-custody-time-cell">
                          {/* E2E-W1-7: two tokens that never break inside; a narrow column wraps between them. */}
                          <span className="evi-mono evi-caption evi-custody-time" data-testid="evidence-custody-time">
                            <span className="evi-custody-date">{formatWibDate(entry.at)}</span>{' '}
                            <span className="evi-custody-clock">{formatWibClockSeconds(entry.at)}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="evi-custody-action-cell">
                          <span className="evi-strong evi-custody-action">{breakableCode(entry.action)}</span>
                        </Table.Cell>
                        <Table.Cell className="evi-custody-actor">{nameOf(entry.actorId)}</Table.Cell>
                        <Table.Cell className="evi-custody-detail" data-empty={entry.detail ? undefined : 'true'}>
                          <span className="evi-caption">{entry.detail ?? '—'}</span>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card>
      </div>
    </div>
  )
}
