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
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';
import { MotionPolicyProvider } from '@/motion';
import { RootNavigator } from '@/navigation';
import { RouteErrorFallback } from '@/navigation/route-error-fallback';
import { AppProviders, BootGate, heroUIConfig } from '@/providers';
import { SignedOutLanding } from '@/runtime/signed-out-landing';

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
 * 4. `RootNavigator` (step 70): the root stack with the `Stack.Protected` auth guard, and beside it
 *    `SignedOutLanding` (row FX-M1, E2E-S-1): after a sign-out that leaves a public screen on top
 *    (Pair, Stack Check), the stack is reset to `/`, so the boot router opens Login (or Pair while
 *    the pairing gate holds) whatever was visited before.
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
            <>
              <RootNavigator />
              <SignedOutLanding />
            </>
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
