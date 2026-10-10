import { useMemo, useState } from 'react'
import { Alert, Button, Chip, Spinner } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { FileText, Lock, PencilLine, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatUtcOffset } from '@dems/shared/realtime'
import { Permission, selectCan, selectOperator, useSim } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { retryCoreQuery, useQueryFailure } from '@/lib/core-queries'
import { useWebLive } from '@/runtime'
import type { ItemTranscriptModel, ItemV2 } from './item-v2'
import { logEvidence } from './log'
import { formatWibDateTime, investigatorNameOf } from './model'
import { formatMediaTime, permissionGate } from './sealed-playback'
import { selectOperators } from './selectors'
import { TranscriptReadError, transcriptQueryKey, transcriptRevisionsQueryKey, useTranscript, useTranscriptFollowsRevision, useTranscriptRevisions } from './transcript'
import { currentRevisionNumber, deriveSegments, paneStateOf, revisionReasons, sealedWithoutDocument, type DerivedSegment, type TranscriptPaneState, type TranscriptRevision } from './transcript-model'
import { TranscriptReviseDialog } from './transcript-revise-dialog'
import { useRetryCooldown } from './use-retry-cooldown'

export interface TranscriptPaneProps {
  evidenceId: string
  item: ItemV2
  /**
   * Wave H C2 (G81-07): `access.transcript` of operation 40 for THIS operator. `false`: the page view
   * calls neither operation 84 nor 86 (a refusal is an audited row on the Core) and the pane says
   * "not permitted". null / absent: not reported - the pane asks as before.
   */
  mayRead?: boolean | null
}

/** The Core's reason for "no transcript" of an item of the demonstration data (operation 84, `details.reason`). */
const SIMULATED_ITEM = 'SIMULATED_ITEM'
const STATE_TONE = { success: 'success', warning: 'warning', default: 'neutral' } as const

const STATE_COLOR = { ASSEMBLED: 'success', PARTIAL: 'warning', UNAVAILABLE: 'default', DISABLED: 'default', UNKNOWN: 'default' } as const satisfies Record<TranscriptPaneState, 'success' | 'warning' | 'default'>

/**
 * The transcript pane of a sealed item (blueprint row 92, M8-W3; UX spec flow 6; R-5; WB-04).
 *
 * - **States** are the item summary's, never assumed (R80-01): ASSEMBLED, PARTIAL (with how many
 *   parts of the audio have no text, whether the backend was unreachable, and "No transcript was
 *   sealed" when the seal had none), UNAVAILABLE ("The transcript is not available yet."), DISABLED
 *   (by configuration: nothing is asked of the Core), UNKNOWN ("Transcript state not reported": the
 *   item carries no summary; the document, if the Core answers one, is still shown).
 * - **Speaker labels default to UNAVAILABLE**: the badge reads exactly "speaker labels unavailable"
 *   and every segment is shown unlabelled; a label is drawn only for a LABELLED document.
 * - **The sealed original is immutable.** Each segment shows the sealed text. A revision is shown
 *   BESIDE it, marked "derived, not part of the sealed transcript", and listed with its number, its
 *   author and its signature under the segments (operation 86, newest first). No revision is hidden.
 * - **Revise (G6)**: TRANSCRIPT_REVISE; "Checking your permissions..." until the role is known; a
 *   role without it sees no control. The form is `transcript-revise-dialog.tsx`.
 * - Timestamps are media pts of the segments; nothing here is driven by a timer.
 * - A failed read goes to the shared presenter first, then one record with its codes; "Load again"
 *   is rate-limited (3 s, 6 s, 12 s; three tries).
 */
export function TranscriptPane({ evidenceId, item, mayRead = null }: TranscriptPaneProps) {
  const { t } = useTranslation()
  const live = useWebLive()
  const queryClient = useQueryClient()
  const presentCoreError = useCoreErrorPresenter()
  const retry = useRetryCooldown()
  const operators = useSim(selectOperators)
  const operatorKnown = useSim((s) => selectOperator(s) !== null)
  const canRevise = useSim((s) => selectCan(s, Permission.TRANSCRIPT_REVISE))
  const gate = permissionGate({ operatorKnown, permitted: canRevise })
  const summary = item.transcript
  // No document was sealed (disabled, or unavailable at the seal): nothing is asked of the Core.
  const disabled = sealedWithoutDocument(summary)
  // G81-07: the Core says this operator may not read it: nothing is asked on a page view.
  const blocked = mayRead === false
  const transcript = useTranscript(evidenceId, !disabled && !blocked)
  const revisions = useTranscriptRevisions(evidenceId, !disabled && !blocked && transcript.data !== undefined)
  // A revision another operator appended moves the head of the slice item: both reads are fetched again (pass D10).
  useTranscriptFollowsRevision(evidenceId, summary?.revision ?? null)
  const [revising, setRevising] = useState<{ key: number; index: number } | null>(null)

  const onReadFailure = (source: string) => (error: Error) => {
    const read = error instanceof TranscriptReadError ? error : null
    // "Not available yet" is a state of the item, said by the pane; it is no failure to present or record.
    if (read?.refusal === 'NOT_READY') return
    if (read?.failure != null && presentCoreError(read.failure, { permission: Permission.EVIDENCE_VIEW }) !== null) return
    logEvidence('warn', source, null, { evidenceId, status: read?.status ?? null, code: read?.code ?? 'UNKNOWN' })
  }
  useQueryFailure(transcript, onReadFailure('transcript.read'))
  useQueryFailure(revisions, onReadFailure('transcript.revisions'))

  const document = transcript.data ?? null
  const state = paneStateOf(summary, document !== null)
  const revisionList = revisions.data ?? []
  // G81b-09: the stated reason of each revision (the revision's own member, else the Core's audit row of it).
  const auditRows = useSim((s) => s.audit.rows)
  const reasons = useMemo(() => revisionReasons(revisions.data ?? [], evidenceId, auditRows), [revisions.data, evidenceId, auditRows])
  const derived = document === null ? [] : deriveSegments(document, revisionList)
  const baseRevision = currentRevisionNumber(document, revisionList)
  const refusal = transcript.error instanceof TranscriptReadError ? transcript.error.refusal : transcript.isError ? 'FAILED' : null
  // G81-01: why the Core has no transcript, as its own code; a simulated item never will have one.
  const refusalReason = transcript.error instanceof TranscriptReadError ? transcript.error.reason : null
  // G81-05 (ruling D198): an assembled transcript without a single segment is "no speech", not a success.
  const noSpeech = state === 'ASSEMBLED' && derived.length === 0
  const shownState = noSpeech ? 'NO_SPEECH' : state
  const stateColor = noSpeech ? 'default' : STATE_COLOR[state]
  const loading = !disabled && !blocked && transcript.isPending && transcript.fetchStatus !== 'idle'
  const nameOf = (operatorId: string) => investigatorNameOf(operators, operatorId)
  const revisingSegment = revising === null ? null : (derived.find((entry) => entry.segment.index === revising.index) ?? null)

  const reload = () => {
    if (!retry.consume()) return
    retryCoreQuery(queryClient, transcriptQueryKey(evidenceId, live))
    retryCoreQuery(queryClient, transcriptRevisionsQueryKey(evidenceId, live))
  }

  return (
    <section className="evi-transcript" data-testid="evidence-transcript" data-state={shownState} aria-label={t('evidence.transcript.title')} aria-busy={loading || undefined}>
      <div className="evi-transcript-head">
        <span className="evi-strong inline-flex items-center gap-2">
          <FileText className="size-4" aria-hidden="true" />
          {t('evidence.transcript.title')}
        </span>
        {blocked ? null : (
          <Chip size="sm" variant="soft" color={stateColor} data-testid="evidence-transcript-state" data-tone={STATE_TONE[stateColor]}>
            <Chip.Label>{noSpeech ? t('evidence.itemFacts.web.noSpeechChip') : t(`evidence.transcript.state.${state}`)}</Chip.Label>
          </Chip>
        )}
        {document !== null ? (
          <>
            <Chip size="sm" variant="secondary" data-testid="evidence-transcript-in-package">
              <Lock className="size-3.5" aria-hidden="true" />
              <Chip.Label>{t('evidence.transcript.inPackage')}</Chip.Label>
            </Chip>
            <Chip size="sm" variant="secondary" data-testid="evidence-transcript-speakers" data-speakers={document.speakerState}>
              <Chip.Label>{document.speakerState === 'LABELLED' ? t('evidence.transcript.speakersLabelled') : t('evidence.transcript.speakersUnavailable')}</Chip.Label>
            </Chip>
          </>
        ) : null}
      </div>

      <TranscriptModelFacts model={item.transcriptModel} />

      {blocked ? (
        <p className="evi-caption" role="status" data-testid="evidence-transcript-may-not-read">
          {t('evidence.itemFacts.transcript.mayNotRead')}
        </p>
      ) : null}

      {state === 'PARTIAL' && summary !== null ? (
        <p className="evi-caption" data-testid="evidence-transcript-partial">
          {summary.failedChunks > 0 ? `${t('evidence.transcript.failedChunks', { count: summary.failedChunks })} ` : ''}
          {summary.backendUnreachable ? t('evidence.transcript.backendUnreachable') : ''}
        </p>
      ) : null}

      {state === 'PARTIAL' && disabled ? (
        <p className="evi-caption" data-testid="evidence-transcript-no-document">
          {t('evidence.transcript.noDocument')}
        </p>
      ) : null}

      {loading ? (
        <p className="evi-caption inline-flex items-center gap-2" role="status" data-testid="evidence-transcript-loading">
          <Spinner size="sm" color="current" aria-hidden="true" />
          {t('evidence.transcript.loading')}
        </p>
      ) : null}

      {refusal === 'NOT_READY' ? (
        <p className="evi-caption" role="status" data-testid="evidence-transcript-not-ready" data-reason={refusalReason ?? undefined}>
          {refusalReason === SIMULATED_ITEM ? t('evidence.itemFacts.transcript.simulatedItem') : t('evidence.transcript.notReady')}
        </p>
      ) : null}
      {refusal === 'DENIED' || refusal === 'FAILED' ? (
        <Alert status="danger" role="alert" data-testid="evidence-transcript-failed" data-refusal={refusal}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t(refusal === 'DENIED' ? 'evidence.transcript.notPermitted' : 'evidence.transcript.failed')}</Alert.Title>
            {refusal === 'FAILED' ? (
              <Alert.Description>
                <Button size="sm" variant="outline" onPress={reload} isDisabled={!retry.canRetry} data-testid="evidence-transcript-retry">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  {retry.exhausted ? t('common.errors.maxRetries') : retry.cooldownSeconds > 0 ? t('common.actions.retryIn', { seconds: retry.cooldownSeconds }) : t('evidence.transcript.retry')}
                </Button>
              </Alert.Description>
            ) : null}
          </Alert.Content>
        </Alert>
      ) : null}

      {document !== null ? (
        <>
          <p className="evi-caption" data-testid="evidence-transcript-sealed-note">
            {t('evidence.transcript.sealedOriginal')}
          </p>
          {derived.length === 0 ? (
            noSpeech ? (
              <p className="evi-caption" data-testid="evidence-transcript-no-speech">
                {t('evidence.itemFacts.transcript.noSpeech')}
              </p>
            ) : (
              <p className="evi-caption" data-testid="evidence-transcript-empty">
                {t('evidence.transcript.noSegments')}
              </p>
            )
          ) : (
            <ol className="evi-transcript-list m-0 list-none p-0" data-testid="evidence-transcript-segments">
              {derived.map((entry) => (
                <SegmentRow key={entry.segment.index} entry={entry} gate={gate} authorName={entry.revised ? nameOf(entry.revised.authorId) : ''} onRevise={() => setRevising((previous) => ({ key: (previous?.key ?? 0) + 1, index: entry.segment.index }))} />
              ))}
            </ol>
          )}
          <RevisionList revisions={revisionList} failed={revisions.isError} nameOf={nameOf} reasons={reasons} />
        </>
      ) : null}

      {revising !== null && revisingSegment !== null ? (
        <TranscriptReviseDialog
          key={revising.key}
          evidenceId={evidenceId}
          segment={revisingSegment}
          baseRevision={baseRevision}
          isOpen
          onOpenChange={(open) => {
            if (!open) setRevising(null)
          }}
        />
      ) : null}
    </section>
  )
}

function SegmentRow({ entry, gate, authorName, onRevise }: { entry: DerivedSegment; gate: ReturnType<typeof permissionGate>; authorName: string; onRevise: () => void }) {
  const { t } = useTranslation()
  const { segment, revised } = entry
  const start = formatMediaTime(segment.startMs)
  const end = formatMediaTime(segment.endMs)
  return (
    <li className="evi-transcript-segment" data-testid={`evidence-transcript-segment-${segment.index}`} data-revised={revised ? 'true' : 'false'} aria-label={t('evidence.transcript.segmentLabel', { index: segment.index, start, end })}>
      <span className="evi-mono evi-caption">
        {start}–{end}
      </span>
      <div className="min-w-0">
        {segment.speaker !== null ? (
          <span className="evi-label" data-testid={`evidence-transcript-speaker-${segment.index}`}>
            {segment.speaker}
          </span>
        ) : null}
        <p className="evi-transcript-text" data-testid={`evidence-transcript-original-${segment.index}`}>
          {segment.text}
        </p>
      </div>
      {gate === 'REFUSED' ? (
        <span />
      ) : (
        <Button size="sm" variant="ghost" isDisabled={gate !== 'ALLOWED'} onPress={onRevise} data-testid={`evidence-transcript-revise-${segment.index}`} data-gate={gate}>
          <PencilLine className="size-4" aria-hidden="true" />
          {gate === 'CHECKING' ? t('evidence.playback.checking') : t('evidence.transcript.revise.action')}
        </Button>
      )}
      {revised ? (
        <div className="evi-transcript-derived" data-testid={`evidence-transcript-derived-${segment.index}`} data-revision={revised.number}>
          <span className="evi-caption evi-strong">
            {t('evidence.transcript.derived', { number: revised.number })} · {t('evidence.transcript.revisions.author', { author: authorName })}
          </span>
          <p className="evi-transcript-text">{revised.text}</p>
        </div>
      ) : null}
    </li>
  )
}

/**
 * Fix wave K (G81b-06; D160): which model made the sealed transcript, as the item states it. A local
 * backend: name, the version the installation declared, quantisation, file hash. A server backend:
 * the name and the Core's own sentence that version, quantisation and hash are not available to it
 * and were not verified. Nothing is drawn for an item that states no model.
 */
export function TranscriptModelFacts({ model }: { model: ItemTranscriptModel | null }) {
  const { t } = useTranslation()
  if (model === null) return null
  return (
    <section className="flex flex-col gap-1" data-testid="evidence-transcript-model" data-reported-by-server={model.reportedByServer ? 'true' : 'false'} aria-label={t('web.transcript.model.title')}>
      <span className="evi-strong">{t('web.transcript.model.title')}</span>
      <dl className="evi-kv m-0">
        <div>
          <dt className="evi-caption">{t('web.transcript.model.name')}</dt>
          <dd className="evi-mono" data-testid="evidence-transcript-model-name">{model.name}</dd>
        </div>
        {model.reportedByServer ? null : (
          <>
            <div>
              <dt className="evi-caption">{t('web.transcript.model.version')}</dt>
              <dd className="evi-mono" data-testid="evidence-transcript-model-version">{model.version ?? t('common.platformNotReported.value')}</dd>
            </div>
            <div>
              <dt className="evi-caption">{t('web.transcript.model.quantisation')}</dt>
              <dd className="evi-mono" data-testid="evidence-transcript-model-quantisation">{model.quantisation ?? t('common.platformNotReported.value')}</dd>
            </div>
            <div>
              <dt className="evi-caption">{t('web.transcript.model.hash')}</dt>
              <dd className="evi-mono break-all" data-testid="evidence-transcript-model-hash">{model.modelSha256 ?? t('common.platformNotReported.value')}</dd>
            </div>
          </>
        )}
      </dl>
      {model.reportedByServer ? (
        // D160: the Core's own sentence - reported by the STT server, not verified by the Core.
        <p className="evi-caption" data-testid="evidence-transcript-model-report">
          {model.report}
        </p>
      ) : null}
    </section>
  )
}

export function RevisionList({ revisions, failed, nameOf, reasons }: { revisions: readonly TranscriptRevision[]; failed: boolean; nameOf: (operatorId: string) => string; reasons: ReadonlyMap<string, string> }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-2" data-testid="evidence-transcript-revisions" aria-label={t('evidence.transcript.revisions.title')}>
      <span className="evi-strong">{t('evidence.transcript.revisions.title')}</span>
      {failed ? (
        <p className="evi-caption evi-bad" role="alert" data-testid="evidence-transcript-revisions-failed">
          {t('evidence.transcript.revisions.loadFailed')}
        </p>
      ) : revisions.length === 0 ? (
        <p className="evi-caption" data-testid="evidence-transcript-revisions-none">
          {t('evidence.transcript.revisions.none')}
        </p>
      ) : (
        <ol className="evi-revisions">
          {revisions.map((revision) => (
            <li key={revision.revisionId} className="evi-revision" data-testid={`evidence-transcript-revision-${revision.number}`} data-author={revision.authorId}>
              <span className="evi-strong">{t('evidence.transcript.revisions.entry', { number: revision.number })}</span>{' '}
              <span className="evi-caption">
                {t('evidence.transcript.revisions.author', { author: nameOf(revision.authorId) })}
                {revision.createdAt !== null ? ` · ${formatWibDateTime(revision.createdAt)} UTC${formatUtcOffset()}` : ''}
                {' · '}
                {revision.baseRevision === 0 ? t('evidence.transcript.revisions.baseOriginal') : t('evidence.transcript.revisions.base', { base: revision.baseRevision })}
                {' · '}
                {revision.simulated ? t('evidence.transcript.revisions.simulated') : t('evidence.transcript.revisions.signed', { key: revision.signedBy })}
              </span>
              <p className="evi-caption m-0" data-testid={`evidence-transcript-revision-reason-${revision.number}`} data-reason={reasons.has(revision.revisionId) ? 'stated' : 'none'}>
                {reasons.has(revision.revisionId) ? t('web.transcript.reason', { reason: reasons.get(revision.revisionId) ?? '' }) : t('web.transcript.reasonNotReported')}
              </p>
              <ul className="m-0 list-none p-0">
                {revision.changes.map((change, index) => (
                  <li key={`${change.segmentIndex}-${index}`} className="evi-caption">
                    <span className="evi-strong">{t('evidence.transcript.revisions.change', { index: change.segmentIndex })}</span>: <span className="evi-transcript-text">{change.to}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
