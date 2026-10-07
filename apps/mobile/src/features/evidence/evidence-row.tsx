/**
 * One Evidence list row (04_mobile_specs §4.10 E4, MB 5): thumbnail, ID (mono), date and time,
 * subject, subject-type chip, duration (mono), status chip and the kebab `Menu` (View, Verify,
 * Export, Archive; Archive RBAC-gated). The row is a pressable kit `Card`; on tablets the selected
 * row carries glow e2 (§4.10 "Tablet").
 *
 * CF2-B (RF-T-1): a selection change is a colour change only. The glow is `SelectionGlow`, always
 * mounted after the pressable (nothing is mounted or removed inside the row), and the card keeps its
 * 1 dp border in both states (`ROW_CARD_BORDER`), so its border insets, layout and clip never change.
 */
import { Image } from 'expo-image';
import { Button, Card, Menu, PressableFeedback } from 'heroui-native';
import { EllipsisVertical } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { DATE_PATTERNS, formatDate, formatDuration } from '@dems/shared/realtime';
import type { EvidenceItem } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { EvidenceStatusChip, EvidenceSubjectChip } from './evidence-chips';
import { posterForEvidence } from './evidence-media';
import { isArchivable, isExportable, type EvidenceDensity } from './evidence-model';
import { MenuItemText } from './menu-item-text';
import { ROW_CARD_BORDER, SelectionGlow } from './selection-glow';

export type EvidenceRowAction = 'view' | 'verify' | 'export' | 'archive';

export interface EvidenceRowProps {
  item: EvidenceItem;
  selected: boolean;
  density: EvidenceDensity;
  canArchive: boolean;
  onPress: (id: string) => void;
  onAction: (id: string, action: EvidenceRowAction) => void;
}

function EvidenceRowImpl({ item, selected, density, canArchive, onPress, onAction }: EvidenceRowProps) {
  const { t } = useTranslation();
  const compact = density === 'compact';
  const date = formatDate(item.recordedAt, DATE_PATTERNS.dateTimeMinutes);
  const duration = formatDuration(item.durationMs);
  const status = t(`common.evidenceStatus.${item.status}`);

  return (
    <View style={styles.wrap}>
      <PressableFeedback
        testID={`evidence-row-${item.id}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={t('features.evidence.list.rowLabel', { id: item.id, subject: item.subjectName, status, date, duration })}
        onPress={() => onPress(item.id)}
        style={styles.pressable}
      >
        <Card className="rounded-xl" style={[styles.card, selected ? styles.cardSelected : null]} testID={`evidence-row-card-${item.id}`}>
          <View style={[styles.row, compact ? styles.rowCompact : null]}>
            {compact ? null : (
              <Image
                source={posterForEvidence(item.id)}
                style={styles.thumb}
                contentFit="cover"
                accessible={false}
                recyclingKey={item.id}
                transition={0}
              />
            )}
            <View style={styles.body}>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.id}>
                {item.id}
              </Text>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.meta}>
                {date}
              </Text>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.subject}>
                {item.subjectName}
              </Text>
              <View style={styles.chips}>
                <EvidenceSubjectChip subjectType={item.subjectType} />
                <Text maxFontSizeMultiplier={1.2} style={styles.duration}>
                  {duration}
                </Text>
              </View>
            </View>
            <View style={styles.trailing}>
              <EvidenceStatusChip status={item.status} testID={`evidence-row-status-${item.id}`} />
              <RowMenu item={item} canArchive={canArchive} onAction={onAction} />
            </View>
          </View>
        </Card>
      </PressableFeedback>
      <SelectionGlow selected={selected} radius={radius.px.xl} testID={`evidence-row-glow-${item.id}`} />
    </View>
  );
}

/** Rows re-render only when their item (kept by reference by the simulator) or their props change. */
export const EvidenceRow = memo(EvidenceRowImpl);

function RowMenu({ item, canArchive, onAction }: { item: EvidenceItem; canArchive: boolean; onAction: EvidenceRowProps['onAction'] }) {
  const { t } = useTranslation();
  const exportable = isExportable(item.status);
  const archivable = canArchive && isArchivable(item.status);
  return (
    <Menu>
      <Menu.Trigger asChild>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          testID={`evidence-row-menu-${item.id}`}
          accessibilityLabel={t('features.evidence.list.rowActions', { id: item.id })}
        >
          <EllipsisVertical size={18} color={palette.gray} />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Overlay />
        <Menu.Content presentation="popover" width={200} placement="bottom" align="end">
          <Menu.Item testID={`evidence-row-view-${item.id}`} onPress={() => onAction(item.id, 'view')}>
            <Menu.ItemTitle>{t('features.evidence.actions.view')}</Menu.ItemTitle>
          </Menu.Item>
          <Menu.Item testID={`evidence-row-verify-${item.id}`} onPress={() => onAction(item.id, 'verify')}>
            <Menu.ItemTitle>{t('features.evidence.actions.verify')}</Menu.ItemTitle>
          </Menu.Item>
          <Menu.Item
            testID={`evidence-row-export-${item.id}`}
            isDisabled={!exportable}
            onPress={() => onAction(item.id, 'export')}
          >
            {/* CF-M2 (R-T-1): title and reason stacked, so a disabled item keeps its visible title. */}
            <MenuItemText
              title={t('features.evidence.actions.export')}
              description={exportable ? null : t('features.evidence.actions.exportDisabled')}
              testID={`evidence-row-export-text-${item.id}`}
            />
          </Menu.Item>
          <Menu.Item
            testID={`evidence-row-archive-${item.id}`}
            isDisabled={!archivable}
            variant="danger"
            onPress={() => onAction(item.id, 'archive')}
          >
            <MenuItemText
              title={t('features.evidence.actions.archive')}
              description={canArchive ? null : t('features.evidence.actions.archiveDisabled')}
              testID={`evidence-row-archive-text-${item.id}`}
            />
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing[1] + 2, borderRadius: radius.px.xl },
  pressable: { borderRadius: radius.px.xl },
  // CF2-B (RF-T-1): the 1 dp border is there in both states and only its colour follows the selection,
  // so a selection change never changes the card's border insets, layout or clip (see `ROW_CARD_BORDER`).
  card: { padding: spacing[1] + 2, ...ROW_CARD_BORDER },
  cardSelected: { borderColor: palette.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowCompact: { gap: spacing[1] },
  thumb: { width: 96, height: 76, borderRadius: radius.px.lg, backgroundColor: derived.surfaceSecondary },
  body: { flex: 1, minWidth: 0, gap: 2 },
  id: { fontFamily: fontFamily.native.monoMedium, fontSize: 13, lineHeight: 18, color: palette.foreground },
  meta: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  subject: { fontFamily: fontFamily.native.medium, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: derived.foreground2 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: 2 },
  duration: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.foreground, fontVariant: ['tabular-nums'] },
  trailing: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', gap: spacing[1] },
});
