/**
 * Building blocks of the Settings screens (04_mobile_specs §4.15; kit only, D6): the MB 10 group
 * card (`ListGroup` with its title), a navigation row (icon, label, chevron), a `Switch` row and a
 * segmented choice (`Tabs`, the pattern the monitor's settings sheet uses for its meter size).
 * Every toggle and choice plays the §7.6 selection haptic through the motion kit (MA-20).
 */
import { Description, Label, ListGroup, Separator, Switch, Tabs } from 'heroui-native';
import {
  Bell,
  ChevronRight,
  Cog,
  Database,
  Globe,
  Info,
  MonitorCog,
  Settings2,
  ShieldHalf,
  type LucideIcon,
} from 'lucide-react-native';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { derived, fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { enterRise, triggerHaptic, useMotionSettings } from '@/motion';
import type { SettingsIcon } from './settings-model';

export const SETTINGS_ICONS: Readonly<Record<SettingsIcon, LucideIcon>> = {
  preferences: Settings2,
  notifications: Bell,
  security: ShieldHalf,
  devices: MonitorCog,
  storage: Database,
  network: Globe,
  maintenance: Cog,
  about: Info,
};

const ICON = 22;

// ── Group card ─────────────────────────────────────────────────────────────────────────────

export interface GroupCardProps {
  title: string;
  /** Stagger index of the §7.3 Settings enter ("list sections stagger"). */
  index: number;
  testID: string;
  /** Rows; a hairline separator is drawn between them. */
  children: ReactNode;
  /** Muted line under the rows (for example "Saved on this console only"). */
  footnote?: string;
}

/** MB 10 card: the group title inside a rounded `ListGroup`, rows separated by hairlines. */
export function GroupCard({ title, index, testID, children, footnote }: GroupCardProps) {
  const settings = useMotionSettings();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Animated.View entering={enterRise(index, settings)}>
      <ListGroup variant="default" className="rounded-xl" testID={testID} style={styles.group}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.groupTitle}>
          {title}
        </Text>
        {rows.map((row, rowIndex) => (
          <Fragment key={row.key ?? rowIndex}>
            {rowIndex > 0 ? <Separator style={styles.separator} /> : null}
            {row}
          </Fragment>
        ))}
        {footnote ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.footnote}>
            {footnote}
          </Text>
        ) : null}
      </ListGroup>
    </Animated.View>
  );
}

// ── Navigation row ─────────────────────────────────────────────────────────────────────────

export interface NavRowProps {
  testID: string;
  icon?: SettingsIcon;
  /** Custom prefix (the account avatar). */
  prefix?: ReactNode;
  label: string;
  description?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Tablet list | pane: the open section. */
  selected?: boolean;
  onPress: () => void;
}

export function NavRow({ testID, icon, prefix, label, description, accessibilityLabel, accessibilityHint, selected = false, onPress }: NavRowProps) {
  const Icon = icon ? SETTINGS_ICONS[icon] : null;
  return (
    <ListGroup.Item
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={[styles.navRow, selected ? styles.navRowSelected : null]}
    >
      <ListGroup.ItemPrefix>{prefix ?? (Icon ? <Icon size={ICON} color={palette.gold} /> : null)}</ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.navLabel, selected ? styles.navLabelSelected : null]}>
          {label}
        </Text>
        {description ? (
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.navDescription}>
            {description}
          </Text>
        ) : null}
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <ChevronRight size={20} color={selected ? palette.gold : palette.gray} />
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

// ── Switch row ─────────────────────────────────────────────────────────────────────────────

export interface SwitchRowProps {
  testID: string;
  label: string;
  description?: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (on: boolean) => void;
}

export function SwitchRow({ testID, label, description, isSelected, isDisabled = false, onChange }: SwitchRowProps) {
  return (
    <View style={styles.controlRow}>
      <View style={styles.controlText}>
        <Label isDisabled={isDisabled}>{label}</Label>
        {description ? <Description>{description}</Description> : null}
      </View>
      <Switch
        testID={testID}
        isSelected={isSelected}
        isDisabled={isDisabled}
        accessibilityLabel={label}
        onSelectedChange={(on) => {
          triggerHaptic('switchToggle');
          onChange(on);
        }}
      />
    </View>
  );
}

// ── Segmented choice ───────────────────────────────────────────────────────────────────────

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  isDisabled?: boolean;
}

export interface SegmentRowProps<T extends string> {
  testID: string;
  label: string;
  description?: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
}

export function SegmentRow<T extends string>({ testID, label, description, value, options, onChange }: SegmentRowProps<T>) {
  return (
    <View style={styles.segmentBlock}>
      <Label>{label}</Label>
      <Tabs
        value={value}
        onValueChange={(next) => {
          const option = options.find((candidate) => candidate.value === next);
          if (!option || option.isDisabled || option.value === value) return;
          triggerHaptic('segmentSelect');
          onChange(option.value);
        }}
        variant="primary"
      >
        <Tabs.List>
          <Tabs.Indicator />
          {options.map((option) => (
            <Tabs.Trigger key={option.value} value={option.value} isDisabled={option.isDisabled} testID={`${testID}-${option.value}`}>
              <Tabs.Label>{option.label}</Tabs.Label>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>
      {description ? <Description>{description}</Description> : null}
    </View>
  );
}

// ── Section body ───────────────────────────────────────────────────────────────────────────

/** A section's vertical stack of group cards. */
export function SectionStack({ children, testID }: { children: ReactNode; testID: string }) {
  return (
    <View style={styles.stack} testID={testID}>
      {children}
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  muted: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
  body: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: derived.foreground2,
  },
  strong: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  block: { gap: spacing[2], paddingVertical: spacing[1] },
});

const styles = StyleSheet.create({
  group: { paddingVertical: spacing[2], gap: spacing[0] },
  groupTitle: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: palette.foreground,
    paddingHorizontal: spacing[3],
    // Device finding: the kit surface keeps its own vertical padding, so the title sat 5 dp under
    // the card edge; MB 10 leaves about 12 dp.
    paddingTop: spacing[2],
    paddingBottom: spacing[0],
  },
  separator: { marginLeft: spacing[3] },
  footnote: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[1],
  },
  navRow: { minHeight: 52, paddingHorizontal: spacing[3], gap: spacing[3] },
  navRowSelected: { backgroundColor: derived.surfaceTertiary },
  navLabel: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size + 1,
    lineHeight: typography.body.lineHeight,
    color: palette.foreground,
  },
  navLabelSelected: { color: palette.gold },
  navDescription: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.gray,
  },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 56, paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
  controlText: { flex: 1, gap: 2 },
  segmentBlock: { gap: spacing[1], paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  stack: { gap: spacing[3] },
});
