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
 *
 * Live mode (backend task, row W68; [CS:§8.1] LB-1, §8.6 S2-1): the Snapshot tile and the marker's
 * Add button each send a Core command, so each takes the runtime's ONE pending hook
 * (`usePendingPress()` from `@/runtime`): from the press until the command settled the control
 * ignores presses and is marked busy; after `LIVE_PENDING_REVEAL_MS` on the store's clock the kit's
 * Spinner replaces the tile's icon (the Add button has no icon: the Spinner stands before its
 * label). The marker field closes and clears only once the Core holds the marker; on a refusal it
 * stays open with the label (LB-6). In Simulated mode a command settles before the press returns,
 * so no state is set and both controls look and behave exactly as before.
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
import { PendingSpinner, busyState, usePendingPress } from '@/runtime';
import { MARKER_LABEL_MAX, markerLabel } from './session-live.math';
import { SheetContentSignal, useSheetPresence } from './use-sheet-presence';

export interface ActionTilesProps {
  /** `row`: four across (MB 4); `grid`: 2x2 (landscape phone, tablet actions column). */
  layout: 'row' | 'grid';
  readOnly: boolean;
  /** Phones present the marker field as a bottom sheet; tablets as a popover over the tile. */
  markerPresentation: 'popover' | 'bottom-sheet';
  /** Sends `snapshot()`; calls `release` once the command settled (LB-1). */
  onSnapshot: (release: () => void) => void;
  /** Sends `addMarker(label)`: `added` runs when the marker is on the Core, `done` once the command settled. */
  onAddMarker: (label: string | undefined, handlers: { added: () => void; done: () => void }) => void;
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
  const snapshotPress = usePendingPress();
  const tileStyle = layout === 'grid' ? styles.gridTile : styles.rowTile;
  return (
    <View testID="monitor-actions" accessibilityLabel={t('features.session-live.tiles.label')} style={layout === 'grid' ? styles.grid : styles.row}>
      <Tile
        testID="monitor-action-snapshot"
        icon={Camera}
        label={t('session.actions.snapshot.title')}
        hint={t('features.session-live.tiles.snapshotHint')}
        disabled={readOnly}
        busy={snapshotPress.busy}
        pending={snapshotPress.pending}
        onPress={() => {
          snapshotPress.run(onSnapshot);
        }}
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
  /** Its command is out (LB-1): presses are ignored by the caller, the tile is marked busy. */
  busy?: boolean;
  /** Out for `LIVE_PENDING_REVEAL_MS` or longer: the kit's Spinner in place of the icon. */
  pending?: boolean;
  onPress?: () => void;
  style: object;
}

/** One MB 4 tile: a tertiary kit Button, gold icon over a one-line label. */
const Tile = forwardRef<RNView, TileProps>(function Tile(
  { testID, icon: Icon, label, hint, disabled = false, busy = false, pending = false, onPress, style, ...rest },
  ref,
) {
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
      {...busyState(busy, disabled)}
    >
      {pending ? <PendingSpinner color={palette.gold} testID={`${testID}-spinner`} /> : <Icon size={22} color={disabled ? palette.gray : palette.gold} />}
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.tileLabel}>
        {label}
      </Text>
    </Button>
  );
});

interface MarkerTileProps {
  presentation: 'popover' | 'bottom-sheet';
  disabled: boolean;
  onAddMarker: ActionTilesProps['onAddMarker'];
  style: object;
  tileRef?: Ref<RNView>;
}

/** Bookmark = Add Marker (S5): the tile opens a Popover with an optional label (≤ 80 characters). */
function MarkerTile({ presentation, disabled, onAddMarker, style, tileRef }: MarkerTileProps) {
  const { t } = useTranslation();
  const [requested, setRequested] = useState(false);
  const [label, setLabel] = useState('');
  const submitPress = usePendingPress();
  // Mounted on demand and opened once its content is mounted, so the kit animates it in (F-79-2).
  // The anchored popover mounts its content only when open, so it opens one frame later instead.
  const presence = useSheetPresence(requested && !disabled, { awaitContent: presentation === 'bottom-sheet' });

  // The field and the keyboard's "done" share the one press: a marker in flight takes no second one.
  const submit = () => {
    submitPress.run((release) => {
      triggerHaptic('primaryPress');
      onAddMarker(markerLabel(label), {
        added: () => {
          setLabel('');
          setRequested(false);
        },
        done: release,
      });
    });
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
                  <MarkerForm label={label} onChange={setLabel} onSubmit={submit} busy={submitPress.busy} pending={submitPress.pending} />
                </SheetContentSignal>
              </Popover.Content>
            ) : (
              <Popover.Content presentation="popover" placement="top" width={320} className="rounded-xl">
                <MarkerForm label={label} onChange={setLabel} onSubmit={submit} busy={submitPress.busy} pending={submitPress.pending} />
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
  /** The marker command is out (LB-1). */
  busy: boolean;
  /** Out for `LIVE_PENDING_REVEAL_MS` or longer. */
  pending: boolean;
}

function MarkerForm({ label, onChange, onSubmit, busy, pending }: MarkerFormProps) {
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
      <Button testID="monitor-marker-submit" variant="primary" onPress={onSubmit} accessibilityLabel={t('session.actions.addMarker.submit')} {...busyState(busy)}>
        {pending ? <PendingSpinner color={palette.black} testID="monitor-marker-submit-spinner" /> : null}
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
