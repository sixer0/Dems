import '../global.css';

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, HeroUINativeProvider } from 'heroui-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Uniwind } from 'uniwind';
import { HeartbeatProvider, useRetryCooldown } from '@dems/shared/realtime';
import { palette } from '@dems/shared/tokens';
import { HEALTH_QUERY_KEY } from '@/features/home/use-health';

void SplashScreen.preventAutoHideAsync();
Uniwind.setTheme('dark');

const queryClient = new QueryClient();

/** Scaffold stand-in for the §5.5/§5.6 resync: refresh health after a WS reconnect. */
function resync() {
  void queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
}

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

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <HeartbeatProvider onResync={resync}>
          <HeroUINativeProvider config={{ textProps: { maxFontSizeMultiplier: 1.2 } }}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                contentStyle: { backgroundColor: palette.black },
              }}
            />
            <StatusBar style="light" />
          </HeroUINativeProvider>
        </HeartbeatProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Expo Router error boundary: friendly message and a rate-limited retry (3 s → 6 s → 12 s, max 3). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { retry: guardedRetry, cooldown, exhausted, canRetry } = useRetryCooldown(() => {
    void retry();
  });
  if (__DEV__) {
    // No client-log endpoint exists in the mock-core scaffold (D3/D4); dev console only.
    console.error('[mobile] route error', { message: error.message, stack: error.stack });
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: palette.black }}>
      <Card className="rounded-xl">
        <Card.Header>
          <Card.Title>Something went wrong</Card.Title>
          <Card.Description>This screen could not be displayed. Try again in a moment.</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button variant="primary" isDisabled={!canRetry} onPress={guardedRetry}>
            <Button.Label>
              {exhausted ? 'Restart the app' : cooldown > 0 ? `Retry in ${cooldown}s` : 'Try again'}
            </Button.Label>
          </Button>
        </Card.Footer>
      </Card>
    </View>
  );
}
