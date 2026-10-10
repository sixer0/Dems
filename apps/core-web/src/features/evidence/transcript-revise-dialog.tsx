import { useState } from 'react'
import { Alert, Button, Description, FieldError, Label, Modal, Spinner, TextArea, TextField, toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { Permission } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { logEvidence, newCorrelationId } from './log'
import { useReviseTranscript } from './transcript'
import { REVISION_NOTE_MAX, REVISION_NOTE_MIN, REVISION_TEXT_MAX, revisionNoteOk, revisionRequestOf, validateRevisionText, type DerivedSegment, type ReviseRefusal, type RevisionFieldError } from './transcript-model'

export interface TranscriptReviseDialogProps {
  evidenceId: string
  /** The segment as the pane shows it NOW: the sealed original and its newest revision. */
  segment: DerivedSegment
  /** The current revision number of the item, as the pane last read it. */
  baseRevision: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The revise form of one transcript segment (blueprint row 92; UX spec flow 6 steps 5 and 7, G6;
 * operation 85; OD-15).
 *
 * The sealed original is shown read-only and is never edited: the form sends the corrected text of
 * this one segment, the text the operator saw, and the revision number it is built on. The Core
 * appends the revision and signs it with its own key; the author is the signed-in operator.
 *
 * - Field check before any request, shown under the field: the text must differ and fit the bound.
 * - `409 TRANSCRIPT_REVISION_CONFLICT`: the fixed sentence, shown in the dialog. The pane has
 *   already read the revisions again; the typed text stays, so the operator checks the current text
 *   and saves again on the new revision number.
 * - Any other refusal: the shared presenter first (a 403 names the role, an outage is coalesced),
 *   then a sentence in the dialog and one record with the codes. The typed text is never logged.
 * - One request per press: the button ignores presses while a request is out.
 */
export function TranscriptReviseDialog({ evidenceId, segment, baseRevision, isOpen, onOpenChange }: TranscriptReviseDialogProps) {
  const { t } = useTranslation()
  const revise = useReviseTranscript(evidenceId)
  const presentCoreError = useCoreErrorPresenter()
  const saving = usePendingControl()
  const current = segment.revised?.text ?? segment.segment.text
  const [typed, setTyped] = useState(current)
  const [note, setNote] = useState('')
  const [fieldError, setFieldError] = useState<RevisionFieldError | null>(null)
  const [refusal, setRefusal] = useState<ReviseRefusal | null>(null)

  // Pass D6: a revision of evidence needs a stated reason; Save stays disabled until the note fits the Core's bound.
  const noteOk = revisionNoteOk(note)

  const save = () => {
    const error = validateRevisionText(current, typed)
    setFieldError(error)
    if (error !== null || !noteOk) return
    saving.run((release) => {
      const correlationId = newCorrelationId('ui')
      void revise(revisionRequestOf(baseRevision, segment.segment.index, current, typed, note))
        .then((outcome) => {
          if (outcome.ok) {
            toast.success(t('evidence.transcript.revise.success', { number: outcome.revision.number }))
            onOpenChange(false)
            return
          }
          if (outcome.refusal === 'DENIED' || outcome.refusal === 'OTHER') {
            const presented = outcome.failure !== null && presentCoreError(outcome.failure, { permission: Permission.TRANSCRIPT_REVISE }) !== null
            if (!presented) logEvidence('error', 'transcript.revise', null, { evidenceId, correlationId, segmentIndex: segment.segment.index, status: outcome.status, code: outcome.code, textLength: typed.length })
          }
          setRefusal(outcome.refusal)
        })
        .catch((error: unknown) => {
          logEvidence('error', 'transcript.revise', error, { evidenceId, correlationId, segmentIndex: segment.segment.index, textLength: typed.length })
          setRefusal('OTHER')
        })
        .finally(release)
    })
  }

  const refusalText =
    refusal === 'CONFLICT'
      ? t('evidence.transcript.revise.conflict')
      : refusal === 'NOT_READY'
        ? t('evidence.transcript.notReady')
        : refusal === 'DENIED'
          ? t('evidence.transcript.revise.denied')
          : refusal === 'OTHER'
            ? t('evidence.transcript.revise.failed')
            : null

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant="blur">
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog aria-label={t('evidence.transcript.revise.title', { index: segment.segment.index })} data-testid="transcript-revise-dialog">
          <Modal.Header>
            <Modal.Heading>{t('evidence.transcript.revise.title', { index: segment.segment.index })}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3" aria-busy={saving.busy || undefined}>
            <p className="evi-caption">{t('evidence.transcript.revise.lead')}</p>
            <div>
              <span className="evi-label">{t('evidence.transcript.revise.original')}</span>
              <p className="evi-transcript-text" data-testid="transcript-revise-original">
                {segment.segment.text}
              </p>
            </div>
            {segment.revised ? (
              <div>
                <span className="evi-label">{t('evidence.transcript.revise.current', { number: segment.revised.number })}</span>
                <p className="evi-transcript-text" data-testid="transcript-revise-current">
                  {segment.revised.text}
                </p>
              </div>
            ) : null}
            <TextField
              isRequired
              value={typed}
              onChange={(value) => {
                setTyped(value)
                setFieldError(null)
              }}
              isInvalid={fieldError !== null}
              className="evi-field"
            >
              <Label>{t('evidence.transcript.revise.field')}</Label>
              <TextArea rows={4} data-testid="transcript-revise-text" />
              {fieldError === 'unchanged' ? <FieldError>{t('evidence.transcript.revise.unchanged')}</FieldError> : null}
              {fieldError === 'tooLong' ? <FieldError>{t('evidence.transcript.revise.tooLong', { max: REVISION_TEXT_MAX })}</FieldError> : null}
            </TextField>
            <TextField isRequired value={note} onChange={(value) => setNote(value.slice(0, REVISION_NOTE_MAX))} className="evi-field">
              <Label>{t('evidence.transcript.revise.note')}</Label>
              <TextArea rows={2} data-testid="transcript-revise-note" />
              {noteOk ? null : <Description data-testid="transcript-revise-note-rule">{t('evidence.transcript.revise.noteRule', { min: REVISION_NOTE_MIN, max: REVISION_NOTE_MAX })}</Description>}
              <Description>{baseRevision === 0 ? t('evidence.transcript.revisions.baseOriginal') : t('evidence.transcript.revisions.base', { base: baseRevision })}</Description>
            </TextField>
            {refusalText !== null ? (
              <Alert status="danger" role="alert" data-testid="transcript-revise-refusal" data-refusal={refusal ?? undefined}>
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{refusalText}</Alert.Title>
                  {refusal === 'CONFLICT' ? <Alert.Description>{t('evidence.transcript.revise.conflictHint')}</Alert.Description> : null}
                </Alert.Content>
              </Alert>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={() => onOpenChange(false)} data-testid="transcript-revise-cancel">
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" onPress={save} isPending={saving.pending} isDisabled={!noteOk} data-testid="transcript-revise-save">
              {saving.pending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
              {t('evidence.transcript.revise.save')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
