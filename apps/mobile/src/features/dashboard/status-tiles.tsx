/**
 * H3 status tiles ×3 (04_mobile_specs §4.3; MB 2 (352–592, 170–232)): Camera **2/2** (04 §9 #7),
 * Microphone 2/2 and Storage **20% used** (D28/Q1). Each tile is a kit `Surface variant="secondary"`
 * with an icon, the state line in its tone and a C-6 RollingNumber value that rolls in after the
 * held beat (§7.3: tiles at 250 ms, stagger 50; `slide` columns, DR-S77-1). Tap → Devices or Storage.
 */
import { useIsFocused, useRouter } from 'expo-router';
import { PressableFeedback, Surface } from 'heroui-native';
import { Cctv, Database, Mic, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { fontFamily, palette, toneHex, toneTextHex, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { useMotionPolicy, useMotionSettings } from '@/motion';
import type { HomeTile, HomeTileId } from './home-model';
import { HOME_BEATS, beatAt, homeEnter, valueTickDelay } from './home-motion';
import { useHeldValue } from './use-held-value';

const ICONS: Record<HomeTileId, LucideIcon> = { camera: Cctv, microphone: Mic, storage: Database };

export interface StatusTilesProps {
  tiles: readonly HomeTile[];
}

/**
 * What a tile STATES, as one line: a tile whose statement changed is a new tile (see `StatusTiles`). The
 * value is not part of it - a storage percentage that moves rolls inside the tile it is in.
 */
export function tileStatement(tile: HomeTile): string {
  return `${tile.id}|${tile.stateKey}|${tile.tone}|${tile.total ?? ''}|${tile.count ?? ''}|${tile.reported === true ? 'r' : ''}`;
}

/**
 * Fix wave M (re-check 75 finding G75e-01): THE CAMERA TILE WAS AN EMPTY BOX WHILE A SESSION RECORDED. Seen on
 * the phone whenever the recording started while Home was NOT the tab in view (the session started on another
 * client, the operator on Evidence or Devices): the tile's state changed ("Not checked" to "Live") while its tab
 * screen was detached, and on return the tile's box was drawn with nothing inside - icon, name, state and
 * count all missing - until the app was restarted. A tile that changed while Home was in view was never empty.
 * Two rules keep the drawn tile whole:
 *  1. the tiles change only while this screen is in view: a change that arrives while another tab is in view is
 *     held and applied in the render in which the screen is focused again;
 *  2. a tile whose STATEMENT changed is mounted as a new tile (its key is `tileStatement`), so its native views
 *     are created with their final content instead of being patched; only the first tile of a visit plays the
 *     enter motion (a later copy starts no motion: the hand-over rule of the Stepper, W93-7 / G89-02).
 */
export function StatusTiles({ tiles }: StatusTilesProps) {
  const { t } = useTranslation();
  const focused = useIsFocused();
  const [shown, setShown] = useState(tiles);
  if (focused && shown !== tiles) setShown(tiles);
  const drawn = focused ? tiles : shown;
  const [initial] = useState(tiles);
  return (
    <View testID="home-tiles" accessibilityLabel={t('features.dashboard.tiles.label')} style={styles.row}>
      {drawn.map((tile, index) => (
        <StatusTile key={tileStatement(tile)} tile={tile} index={index} enter={drawn === initial} />
      ))}
    </View>
  );
}

function StatusTile({ tile, index, enter }: { tile: HomeTile; index: number; enter: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const policy = useMotionPolicy();
  const settings = useMotionSettings();
  const Icon = ICONS[tile.id];
  const beat = beatAt(HOME_BEATS.tiles, HOME_BEATS.tileStagger, index);
  // C-6 `slide` with the held beat (DR-S77-1): exact digits once settled, rolling in after the card.
  const shown = useHeldValue(tile.value, enter ? valueTickDelay(beat, settings) : 0, policy === 'reduced');
  const suffix = tile.total !== null ? `/${tile.total}` : '%';
  // Fix wave I: a state that is a whole key (the real-capture microphone states) is resolved as such.
  const state = t(tile.stateKey.startsWith('features.') ? tile.stateKey : `features.dashboard.tiles.state.${tile.stateKey}`, tile.count !== undefined ? { count: tile.count } : {});
  const label =
    tile.id === 'storage'
      ? t('features.dashboard.tiles.a11y.storage', { percent: tile.value, state })
      : tile.id === 'camera'
        ? t(tile.reported === true ? 'features.capture-selector.sourceState.homeCamerasLabel' : 'features.dashboard.tiles.a11y.camera', { online: tile.value, total: tile.total ?? 0, state })
        : t(tile.reported === true ? 'features.capture-selector.sourceState.homeMicrophonesLabel' : 'features.dashboard.tiles.a11y.microphone', { ready: tile.value, total: tile.total ?? 0, state });

  return (
    <Animated.View {...(enter ? { entering: homeEnter(beat, settings) } : {})} style={styles.cell}>
      <PressableFeedback
        testID={`home-tile-${tile.id}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t(tile.href === '/storage' ? 'features.dashboard.tiles.openStorage' : 'features.dashboard.tiles.openDevices')}
        onPress={() => router.push(tile.href)}
        style={styles.fill}
      >
        <Surface variant="secondary" style={[styles.tile, tile.tone === 'danger' ? styles.tileDanger : null]}>
          <View style={styles.head}>
            <Icon size={22} color={toneHex[tile.tone]} />
            <View style={styles.headText}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2} style={styles.name}>
                {t(`features.dashboard.tiles.${tile.id}`)}
              </Text>
              <Text
                testID={`home-tile-${tile.id}-state`}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                style={[styles.state, { color: tile.tone === 'success' ? palette.gray : toneTextHex[tile.tone] }]}
              >
                {state}
              </Text>
            </View>
          </View>
          <View style={styles.valueRow}>
            <RollingNumber
              testID={`home-tile-${tile.id}-value`}
              value={shown}
              mode="slide"
              motion={policy}
              size="h1"
              face="sans"
              color={tile.tone === 'danger' ? toneTextHex.danger : palette.foreground}
              suffix={suffix}
              accessibilityLabel={`${tile.value}${suffix}`}
            />
            {tile.id === 'storage' ? (
              <Text maxFontSizeMultiplier={1.2} style={styles.used}>
                {t('features.dashboard.tiles.used')}
              </Text>
            ) : null}
          </View>
        </Surface>
      </PressableFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, minWidth: 0 },
  fill: { flex: 1 },
  tile: { flex: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 12, gap: 10 },
  tileDanger: { borderWidth: 1, borderColor: palette.danger },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headText: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.foreground,
  },
  state: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
  },
  valueRow: { alignItems: 'center', gap: 0 },
  used: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: palette.gray,
  },
});
