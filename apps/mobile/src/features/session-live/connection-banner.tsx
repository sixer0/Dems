/**
 * S7 connection banner (04_mobile_specs §4.5 S7, §5.5, §5.6; motion M-MB-04; MA-10 UI half).
 *
 * The state comes from the runtime (`useConnectionBanner()`, step 73): `offline` while the Core link
 * is OFFLINE, `resynced` for 3 s after it returns, `hidden` otherwise. This view draws it:
 * - offline: `Alert status="warning"` + `Spinner`: "Core link lost — recording continues on the
 *   Core. Reconnecting…", plus why the session actions are read-only; one Warning haptic;
 * - resynced: the same Alert turns green "Resynced", then exits.
 * It slides down 240 ms from under the header; reduced motion fades.
 *
 * Closing-fix row CF-M1 (R-P-1): no `exiting` animation. A view with one is kept by Reanimated as a ghost
 * after React removed it, and the indices of the following mount instructions are shifted around it; the
 * crash of the re-test (`Tried to remove view [21688] …`, `addViewAt: failed to insert view …`) had the
 * banner as the first view out of place, in the subtree the Finalizing hand-over removes. The banner now
 * leaves in the commit that hides it (the "Resynced" state already said the link is back), and it sits in a
 * container of its own (`session-live-screen.tsx`), so its coming and going never moves the index of a
 * sibling of the monitor.
 */
import { Alert, Spinner } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { motion as motionTokens } from '@dems/shared/tokens';
import { triggerHaptic, useMotionSettings } from '@/motion';
import { useConnectionBanner } from '@/runtime';

export function ConnectionBanner() {
  const { t } = useTranslation();
  const banner = useConnectionBanner();
  const settings = useMotionSettings();
  const reduced = settings.policy === 'reduced';

  const last = useRef(banner.kind);
  useEffect(() => {
    if (banner.kind === 'offline' && last.current !== 'offline') triggerHaptic('coreLinkLost');
    last.current = banner.kind;
  }, [banner.kind]);

  if (banner.kind === 'hidden' || banner.messageKey === null) return null;
  const offline = banner.kind === 'offline';
  return (
    <Animated.View
      testID={`monitor-banner-${banner.kind}`}
      entering={reduced ? FadeIn.duration(motionTokens.duration.fast) : SlideInUp.duration(motionTokens.duration.base)}
      accessibilityLiveRegion="polite"
    >
      <Alert status={offline ? 'warning' : 'success'}>
        <Alert.Indicator>{offline ? <Spinner size="sm" color="warning" /> : undefined}</Alert.Indicator>
        <Alert.Content>
          <Alert.Title>{t(banner.messageKey)}</Alert.Title>
          {offline ? <Alert.Description>{t('features.session-live.banner.readOnly')}</Alert.Description> : null}
        </Alert.Content>
      </Alert>
    </Animated.View>
  );
}
