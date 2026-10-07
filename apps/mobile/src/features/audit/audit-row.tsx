/**
 * One audit list row (04_mobile_specs §4.16 "rows: time (mono), event, actor, category Chip,
 * chain-link dot"; brief: short hash column). MB 8 activity-row language on a pressable kit `Card`.
 *
 * - The time is the entry's simulator instant at UTC+07:00 (WIB): `HH:mm:ss` with the day below.
 * - The event label comes from i18n by the row's code; the simulator's English `message` is never
 *   shown (MA-21).
 * - A live row (written while the view is open with Live on) enters with M-C-07: FadeInDown 240 ms
 *   rising 6 px plus a gold highlight 0.18 → 0 over 1,500 ms. Reduced: no rise, the highlight still
 *   fades (M-C-07). A recycled FlashList cell plays it once per entry.
 * - The broken entry (AUDIT_TAMPER) holds a slow red `glowBreath` until the break is acknowledged
 *   (03M M-C-21 / P7), then a steady red edge. On tablets the selected row carries glow e2.
 * - Post-review fix FXR-M (W93-2, the CF2-B RF-T-1 cause, D235): a selection change is a colour change only.
 *   The card keeps a 1 dp border in every state (`ROW_CARD_BORDER`; selected gold, broken red) and the
 *   selection glow is the always-mounted `SelectionGlow`, the row's last child. Before, the kit Card went from
 *   no border to a 1 dp border and back, and a `GlowLayer` was mounted and removed with the selection: the
 *   shape that left deselected Evidence and Sessions rows drawn as empty cards on the tablet.
 */
import { Card, PressableFeedback } from 'heroui-native';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import type { AuditRow } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, statusText, typography } from '@dems/shared/tokens';
import { ROW_CARD_BORDER, SelectionGlow } from '@/components/composed/selection-glow';
import { StatusChip } from '@/components/kit';
import { GlowLayer, SPEC_LITERALS, durationMs, listInsert, useMotionSettings } from '@/motion';
import { shortHash, type ChainLink } from './audit-model';
import { severityDotColor } from './audit-tones';

/** Peak opacity of the newest-row highlight (M-C-07). */
export const FRESH_HIGHLIGHT_OPACITY = 0.18;

/** Entries whose live entrance already played (a recycled cell must not replay it). */
const playedEntrances = new Set<string>();

export function resetPlayedEntrancesForTests(): void {
  playedEntrances.clear();
}

export interface AuditRowProps {
  row: AuditRow;
  label: string;
  actor: string;
  secondary: string;
  chain: ChainLink;
  /** The broken row breathes until acknowledged. */
  breathing: boolean;
  selected: boolean;
  /** Written after the view opened, with Live on. */
  fresh: boolean;
  onPress: (seq: number) => void;
}

function AuditRowImpl({ row, label, actor, secondary, chain, breathing, selected, fresh, onPress }: AuditRowProps) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const time = formatDate(row.at, DATE_PATTERNS.time);
  const day = formatDate(row.at, 'D MMM');
  const broken = chain === 'BROKEN';
  const playEntrance = fresh && !playedEntrances.has(row.id);
  const chainLabel = broken ? t('securityAudit.audit.chainBroken') : t('securityAudit.audit.chainLinked');

  const body = (
    <View style={styles.wrap}>
      {broken ? (
        <GlowLayer level={breathing ? 2 : 1} tone="danger" breathe={breathing} radius={radius.px.xl} testID={`audit-row-glow-${row.seq}`} />
      ) : null}
      <PressableFeedback
        testID={`audit-row-${row.seq}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={t('features.audit.list.rowLabel', { seq: row.seq, event: label, actor, time: `${day} ${time}`, chain: chainLabel })}
        onPress={() => onPress(row.seq)}
        style={styles.pressable}
      >
        <Card
          className="rounded-xl"
          style={[styles.card, selected ? styles.cardSelected : null, broken ? styles.cardBroken : null]}
          testID={`audit-row-card-${row.seq}`}
        >
          {playEntrance ? <FreshHighlight id={row.id} /> : null}
          <View style={styles.row}>
            <View style={styles.timeCol}>
              <Text maxFontSizeMultiplier={1.2} style={styles.time}>
                {time}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.day}>
                {day}
              </Text>
            </View>
            <View style={styles.body}>
              <View style={styles.titleLine}>
                <View style={[styles.severityDot, { backgroundColor: severityDotColor(row.severity) }]} />
                <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.event} testID={`audit-row-event-${row.seq}`}>
                  {label}
                </Text>
              </View>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.actor} testID={`audit-row-actor-${row.seq}`}>
                {actor}
              </Text>
              {secondary ? (
                <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.secondary} testID={`audit-row-secondary-${row.seq}`}>
                  {secondary}
                </Text>
              ) : null}
            </View>
            <View style={styles.trailing}>
              <StatusChip size="sm" tone="default" icon={null} label={t(`common.auditCategory.${row.category}`)} testID={`audit-row-category-${row.seq}`} />
              <View style={styles.hashLine} accessibilityLabel={t('features.audit.list.hashLabel', { hash: shortHash(row.hash) })}>
                <View
                  style={[styles.chainDot, broken ? styles.chainDotBroken : null]}
                  testID={`audit-row-chain-${row.seq}-${chain}`}
                />
                <Text maxFontSizeMultiplier={1.2} style={[styles.hash, broken ? styles.hashBroken : null]}>
                  {shortHash(row.hash)}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </PressableFeedback>
      {/* W93-2: always mounted, last; React sets its opacity (the broken row keeps its red glow instead). */}
      <SelectionGlow selected={selected && !broken} radius={radius.px.xl} testID={`audit-row-selected-${row.seq}`} />
    </View>
  );

  if (!playEntrance) return body;
  // Keyed by entry, so a recycled cell rebinding to this entry mounts (and enters) once.
  return (
    <Animated.View key={`fresh-${row.id}`} entering={listInsert(m)}>
      {body}
    </Animated.View>
  );
}

/** Rows re-render only when their entry (kept by reference by the simulator) or their props change. */
export const AuditRowItem = memo(AuditRowImpl);

function FreshHighlight({ id }: { id: string }) {
  const m = useMotionSettings();
  const opacity = useSharedValue(FRESH_HIGHLIGHT_OPACITY);
  useEffect(() => {
    playedEntrances.add(id);
    // The highlight fades under reduced motion too (M-C-07); the duration is passed explicitly.
    opacity.set(withTiming(0, { duration: durationMs(SPEC_LITERALS.highlightFadeMs, m), easing: Easing.out(Easing.quad) }));
  }, [id, m, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.highlight, style]} testID={`audit-row-fresh-${id}`} />;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing[1], borderRadius: radius.px.xl },
  pressable: { borderRadius: radius.px.xl },
  // W93-2 (FXR-M; the RF-T-1 cause, CF2-B D235): a 1 dp border in EVERY state, only its colour follows the
  // selection or the break (`ROW_CARD_BORDER`), so the kit Card's insets, layout and clip never change.
  card: { paddingVertical: spacing[1], paddingHorizontal: spacing[1] + 2, overflow: 'hidden', ...ROW_CARD_BORDER },
  cardSelected: { borderColor: palette.gold },
  cardBroken: { borderColor: palette.danger },
  highlight: { backgroundColor: palette.gold, borderRadius: radius.px.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2 },
  timeCol: { width: 64 },
  time: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.foreground, fontVariant: ['tabular-nums'] },
  day: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  body: { flex: 1, minWidth: 0, gap: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[0] + 2 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  event: { flex: 1, fontFamily: fontFamily.native.semibold, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  actor: { fontFamily: fontFamily.native.medium, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: derived.foreground2 },
  secondary: { fontFamily: fontFamily.native.mono, fontSize: 11, lineHeight: 16, color: palette.gray },
  trailing: { alignItems: 'flex-end', gap: spacing[0] + 2 },
  hashLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[0] },
  chainDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.success },
  chainDotBroken: { backgroundColor: palette.danger },
  hash: { fontFamily: fontFamily.native.mono, fontSize: 11, lineHeight: 16, color: palette.gray, fontVariant: ['tabular-nums'] },
  hashBroken: { color: statusText.danger },
});
