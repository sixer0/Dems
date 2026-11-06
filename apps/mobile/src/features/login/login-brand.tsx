/**
 * Login brand block (04_mobile_specs §4.1 L2 + L3; MB 1 (143–260, 100–248)):
 * - L2: C-1 GlowRing in `login` mode (200 dp compact, 240 medium, 340 expanded) with the Emblem in
 *   its centre. The emblem is the Skia `EmblemDraw`: its strokes draw at the 500 ms beat (the
 *   M-APP-03 stroke order, hero moment "emblem scan and bloom") and its arcs pulse in sequence while
 *   a sign-in is pending (M-C-22 "Submitting"). The ring tone follows the Core link and the lockout.
 * - L3: the wordmark "DEMS / EDGE CLIENT" in the display face and the caption. H-MB-02 (masked
 *   gradient text) needs `@react-native-masked-view`, which is not a dependency (P12), so the spec's
 *   fallback is used: flat gold (`palette.gold`) with a soft bronze text glow (DR-S75-3).
 *
 * The officer photo of MB 1 is never used (D28); the backdrop is the licensed room still.
 */
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { derived, fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { GlowRing, type GlowRingState } from '@/components/composed/glow-ring';
import { EmblemDraw } from '@/components/media';
import { withAlpha } from '@/components/media/color';
import type { LayoutClass } from '@/layout';
import type { EmblemOrigin, LoginEntrance } from './use-login-choreography';

/** Emblem width as a share of the ring (MB 1: shield ≈ 64 of a ≈ 150 px ring). */
const EMBLEM_SHARE = 0.44;
/** Centre of the header logo slot the emblem flies back from (M-APP-02), from the safe-area origin. */
const HEADER_SLOT = { x: 32, y: 28 } as const;

const WORDMARK_SIZES: Record<LayoutClass, { top: number; bottom: number; caption: number }> = {
  compact: { top: 34, bottom: 20, caption: 14 },
  'compact-landscape': { top: 28, bottom: 16, caption: 12 },
  medium: { top: 40, bottom: 22, caption: 15 },
  expanded: { top: 52, bottom: 28, caption: 16 },
};

export interface LoginBrandProps {
  layoutClass: LayoutClass;
  ringSize: number;
  ringState: GlowRingState;
  policy: 'full' | 'reduced';
  /** Ambient ring loops may run (focus, app state, motion policy). */
  loopsRunning: boolean;
  ringDelayMs: number;
  emblemReady: boolean;
  scanning: boolean;
  entrance: LoginEntrance;
  emblemStyle: AnimatedStyle<ViewStyle>;
  wordmarkStyle: AnimatedStyle<ViewStyle>;
  captionStyle: AnimatedStyle<TextStyle>;
  /** `return` entrance: receives the offset from the ring centre to the header logo slot. */
  onEmblemOrigin?: (origin: EmblemOrigin) => void;
}

export function LoginBrand({
  layoutClass,
  ringSize,
  ringState,
  policy,
  loopsRunning,
  ringDelayMs,
  emblemReady,
  scanning,
  entrance,
  emblemStyle,
  wordmarkStyle,
  captionStyle,
  onEmblemOrigin,
}: LoginBrandProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const ringRef = useRef<View>(null);
  const measured = useRef(false);
  const sizes = WORDMARK_SIZES[layoutClass];
  const emblemSize = Math.round(ringSize * EMBLEM_SHARE);

  const measureOrigin = () => {
    if (entrance !== 'return' || !onEmblemOrigin || measured.current) return;
    measured.current = true;
    ringRef.current?.measureInWindow((x, y, width, height) => {
      onEmblemOrigin({
        dx: insets.left + HEADER_SLOT.x - (x + width / 2),
        dy: insets.top + HEADER_SLOT.y - (y + height / 2),
      });
    });
  };

  return (
    <View style={styles.brand} testID="login-brand">
      <View
        ref={ringRef}
        onLayout={measureOrigin}
        style={{ width: ringSize, height: ringSize }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('features.login.brandLabel')}
        testID="login-ring"
      >
        <GlowRing
          mode="login"
          size={ringSize}
          state={ringState}
          motion={policy}
          paused={!loopsRunning}
          sweepDelayMs={ringDelayMs}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.emblemSlot, emblemStyle]} pointerEvents="none">
          {emblemReady ? (
            <EmblemDraw size={emblemSize} motion={policy} scanning={scanning} testID="login-emblem" accessibilityLabel={t('common.brand.name')} />
          ) : null}
        </Animated.View>
      </View>

      <Animated.View style={[styles.wordmark, wordmarkStyle]} accessible accessibilityRole="header" accessibilityLabel={t('common.brand.wordmark')}>
        <Text style={[styles.wordTop, { fontSize: sizes.top, lineHeight: Math.round(sizes.top * 1.15) }]}>
          {t('features.login.wordmark.top')}
        </Text>
        <Text style={[styles.wordBottom, { fontSize: sizes.bottom, lineHeight: Math.round(sizes.bottom * 1.25) }]}>
          {t('features.login.wordmark.bottom')}
        </Text>
      </Animated.View>
      <Animated.Text style={[styles.caption, { fontSize: sizes.caption, lineHeight: Math.round(sizes.caption * 1.4) }, captionStyle]}>
        {t('common.brand.tagline')}
      </Animated.Text>
    </View>
  );
}

const glow: TextStyle = {
  textShadowColor: withAlpha(palette.bronze, 0.55),
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 14,
};

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing[1] },
  emblemSlot: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  wordmark: { alignItems: 'center', marginTop: spacing[1] },
  wordTop: {
    fontFamily: fontFamily.native.display,
    color: palette.gold,
    letterSpacing: 2,
    textAlign: 'center',
    includeFontPadding: false,
    ...glow,
  },
  wordBottom: {
    fontFamily: fontFamily.native.display,
    color: palette.gold,
    letterSpacing: 1.5,
    textAlign: 'center',
    includeFontPadding: false,
    ...glow,
  },
  caption: {
    fontFamily: fontFamily.native.normal,
    color: derived.foreground2,
    textAlign: 'center',
    letterSpacing: typography.body.letterSpacing,
  },
});
