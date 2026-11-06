/**
 * WHAT THE OPERATOR ADDED DURING THE RECORDING, ON THE ITEM (fix wave J round two; findings JT-11 / JA2-08;
 * contract_wave_j.md "J2-S 1"; the web console's block of the same name).
 *
 * The markers and the notes the item carries (`EvidenceItem.markers` / `notes`, read BY NAME) appeared on no
 * tab of the item. A marker's time is the control that takes the playback there (`playback-link.ts`). A note
 * with `origin: 'SESSION_FORM'` is the "Notes (Optional)" field of the session form: it is titled as that,
 * without a time (its `at` is the creation of the session, not a moment of the recording).
 *
 * Empty lists draw nothing. A SNAPSHOT has no member and no picture - it is a mark on the open session's
 * timeline only - so nothing here offers "snapshots".
 */
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatClock } from '@dems/shared/realtime';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { requestPlaybackSeek } from './playback-link';

/** `SESSION_FORM_NOTE_ORIGIN` of `@dems/shared/sim`, read by name (an older Core never sends the member). */
const FORM_ORIGIN = 'SESSION_FORM';

interface Marker {
  readonly id: string;
  readonly at: number;
  readonly index: number;
  readonly label: string;
}
interface Note {
  readonly id: string;
  readonly at: number;
  readonly text: string;
  readonly origin?: string;
}

function listOf<T>(value: unknown, isEntry: (entry: Record<string, unknown>) => boolean): readonly T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is T => typeof entry === 'object' && entry !== null && isEntry(entry as Record<string, unknown>));
}

/** The item's markers and notes as it states them; anything that is not one is left out. Pure. */
export function annotationsOf(item: unknown): { readonly markers: readonly Marker[]; readonly notes: readonly Note[] } {
  const record = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
  return {
    markers: listOf<Marker>(record['markers'], (m) => typeof m['id'] === 'string' && typeof m['at'] === 'number' && typeof m['index'] === 'number' && typeof m['label'] === 'string'),
    notes: listOf<Note>(record['notes'], (n) => typeof n['id'] === 'string' && typeof n['at'] === 'number' && typeof n['text'] === 'string'),
  };
}

export function SessionAnnotations({ item, recordedAt }: { item: unknown; recordedAt: number }) {
  const { t } = useTranslation();
  const { markers, notes } = annotationsOf(item);
  const evidenceId = typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id : '';
  if (markers.length === 0 && notes.length === 0) return null;
  return (
    <View style={styles.root} testID="evidence-annotations" accessibilityLabel={t('features.evidence.annotations.title')}>
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.title}>
        {t('features.evidence.annotations.title')}
      </Text>
      {markers.map((marker) => {
        const time = formatClock(marker.at);
        const label = marker.label === '' ? t('features.evidence.annotations.noLabel') : marker.label;
        return (
          <View key={marker.id} style={styles.row} testID={`evidence-marker-${marker.index}`}>
            <Pressable
              onPress={() => void requestPlaybackSeek(evidenceId, Math.max(0, marker.at - recordedAt))}
              accessibilityRole="button"
              accessibilityLabel={t('features.evidence.annotations.markerSeek', { index: marker.index, time })}
              hitSlop={8}
              testID={`evidence-marker-${marker.index}-seek`}
            >
              <Text maxFontSizeMultiplier={1.2} style={styles.time}>
                {time}
              </Text>
            </Pressable>
            <Text maxFontSizeMultiplier={1.2} selectable style={styles.text}>
              {t('features.evidence.annotations.marker', { index: marker.index })}: {label}
            </Text>
          </View>
        );
      })}
      {notes.map((note) => {
        const fromForm = note.origin === FORM_ORIGIN;
        return (
          <View key={note.id} style={styles.row} testID={fromForm ? 'evidence-note-form' : `evidence-note-${note.id}`}>
            {fromForm ? null : (
              <Text maxFontSizeMultiplier={1.2} style={styles.timePlain}>
                {formatClock(note.at)}
              </Text>
            )}
            <Text maxFontSizeMultiplier={1.2} selectable style={styles.text}>
              {t(fromForm ? 'features.evidence.annotations.formNote' : 'features.evidence.annotations.note')}: {note.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[1], marginTop: spacing[2] },
  title: { fontFamily: fontFamily.native.semibold, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1] },
  time: { fontFamily: fontFamily.native.mono, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gold, textDecorationLine: 'underline' },
  timePlain: { fontFamily: fontFamily.native.mono, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  text: { flex: 1, fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.foreground },
});
