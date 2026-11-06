/**
 * The revise form of one transcript segment (blueprint row 92; UX spec flow 6 steps 5 and 7, G6;
 * operation 85; OD-15), in the kit's bottom sheet.
 *
 * The sealed original is shown read-only and is never edited: the form sends the corrected text of
 * this one segment, the text the operator saw, and the revision number it is built on. The Core
 * appends the revision and signs it with its own key; the author is the signed-in operator.
 *
 * - Field check before any request, shown under the field: the text must differ and fit the bound.
 * - `409 TRANSCRIPT_REVISION_CONFLICT`: the fixed sentence in the sheet. The pane has already read
 *   the revisions again; the typed text stays, so the operator checks the current text and saves
 *   again on the new revision number.
 * - Any other refusal: the shared presenter first, then a sentence in the sheet and one record
 *   with the codes. The typed text is never logged.
 * - One request per press: the button ignores presses while a request is out.
 */
import { Alert, Button, Description, FieldError, Label, Spinner, TextArea, TextField, useToast } from 'heroui-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { newCorrelationId, reportRuntimeIssue, useCoreErrorPresenter } from '@/runtime';
import { SheetFrame } from './sheet-frame';
import { useReviseTranscript } from './transcript';
import { REVISION_NOTE_MAX, REVISION_NOTE_MIN, REVISION_TEXT_MAX, revisionNoteOk, revisionRequestOf, validateRevisionText, type DerivedSegment, type ReviseRefusal, type RevisionFieldError } from './transcript-model';

export interface TranscriptReviseSheetProps {
  evidenceId: string;
  /** The segment as the pane shows it NOW: the sealed original and its newest revision. */
  segment: DerivedSegment;
  /** The current revision number of the item, as the pane last read it. */
  baseRevision: number;
  isOpen: boolean;
  onClose: () => void;
}

export function TranscriptReviseSheet({ evidenceId, segment, baseRevision, isOpen, onClose }: TranscriptReviseSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const revise = useReviseTranscript(evidenceId);
  const presentCoreError = useCoreErrorPresenter();
  const current = segment.revised?.text ?? segment.segment.text;
  const [typed, setTyped] = useState(current);
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState<RevisionFieldError | null>(null);
  const [refusal, setRefusal] = useState<ReviseRefusal | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  // Pass D6: a revision of evidence needs a stated reason; Save stays disabled until the note fits the Core's bound.
  const noteOk = revisionNoteOk(note);

  const save = () => {
    const error = validateRevisionText(current, typed);
    setFieldError(error);
    if (error !== null || !noteOk || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    const correlationId = newCorrelationId('evidence');
    const facts = { evidenceId, segmentIndex: segment.segment.index, textLength: typed.length };
    void revise(revisionRequestOf(baseRevision, segment.segment.index, current, typed, note))
      .then((outcome) => {
        if (outcome.ok) {
          toast.show({ variant: 'success', label: t('evidence.transcript.revise.success', { number: outcome.revision.number }) });
          onClose();
          return;
        }
        if (outcome.refusal === 'DENIED' || outcome.refusal === 'OTHER') {
          const presented = outcome.failure !== null && presentCoreError(outcome.failure);
          reportRuntimeIssue(presented ? 'warn' : 'error', 'evidence.transcript.revise', `createTranscriptRevision -> ${outcome.code}`, { ...facts, status: outcome.status, code: outcome.code }, correlationId);
        }
        setRefusal(outcome.refusal);
      })
      .catch(() => {
        reportRuntimeIssue('error', 'evidence.transcript.revise', 'createTranscriptRevision did not settle', facts, correlationId);
        setRefusal('OTHER');
      })
      .finally(() => {
        inFlight.current = false;
        setSaving(false);
      });
  };

  const refusalText =
    refusal === 'CONFLICT'
      ? t('evidence.transcript.revise.conflict')
      : refusal === 'NOT_READY'
        ? t('evidence.transcript.notReady')
        : refusal === 'DENIED'
          ? t('evidence.transcript.revise.denied')
          : refusal === 'OTHER'
            ? t('evidence.transcript.revise.failed')
            : null;

  return (
    <SheetFrame
      isOpen={isOpen}
      onClose={onClose}
      title={t('evidence.transcript.revise.title', { index: segment.segment.index })}
      description={evidenceId}
      closeLabel={t('common.actions.cancel')}
      testID="transcript-revise-sheet"
      scroll
    >
      <View style={styles.body}>
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {t('evidence.transcript.revise.lead')}
        </Text>
        <View>
          <Text maxFontSizeMultiplier={1.2} style={styles.label}>
            {t('evidence.transcript.revise.original')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} selectable style={styles.text} testID="transcript-revise-original">
            {segment.segment.text}
          </Text>
        </View>
        {segment.revised ? (
          <View>
            <Text maxFontSizeMultiplier={1.2} style={styles.label}>
              {t('evidence.transcript.revise.current', { number: segment.revised.number })}
            </Text>
            <Text maxFontSizeMultiplier={1.2} selectable style={styles.text} testID="transcript-revise-current">
              {segment.revised.text}
            </Text>
          </View>
        ) : null}
        <TextField isRequired isInvalid={fieldError !== null}>
          <Label>{t('evidence.transcript.revise.field')}</Label>
          <TextArea
            testID="transcript-revise-text"
            value={typed}
            onChangeText={(value) => {
              setTyped(value);
              setFieldError(null);
            }}
            numberOfLines={4}
            style={styles.textArea}
          />
          {fieldError === 'unchanged' ? <FieldError testID="transcript-revise-error-unchanged">{t('evidence.transcript.revise.unchanged')}</FieldError> : null}
          {fieldError === 'tooLong' ? <FieldError testID="transcript-revise-error-tooLong">{t('evidence.transcript.revise.tooLong', { max: REVISION_TEXT_MAX })}</FieldError> : null}
        </TextField>
        <TextField isRequired>
          <Label>{t('evidence.transcript.revise.note')}</Label>
          <TextArea testID="transcript-revise-note" value={note} onChangeText={setNote} maxLength={REVISION_NOTE_MAX} numberOfLines={2} style={styles.noteArea} />
          {noteOk ? null : <Description testID="transcript-revise-note-rule">{t('evidence.transcript.revise.noteRule', { min: REVISION_NOTE_MIN, max: REVISION_NOTE_MAX })}</Description>}
          <Description>{baseRevision === 0 ? t('evidence.transcript.revisions.baseOriginal') : t('evidence.transcript.revisions.base', { base: baseRevision })}</Description>
        </TextField>
        {refusalText !== null ? (
          <Alert status="danger" testID={`transcript-revise-refusal-${refusal ?? ''}`}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{refusalText}</Alert.Title>
              {refusal === 'CONFLICT' ? <Alert.Description>{t('evidence.transcript.revise.conflictHint')}</Alert.Description> : null}
            </Alert.Content>
          </Alert>
        ) : null}
        <View style={styles.footer}>
          <Button variant="primary" onPress={save} isDisabled={saving || !noteOk} accessibilityState={{ busy: saving, disabled: saving || !noteOk }} testID="transcript-revise-save">
            {saving ? <Spinner size="sm" /> : null}
            <Button.Label>{t('evidence.transcript.revise.save')}</Button.Label>
          </Button>
        </View>
      </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[2] },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[1] },
  textArea: { minHeight: 96 },
  noteArea: { minHeight: 56 },
  label: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.size * typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: palette.gray,
  },
  text: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
});
