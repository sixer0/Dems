/**
 * S5 action tiles (04_mobile_specs §4.5 S5; MB 4 (948–1185, 403–455): Snapshot, Bookmark, Audio
 * Monitor, Settings), as kit `Button variant="tertiary"` with an icon over the label.
 *
 * - Snapshot → `snapshot()` (M-C-18 runs on the feed).
 * - Bookmark = Add Marker → a kit `Popover` with an optional label → `addMarker(label)` (M-C-17).
 *   Phones use the Popover's bottom-sheet presentation, so the keyboard never covers the field.
 * - Audio Monitor, Settings → the screen's BottomSheets (UI only).
 *
 * Snapshot and Bookmark are session actions: they are disabled while the Core link is offline
 * (S7 "session actions become read-only"). The layout is a row of four (MB 4) or a 2x2 grid.
 */
import {
  Button,
  Description,
  Input,
  Label,
  Popover,
  TextField,
  useBottomSheetAwareHandlers,
} from 'heroui-native';
import { Bookmark, Camera, Mic, Settings, type LucideIcon } from 'lucide-react-native';
import { forwardRef, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type View as RNView } from 'react-native';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { triggerHaptic } from '@/motion';
import { MARKER_LABEL_MAX, markerLabel } from './session-live.math';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';

export interface ActionTilesProps {
  /** `row`: four across (MB 4); `grid`: 2x2 (landscape phone, tablet actions column). */
  layout: 'row' | 'grid';
  readOnly: boolean;
  /** Phones present the marker field as a bottom sheet; tablets as a popover over the tile. */
  markerPresentation: 'popover' | 'bottom-sheet';
  onSnapshot: () => void;
  /** Returns whether the marker was added. */
  onAddMarker: (label: string | undefined) => boolean;
  onOpenAudioMonitor: () => void;
  onOpenSettings: () => void;
  /** The Bookmark tile, measured by the screen for the M-C-17 marker flight. */
  bookmarkRef?: Ref<RNView>;
}

export function ActionTiles({
  layout,
  readOnly,
  markerPresentation,
  onSnapshot,
  onAddMarker,
  onOpenAudioMonitor,
  onOpenSettings,
  bookmarkRef,
}: ActionTilesProps) {
  const { t } = useTranslation();
  const tileStyle = layout === 'grid' ? styles.gridTile : styles.rowTile;
  return (
    <View testID="monitor-actions" accessibilityLabel={t('features.session-live.tiles.label')} style={layout === 'grid' ? styles.grid : styles.row}>
      <Tile
        testID="monitor-action-snapshot"
        icon={Camera}
        label={t('session.actions.snapshot.title')}
        hint={t('features.session-live.tiles.snapshotHint')}
        disabled={readOnly}
        onPress={onSnapshot}
        style={tileStyle}
      />
      <MarkerTile
        presentation={markerPresentation}
        disabled={readOnly}
        onAddMarker={onAddMarker}
        style={tileStyle}
        tileRef={bookmarkRef}
      />
      <Tile
        testID="monitor-action-audio"
        icon={Mic}
        label={t('features.session-live.tiles.audioMonitor')}
        hint={t('features.session-live.tiles.audioMonitorHint')}
        onPress={onOpenAudioMonitor}
        style={tileStyle}
      />
      <Tile
        testID="monitor-action-settings"
        icon={Settings}
        label={t('features.session-live.tiles.settings')}
        hint={t('features.session-live.tiles.settingsHint')}
        onPress={onOpenSettings}
        style={tileStyle}
      />
    </View>
  );
}

interface TileProps {
  testID: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  disabled?: boolean;
  onPress?: () => void;
  style: object;
}

/** One MB 4 tile: a tertiary kit Button, gold icon over a one-line label. */
const Tile = forwardRef<RNView, TileProps>(function Tile({ testID, icon: Icon, label, hint, disabled = false, onPress, style, ...rest }, ref) {
  return (
    <Button
      ref={ref}
      testID={testID}
      variant="tertiary"
      isDisabled={disabled}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={[styles.tile, style]}
      {...rest}
    >
      <Icon size={22} color={disabled ? palette.gray : palette.gold} />
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.tileLabel}>
        {label}
      </Text>
    </Button>
  );
});

interface MarkerTileProps {
  presentation: 'popover' | 'bottom-sheet';
  disabled: boolean;
  onAddMarker: (label: string | undefined) => boolean;
  style: object;
  tileRef?: Ref<RNView>;
}

/** Bookmark = Add Marker (S5): the tile opens a Popover with an optional label (≤ 80 characters). */
function MarkerTile({ presentation, disabled, onAddMarker, style, tileRef }: MarkerTileProps) {
  const { t } = useTranslation();
  const [requested, setRequested] = useState(false);
  const [label, setLabel] = useState('');
  // Mounted on demand and opened once its content is mounted, so the kit animates it in (F-79-2).
  // The anchored popover mounts its content only when open, so it opens one frame later instead.
  const presence = useSheetPresence(requested && !disabled, { awaitContent: presentation === 'bottom-sheet' });

  const submit = () => {
    triggerHaptic('primaryPress');
    if (onAddMarker(markerLabel(label))) {
      setLabel('');
      setRequested(false);
    }
  };

  return (
    <View ref={tileRef} collapsable={false} style={style}>
      <Popover isOpen={presence.open} onOpenChange={setRequested} presentation={presentation}>
        <Popover.Trigger asChild>
          <Tile
            testID="monitor-action-bookmark"
            icon={Bookmark}
            label={t('features.session-live.tiles.bookmark')}
            hint={t('features.session-live.tiles.bookmarkHint')}
            disabled={disabled}
            style={styles.fill}
          />
        </Popover.Trigger>
        {/* Mounted only while open or closing: no idle bottom sheet behind the tile. */}
        {presence.mounted ? (
          <Popover.Portal>
            <Popover.Overlay />
            {presentation === 'bottom-sheet' ? (
              <Popover.Content presentation="bottom-sheet">
                <SheetContentSignal onChange={presence.setContentMounted}>
                  <MarkerForm label={label} onChange={setLabel} onSubmit={submit} />
                </SheetContentSignal>
              </Popover.Content>
            ) : (
              <Popover.Content presentation="popover" placement="top" width={320} className="rounded-xl">
                <MarkerForm label={label} onChange={setLabel} onSubmit={submit} />
              </Popover.Content>
            )}
          </Popover.Portal>
        ) : null}
      </Popover>
    </View>
  );
}

interface MarkerFormProps {
  label: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function MarkerForm({ label, onChange, onSubmit }: MarkerFormProps) {
  const { t } = useTranslation();
  // No-ops outside a bottom sheet (the popover presentation).
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();
  return (
    <View style={styles.form} testID="monitor-marker-popover">
      <Popover.Title>{t('session.actions.addMarker.title')}</Popover.Title>
      <TextField>
        <Label>{t('session.actions.addMarker.field')}</Label>
        <Input
          testID="monitor-marker-input"
          value={label}
          onChangeText={onChange}
          placeholder={t('session.actions.addMarker.placeholder')}
          maxLength={MARKER_LABEL_MAX}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <Description>{t('features.session-live.marker.optional')}</Description>
      </TextField>
      <Button testID="monitor-marker-submit" variant="primary" onPress={onSubmit}>
        <Button.Label>{t('session.actions.addMarker.submit')}</Button.Label>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowTile: { flex: 1, minWidth: 0 },
  gridTile: { flexBasis: '47%', flexGrow: 1 },
  // Not `flex: 1`: inside the 2x2 grid the wrapper's height is not definite, so a flex basis of 0
  // collapsed the Bookmark tile to nothing on dems_tablet. The tile keeps its own 76 dp height.
  fill: { width: '100%' },
  tile: {
    height: 76,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  tileLabel: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.foreground,
    textAlign: 'center',
  },
  form: { gap: 12, padding: 4 },
});
