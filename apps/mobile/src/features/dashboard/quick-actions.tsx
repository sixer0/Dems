/**
 * H4 Quick Actions (04_mobile_specs §4.3; MB 2 (352–592, 245–320)).
 *
 * - "Start Session": kit `Button variant="primary" size="lg"` with the gold → bronze fill from
 *   `expo-linear-gradient` in the button's `background` slot (H-S16) and a light sheen that sweeps
 *   once every 8 s (M-C-23, the ShineBorder equivalent; an ambient loop, off under reduced motion).
 *   The label stays dark on gold (D28/Q5). While a session is active the button leads back to it
 *   ("Return to live session" while recording, §4.3 H4), with the target of the §3.7 table.
 * - "View Evidence": kit `Button variant="outline"` → `/evidence`.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { Button } from 'heroui-native';
import { FileText, Play, Radio, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { palette } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { withAlpha } from '@/components/media/color';
import { EASING, durationMs, useAmbientLoop, useHaptics, useMotionSettings } from '@/motion';
import type { PrimaryAction, PrimaryActionKind } from './home-model';
import { HOME_BEATS, HOME_LOOPS, SHEEN_EVERY_MS, SHEEN_SWEEP_MS, homeEnter } from './home-motion';

const PRIMARY_ICON: Record<PrimaryActionKind, LucideIcon> = {
  start: Play,
  returnLive: Radio,
  continueSetup: Play,
  finalizing: RotateCcw,
  recovery: RotateCcw,
  summary: FileText,
};

export interface QuickActionsProps {
  action: PrimaryAction;
  /** Stack the two buttons (narrow tablet pane) instead of side by side (MB 2). */
  stacked?: boolean;
}

export function QuickActions({ action, stacked = false }: QuickActionsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const haptic = useHaptics();
  const settings = useMotionSettings();
  const Icon = PRIMARY_ICON[action.kind];

  return (
    <Animated.View testID="home-actions" entering={homeEnter(HOME_BEATS.actions, settings)}>
      <SectionCard title={t('features.dashboard.actions.title')}>
        <View style={[styles.buttons, stacked ? styles.stacked : null]}>
          <Button
            testID="home-action-primary"
            variant="primary"
            size="lg"
            className={stacked ? 'h-16 flex-row gap-2' : 'h-20 flex-1 flex-col gap-1'}
            accessibilityLabel={t(action.labelKey)}
            background={<PrimaryFill sheen={action.kind === 'start'} />}
            onPress={() => {
              haptic('primaryPress');
              router.push(action.href as Href);
            }}
          >
            <Icon size={22} color={palette.black} fill={action.kind === 'start' ? palette.black : 'none'} />
            <Button.Label numberOfLines={1} className="text-base">
              {t(action.labelKey)}
            </Button.Label>
          </Button>
          <Button
            testID="home-action-evidence"
            variant="outline"
            size="lg"
            className={stacked ? 'h-16 flex-row gap-2' : 'h-20 flex-1 flex-col gap-1'}
            accessibilityLabel={t('features.dashboard.actions.viewEvidence')}
            onPress={() => router.push('/evidence')}
          >
            <FileText size={22} color={palette.foreground} />
            <Button.Label numberOfLines={1} className="text-base">
              {t('features.dashboard.actions.viewEvidence')}
            </Button.Label>
          </Button>
        </View>
      </SectionCard>
    </Animated.View>
  );
}

/**
 * Gold → bronze gradient fill plus the periodic sheen (a diagonal light band crossing the button in
 * `ambient.sheen` = 700 ms, once per 8 s). The sheen is an ambient loop: it registers with the
 * motion kit, stops off-focus, in the background and under reduced motion (§7.1 Loops).
 */
function PrimaryFill({ sheen }: { sheen: boolean }) {
  const settings = useMotionSettings();
  const focused = useIsFocused();
  const running = useAmbientLoop(HOME_LOOPS.startSheen, { active: sheen, paused: !focused });
  const width = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!running) {
      cancelAnimation(progress);
      progress.set(0);
      return undefined;
    }
    const sweep = durationMs(SHEEN_SWEEP_MS, settings);
    const every = durationMs(SHEEN_EVERY_MS, settings);
    progress.set(0);
    progress.set(
      withRepeat(
        withSequence(
          withDelay(Math.max(0, every - sweep), withTiming(1, { duration: sweep, easing: EASING.luxe })),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(progress);
  }, [running, settings, progress]);

  const bandStyle = useAnimatedStyle(() => {
    const w = width.get();
    const p = progress.get();
    return {
      opacity: p > 0 && p < 1 ? 1 : 0,
      transform: [{ translateX: -w * 0.6 + p * w * 1.6 }, { skewX: '-20deg' }],
    };
  });

  const onLayout = (event: LayoutChangeEvent) => width.set(event.nativeEvent.layout.width);

  return (
    <View testID="home-action-primary-fill" pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <LinearGradient colors={[palette.gold, palette.bronze]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {sheen ? (
        <Animated.View testID="home-action-sheen" style={[styles.band, bandStyle]}>
          <LinearGradient
            colors={[withAlpha(palette.foreground, 0), withAlpha(palette.foreground, 0.45), withAlpha(palette.foreground, 0)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 12 },
  stacked: { flexDirection: 'column' },
  band: { position: 'absolute', top: -8, bottom: -8, width: '40%' },
});
