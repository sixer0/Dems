import '../global.css';

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron/700Bold';
import { useFonts } from 'expo-font';
import { type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, HeroUINativeProvider } from 'heroui-native';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';
import { useRetryCooldown } from '@dems/shared/realtime';
import { palette } from '@dems/shared/tokens';
import { i18n } from '@/i18n';
import { MotionPolicyProvider } from '@/motion';
import { RootNavigator } from '@/navigation';
import { AppProviders, BootGate, heroUIConfig } from '@/providers';

void SplashScreen.preventAutoHideAsync();
Uniwind.setTheme('dark');

/**
 * Root layout (04_mobile_specs §3.2, §3.3; 01S §5.4). Fonts load first while the native splash
 * stays up. Then, outermost first:
 *
 * 1. `MotionPolicyProvider` (step 69): OS reduce motion, the Settings override, the deep-link
 *    switches (`?motion=off|slow|full`, `?debug=1|0`), `ReducedMotionConfig` and the `?debug=1`
 *    overlay. Its render prop hands the policy to the providers (D57), because a component cannot
 *    read, through a hook, a provider that it renders itself;
 * 2. `AppProviders` (step 68, then 73) with `reducedMotion` → HeroUI `animation: 'disable-all'`;
 * 3. `BootGate`: the splash stays up until the runtime has hydrated (at most 2 s, then a Skeleton);
 * 4. `RootNavigator` (step 70): the root stack with the `Stack.Protected` auth guard.
 *
 * Owner: step 70 (P6).
 */
export default function RootLayout() {
  // masterplan/01_specs.md §5.4: the object keys become the family names used by the theme.
  const [fontsLoaded, fontError] = useFonts({
    Orbitron_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  // Until the fonts load (or fail: then render anyway, as row 18) the native splash stays up;
  // from then on BootGate decides when it hides.
  if (!fontsLoaded && !fontError) return null;

  return (
    <MotionPolicyProvider>
      {(policy) => (
        <AppProviders reducedMotion={policy === 'reduced'}>
          <BootGate>
            <RootNavigator />
          </BootGate>
          <StatusBar style="light" />
        </AppProviders>
      )}
    </MotionPolicyProvider>
  );
}

/**
 * Expo Router error boundary: friendly message and a rate-limited retry (3 s → 6 s → 12 s, max 3).
 * Expo Router renders it INSTEAD of this layout, so none of the layout's providers exist here; it
 * mounts the few the kit needs itself (without them the HeroUI Card threw on the device, step 70).
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <HeroUINativeProvider config={heroUIConfig(false)}>
          <RouteErrorFallback {...props} />
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RouteErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { retry: guardedRetry, cooldown, exhausted, canRetry } = useRetryCooldown(() => {
    void retry();
  });
  if (__DEV__) {
    // No client-log endpoint exists in the mock-core scaffold (D3/D4, D41(g)); dev console only.
    console.error('[mobile] route error', { message: error.message, stack: error.stack });
  }
  // `i18n.t` (not the hook): the boundary can render outside the provider tree.
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: palette.black }}>
      <Card className="rounded-xl">
        <Card.Header>
          <Card.Title>{i18n.t('mobile.errorBoundary.title')}</Card.Title>
          <Card.Description>{i18n.t('mobile.errorBoundary.description')}</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button variant="primary" isDisabled={!canRetry} onPress={guardedRetry}>
            <Button.Label>
              {exhausted
                ? i18n.t('mobile.errorBoundary.restart')
                : cooldown > 0
                  ? i18n.t('mobile.errorBoundary.retryIn', { seconds: cooldown })
                  : i18n.t('mobile.errorBoundary.retry')}
            </Button.Label>
          </Button>
        </Card.Footer>
      </Card>
    </View>
  );
}
