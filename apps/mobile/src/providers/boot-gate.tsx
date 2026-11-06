import * as SplashScreen from 'expo-splash-screen';
import { SkeletonGroup } from 'heroui-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeScreen } from '@/layout';
import { useRuntimeStatus } from '@/runtime';

/** Longest the native splash is held for hydration before the boot skeleton shows (04 §3.2). */
export const SPLASH_MAX_HOLD_MS = 2000;

export interface BootGateProps {
  children: ReactNode;
}

/**
 * Holds the native splash until the runtime is ready (simulator hydration, 04_mobile_specs §3.2
 * and §5.2), at most `SPLASH_MAX_HOLD_MS`; after that it hides the splash and shows a Skeleton boot
 * screen until ready (M-MB-05; the emblem draw of M-APP-03 is a later motion step). Mount it inside
 * `AppProviders` after the fonts have loaded. With the step-68 runtime stub `ready` is always true,
 * so the splash hides on the first frame, as in row 18.
 */
export function BootGate({ children }: BootGateProps) {
  const { ready } = useRuntimeStatus();
  const [holdExpired, setHoldExpired] = useState(false);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setHoldExpired(true), SPLASH_MAX_HOLD_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (ready || holdExpired) void SplashScreen.hideAsync();
  }, [ready, holdExpired]);

  if (ready) return children;
  if (!holdExpired) return null;
  return <BootSkeleton />;
}

function BootSkeleton() {
  const { t } = useTranslation();
  return (
    <SafeScreen id="boot" contentContainerStyle={{ padding: 24, gap: 16, justifyContent: 'center' }}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={t('mobile.boot.loading')}>
        <SkeletonGroup isLoading variant="shimmer" className="gap-4">
          <SkeletonGroup.Item className="h-8 w-48 rounded-lg" />
          <SkeletonGroup.Item className="h-40 w-full rounded-xl" />
          <SkeletonGroup.Item className="h-24 w-full rounded-xl" />
        </SkeletonGroup>
      </View>
    </SafeScreen>
  );
}
