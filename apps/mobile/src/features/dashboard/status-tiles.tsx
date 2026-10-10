/**
 * H3 status tiles ×3 (04_mobile_specs §4.3; MB 2 (352–592, 170–232)): Camera **2/2** (04 §9 #7),
 * Microphone 2/2 and Storage **20% used** (D28/Q1). Each tile is a kit `Surface variant="secondary"`
 * with an icon, the state line in its tone and a C-6 RollingNumber value that rolls in after the
 * held beat (§7.3: tiles at 250 ms, stagger 50; `slide` columns, DR-S77-1). Tap → Devices or Storage.
 */
import { useRouter } from 'expo-router';
import { PressableFeedback, Surface } from 'heroui-native';
import { Cctv, Database, Mic, type LucideIcon } from 'lucide-react-native';
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

export function StatusTiles({ tiles }: StatusTilesProps) {
  const { t } = useTranslation();
  return (
    <View testID="home-tiles" accessibilityLabel={t('features.dashboard.tiles.label')} style={styles.row}>
      {tiles.map((tile, index) => (
        <StatusTile key={tile.id} tile={tile} index={index} />
      ))}
    </View>
  );
}

function StatusTile({ tile, index }: { tile: HomeTile; index: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const policy = useMotionPolicy();
  const settings = useMotionSettings();
  const Icon = ICONS[tile.id];
  const beat = beatAt(HOME_BEATS.tiles, HOME_BEATS.tileStagger, index);
  // C-6 `slide` with the held beat (DR-S77-1): exact digits once settled, rolling in after the card.
  const shown = useHeldValue(tile.value, valueTickDelay(beat, settings), policy === 'reduced');
  const suffix = tile.total !== null ? `/${tile.total}` : '%';
  // Fix wave I: a state that is a whole key (the real-capture microphone states) is resolved as such.
  const state = t(tile.stateKey.startsWith('features.') ? tile.stateKey : `features.dashboard.tiles.state.${tile.stateKey}`, tile.count !== undefined ? { count: tile.count } : {});
  const label =
    tile.id === 'storage'
      ? t('features.dashboard.tiles.a11y.storage', { percent: tile.value, state })
      : tile.id === 'camera'
        ? t('features.dashboard.tiles.a11y.camera', { online: tile.value, total: tile.total ?? 0, state })
        : t('features.dashboard.tiles.a11y.microphone', { ready: tile.value, total: tile.total ?? 0, state });

  return (
    <Animated.View entering={homeEnter(beat, settings)} style={styles.cell}>
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
