/**
 * The transcript pane of a sealed item (blueprint row 92, M8-W3; UX spec flow 6; R-5; MB-07).
 *
 * - **States**: ASSEMBLED, PARTIAL (with how many parts of the audio have no text, and whether the
 *   backend was unreachable), UNAVAILABLE ("The transcript is not available yet."), DISABLED (by
 *   configuration: nothing is asked of the Core).
 * - **Speaker labels default to UNAVAILABLE**: the badge reads exactly "speaker labels unavailable"
 *   and every segment is shown unlabelled; a label is drawn only for a LABELLED document.
 * - **The sealed original is immutable.** Each segment shows the sealed text. A revision is shown
 *   BESIDE it, marked "derived, not part of the sealed transcript", and listed with its number, its
 *   author and its signature under the segments (operation 86, newest first). No revision is hidden.
 * - **Revise (G6)**: TRANSCRIPT_REVISE; "Checking your permissions..." until the role is known; a
 *   role without it sees no control. The form is `transcript-revise-sheet.tsx`.
 * - Every row keeps a constant 1 px border; a revised segment changes its colour only (E-15).
 *   Timestamps are media pts of the segments; nothing here is driven by a timer or animated (E-13).
 * - "Load again" after a failed read is rate-limited by the Core's clock (3 s, 6 s, 12 s; three tries).
 */
import { useQueryClient } from '@tanstack/react-query';
import { Button, Spinner } from 'heroui-native';
import { FileText, Lock, PencilLine, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { Permission, selectCan, selectOperator, useSim, useSimInstance } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { StatusChip } from '@/components/kit';
import { useMobileLive } from '@/runtime';
import type { ItemV2 } from './item-v2';
import { formatMediaTime, permissionGate, type GateState } from './sealed-playback';
import { TranscriptReadError, transcriptQueryKey, transcriptRevisionsQueryKey, useTranscript, useTranscriptFollowsRevision, useTranscriptRevisions } from './transcript';
import { currentRevisionNumber, deriveSegments, paneStateOf, type DerivedSegment, type TranscriptPaneState, type TranscriptRevision } from './transcript-model';
import { TranscriptReviseSheet } from './transcript-revise-sheet';

export interface TranscriptPaneProps {
  evidenceId: string;
  item: ItemV2;
  operatorNames: Readonly<Record<string, string>>;
}

const STATE_TONE = { ASSEMBLED: 'success', PARTIAL: 'warning', UNAVAILABLE: 'default', DISABLED: 'default' } as const satisfies Record<TranscriptPaneState, 'success' | 'warning' | 'default'>;
const RETRY_BASE_MS = 3_000;
const RETRY_MAX = 3;

export function TranscriptPane({ evidenceId, item, operatorNames }: TranscriptPaneProps) {
  const { t } = useTranslation();
  const live = useMobileLive();
  const sim = useSimInstance();
  const queryClient = useQueryClient();
  const operatorKnown = useSim((s) => selectOperator(s) !== null);
  const canRevise = useSim((s) => selectCan(s, Permission.TRANSCRIPT_REVISE));
  const gate = permissionGate({ operatorKnown, permitted: canRevise });
  const summary = item.transcript;
  const disabled = summary?.state === 'DISABLED';
  const transcript = useTranscript(evidenceId, !disabled);
  const revisions = useTranscriptRevisions(evidenceId, !disabled && transcript.data !== undefined);
  // A revision another operator appended moves the head of the slice item: both reads are fetched again (pass D10).
  useTranscriptFollowsRevision(evidenceId, summary?.revision ?? null);
  const [revising, setRevising] = useState<{ key: number; index: number } | null>(null);
  const [retry, setRetry] = useState({ attempts: 0, until: 0 });

  const document = transcript.data ?? null;
  const state = paneStateOf(summary, document !== null);
  const revisionList = revisions.data ?? [];
  const derivedSegments = document === null ? [] : deriveSegments(document, revisionList);
  const baseRevision = currentRevisionNumber(document, revisionList);
  const refusal = transcript.error instanceof TranscriptReadError ? transcript.error.refusal : transcript.isError ? 'FAILED' : null;
  const loading = !disabled && transcript.isPending && transcript.fetchStatus !== 'idle';
  const nameOf = (operatorId: string): string => operatorNames[operatorId] ?? operatorId;
  const revisingSegment = revising === null ? null : (derivedSegments.find((entry) => entry.segment.index === revising.index) ?? null);

  const coreNow = sim.store.getState().clock.now;
  const canRetry = retry.attempts < RETRY_MAX && coreNow >= retry.until;
  const reload = () => {
    const now = sim.store.getState().clock.now;
    if (retry.attempts >= RETRY_MAX || now < retry.until) return;
    setRetry({ attempts: retry.attempts + 1, until: now + RETRY_BASE_MS * 2 ** retry.attempts });
    void queryClient.invalidateQueries({ queryKey: transcriptQueryKey(evidenceId, live) });
    void queryClient.invalidateQueries({ queryKey: transcriptRevisionsQueryKey(evidenceId, live) });
  };

  return (
    <View style={styles.root} testID={`evidence-transcript-${state}`} accessibilityLabel={t('evidence.transcript.title')}>
      <View style={styles.head}>
        <FileText size={16} color={palette.gold} />
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.title}>
          {t('evidence.transcript.title')}
        </Text>
        <StatusChip size="sm" tone={STATE_TONE[state]} icon={null} label={t(`evidence.transcript.state.${state}`)} testID="evidence-transcript-state" />
        {document !== null ? (
          <>
            <StatusChip size="sm" tone="default" icon={Lock} label={t('evidence.transcript.inPackage')} testID="evidence-transcript-in-package" />
            <StatusChip
              size="sm"
              tone="default"
              icon={null}
              label={document.speakerState === 'LABELLED' ? t('evidence.transcript.speakersLabelled') : t('evidence.transcript.speakersUnavailable')}
              testID={`evidence-transcript-speakers-${document.speakerState}`}
            />
          </>
        ) : null}
      </View>

      {state === 'PARTIAL' && summary !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-transcript-partial">
          {summary.failedChunks > 0 ? `${t('evidence.transcript.failedChunks', { count: summary.failedChunks })} ` : ''}
          {summary.backendUnreachable ? t('evidence.transcript.backendUnreachable') : ''}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.inline} testID="evidence-transcript-loading">
          <Spinner size="sm" />
          <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
            {t('evidence.transcript.loading')}
          </Text>
        </View>
      ) : null}

      {refusal === 'NOT_READY' ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-transcript-not-ready">
          {t('evidence.transcript.notReady')}
        </Text>
      ) : null}
      {refusal === 'DENIED' || refusal === 'FAILED' ? (
        <View style={styles.failed} accessibilityRole="alert" testID={`evidence-transcript-failed-${refusal}`}>
          <Text maxFontSizeMultiplier={1.2} style={[styles.body, styles.failText]}>
            {t(refusal === 'DENIED' ? 'evidence.transcript.notPermitted' : 'evidence.transcript.failed')}
          </Text>
          {refusal === 'FAILED' ? (
            <Button size="sm" variant="outline" onPress={reload} isDisabled={!canRetry} testID="evidence-transcript-retry">
              <RotateCcw size={16} color={canRetry ? palette.gold : palette.gray} />
              <Button.Label>{retry.attempts >= RETRY_MAX ? t('common.errors.maxRetries') : t('evidence.transcript.retry')}</Button.Label>
            </Button>
          ) : null}
        </View>
      ) : null}

      {document !== null ? (
        <>
          <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-transcript-sealed-note">
            {t('evidence.transcript.sealedOriginal')}
          </Text>
          {derivedSegments.length === 0 ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-transcript-empty">
              {t('evidence.transcript.noSegments')}
            </Text>
          ) : (
            <View style={styles.list} testID="evidence-transcript-segments">
              {derivedSegments.map((entry) => (
                <SegmentRow
                  key={entry.segment.index}
                  entry={entry}
                  gate={gate}
                  authorName={entry.revised ? nameOf(entry.revised.authorId) : ''}
                  onRevise={() => setRevising((previous) => ({ key: (previous?.key ?? 0) + 1, index: entry.segment.index }))}
                />
              ))}
            </View>
          )}
          <RevisionList revisions={revisionList} failed={revisions.isError} nameOf={nameOf} />
        </>
      ) : null}

      {revising !== null && revisingSegment !== null ? (
        <TranscriptReviseSheet key={revising.key} evidenceId={evidenceId} segment={revisingSegment} baseRevision={baseRevision} isOpen onClose={() => setRevising(null)} />
      ) : null}
    </View>
  );
}

function SegmentRow({ entry, gate, authorName, onRevise }: { entry: DerivedSegment; gate: GateState; authorName: string; onRevise: () => void }) {
  const { t } = useTranslation();
  const { segment, revised } = entry;
  const start = formatMediaTime(segment.startMs);
  const end = formatMediaTime(segment.endMs);
  return (
    <View
      style={[styles.segment, revised ? styles.segmentRevised : null]}
      accessibilityLabel={t('evidence.transcript.segmentLabel', { index: segment.index, start, end })}
      testID={`evidence-transcript-segment-${segment.index}`}
    >
      <View style={styles.segmentHead}>
        <Text maxFontSizeMultiplier={1.2} style={styles.time}>
          {start}–{end}
        </Text>
        {segment.speaker !== null ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.speaker} testID={`evidence-transcript-speaker-${segment.index}`}>
            {segment.speaker}
          </Text>
        ) : null}
        <View style={styles.grow} />
        {gate === 'REFUSED' ? null : (
          <Button size="sm" variant="ghost" isDisabled={gate !== 'ALLOWED'} onPress={onRevise} testID={`evidence-transcript-revise-${segment.index}`}>
            <PencilLine size={14} color={gate === 'ALLOWED' ? palette.gold : palette.gray} />
            <Button.Label>{gate === 'CHECKING' ? t('evidence.playback.checking') : t('evidence.transcript.revise.action')}</Button.Label>
          </Button>
        )}
      </View>
      <Text maxFontSizeMultiplier={1.2} selectable style={styles.body} testID={`evidence-transcript-original-${segment.index}`}>
        {segment.text}
      </Text>
      {revised ? (
        <View style={styles.derived} testID={`evidence-transcript-derived-${segment.index}`}>
          <Text maxFontSizeMultiplier={1.2} style={styles.derivedLabel}>
            {t('evidence.transcript.derived', { number: revised.number })} · {t('evidence.transcript.revisions.author', { author: authorName })}
          </Text>
          <Text maxFontSizeMultiplier={1.2} selectable style={styles.body} testID={`evidence-transcript-derived-text-${segment.index}`}>
            {revised.text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function RevisionList({ revisions, failed, nameOf }: { revisions: readonly TranscriptRevision[]; failed: boolean; nameOf: (operatorId: string) => string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.revisions} testID="evidence-transcript-revisions">
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.title}>
        {t('evidence.transcript.revisions.title')}
      </Text>
      {failed ? (
        <Text maxFontSizeMultiplier={1.2} style={[styles.caption, styles.failText]} accessibilityRole="alert" testID="evidence-transcript-revisions-failed">
          {t('evidence.transcript.revisions.loadFailed')}
        </Text>
      ) : revisions.length === 0 ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-transcript-revisions-none">
          {t('evidence.transcript.revisions.none')}
        </Text>
      ) : (
        revisions.map((revision) => (
          <View key={revision.revisionId} style={styles.segment} testID={`evidence-transcript-revision-${revision.number}`}>
            <Text maxFontSizeMultiplier={1.2} style={styles.strong}>
              {t('evidence.transcript.revisions.entry', { number: revision.number })} {t('evidence.transcript.revisions.author', { author: nameOf(revision.authorId) })}
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
              {revision.createdAt !== null ? `${formatDate(revision.createdAt, DATE_PATTERNS.dateTime)} · ` : ''}
              {revision.baseRevision === 0 ? t('evidence.transcript.revisions.baseOriginal') : t('evidence.transcript.revisions.base', { base: revision.baseRevision })}
              {' · '}
              {revision.simulated ? t('evidence.transcript.revisions.simulated') : t('evidence.transcript.revisions.signed', { key: revision.signedBy })}
            </Text>
            {revision.changes.map((change, index) => (
              <Text key={`${change.segmentIndex}-${index}`} maxFontSizeMultiplier={1.2} style={styles.caption}>
                <Text style={styles.strong}>{t('evidence.transcript.revisions.change', { index: change.segmentIndex })}</Text>: {change.to}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  failed: { gap: spacing[1] },
  list: { gap: spacing[0] + 2 },
  revisions: { gap: spacing[0] + 2 },
  grow: { flex: 1 },
  segment: {
    gap: 4,
    padding: spacing[1] + 2,
    borderRadius: radius.px.lg,
    backgroundColor: derived.surfaceSecondary,
    // E-15: the border is always 1 px; a revised segment changes its colour only.
    borderWidth: 1,
    borderColor: derived.separator,
  },
  segmentRevised: { borderColor: statusText.sealed },
  segmentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  derived: { gap: 2, padding: spacing[1], borderRadius: radius.px.lg, borderWidth: 1, borderColor: statusText.sealed, borderStyle: 'dashed' },
  derivedLabel: { fontFamily: fontFamily.native.semibold, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: statusText.sealed },
  title: { fontFamily: fontFamily.native.semibold, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  time: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.gray, fontVariant: ['tabular-nums'] },
  speaker: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gold },
  strong: { fontFamily: fontFamily.native.semibold, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  failText: { color: statusText.danger },
});
