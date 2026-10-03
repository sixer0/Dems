import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeroUINativeProvider, type HeroUINativeConfig } from 'heroui-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, initialWindowMetrics, type Metrics } from 'react-native-safe-area-context';
import { HEALTH_QUERY_KEY } from '@dems/shared/api';
import { HeartbeatProvider, type SocketFactory } from '@dems/shared/realtime';
import type { Sim } from '@dems/shared/sim';
import { AuthProvider } from '@/auth';
import { i18n } from '@/i18n';
import { SimRuntimeProvider, createResyncBus, installRuntimeLogSinks, type MobileSimOptions } from '@/runtime';

/** Font scaling cap that keeps layouts stable at large system font sizes (01S §5.4, 04 §2.6). */
export const MAX_FONT_SIZE_MULTIPLIER = 1.2;

/** The app's TanStack Query client (the row-18 health query and later Core reads). */
export function createAppQueryClient(): QueryClient {
  return new QueryClient();
}

/** HeroUI Native configuration (04_mobile_specs §3.2 item 7; VM-03, VM-04). */
export function heroUIConfig(reducedMotion: boolean): HeroUINativeConfig {
  return {
    textProps: { maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER },
    // VM-04: the kit disables all of its animations under 'disable-all' (reduced motion, §7.7).
    ...(reducedMotion ? { animation: 'disable-all' as const } : {}),
    // §4.19: toasts at the top; critical toasts persist until dismissed (set per toast).
    toast: { defaultProps: { placement: 'top' } },
  };
}

export interface AppProvidersProps {
  children: ReactNode;
  /**
   * Reduced-motion policy from the motion kit (step 69 `useMotionPolicy() === 'reduced'`), passed
   * by the root layout (step 70). It switches the kit to `animation: 'disable-all'` (04 §7.7).
   */
  reducedMotion?: boolean;
  /** Injected in tests; the app creates one client per process. */
  queryClient?: QueryClient;
  /** Heartbeat socket factory; tests pass a fake (default: the global `WebSocket`). */
  heartbeatSocketFactory?: SocketFactory;
  /** Called after a heartbeat reconnect, after the health query is refreshed (04 §5.5). */
  onHeartbeatResync?: () => void;
  /** Safe-area metrics for the first frame; tests pass fixed metrics (jest has no native module). */
  safeAreaMetrics?: Metrics | null;
  /** An existing simulator (tests); default: the mobile simulator `SimRuntimeProvider` creates. */
  sim?: Sim;
  /** Options for the simulator `SimRuntimeProvider` creates (ignored with `sim`). */
  simOptions?: MobileSimOptions;
}

/**
 * The app-wide provider tree, outermost first (04_mobile_specs §3.2):
 *
 *  1. GestureHandlerRootView
 *  2. KeyboardProvider (react-native-keyboard-controller 1.21.9, installed by step 67; it detects
 *     edge-to-edge itself, so no translucency props are passed)
 *  3. SafeAreaProvider
 *  4. QueryClientProvider
 *  5. I18nextProvider (the app instance, `@/i18n`: shared `@dems/shared/i18n` + `mobile.*` + features)
 *  6. MotionPolicyProvider — mounted by the root layout around this tree (steps 69 and 70); its
 *     policy arrives here as `reducedMotion`
 *  7. HeroUINativeProvider (font-scale cap, kit animation switch, top toasts)
 *  8. HeartbeatProvider (shared; on resync it refreshes the health query and signals the runtime)
 *  9. SimRuntimeProvider (`@/runtime`, step 73): the shared simulator on AsyncStorage + AppState,
 *     the hydration gate, the Core link, keep-awake and the connection banner
 * 10. AuthProvider (`@/auth`, step 73): the simulator auth, biometric sign-in and the idle lock
 *
 * It also routes the motion and navigation issue records into the persistent runtime log.
 * Owner after step 73: the next step that the controller assigns (P6).
 */
export function AppProviders({
  children,
  reducedMotion = false,
  queryClient,
  heartbeatSocketFactory,
  onHeartbeatResync,
  safeAreaMetrics = initialWindowMetrics,
  sim,
  simOptions,
}: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createAppQueryClient());
  const [resyncBus] = useState(createResyncBus);
  const config = useMemo(() => heroUIConfig(reducedMotion), [reducedMotion]);

  useEffect(() => installRuntimeLogSinks(), []);

  const onHeartbeatResyncRef = useRef(onHeartbeatResync);
  useEffect(() => {
    onHeartbeatResyncRef.current = onHeartbeatResync;
  }, [onHeartbeatResync]);

  // §5.5: after an OFFLINE → LIVE reconnect, refresh the health query and resync the route.
  const onResync = () => {
    void client.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
    resyncBus.emit();
    onHeartbeatResyncRef.current?.();
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider initialMetrics={safeAreaMetrics}>
          <QueryClientProvider client={client}>
            <I18nextProvider i18n={i18n}>
              <HeroUINativeProvider config={config}>
                <HeartbeatProvider
                  onResync={onResync}
                  {...(heartbeatSocketFactory ? { socketFactory: heartbeatSocketFactory } : {})}
                >
                  <SimRuntimeProvider resyncBus={resyncBus} {...(sim ? { sim } : {})} {...(simOptions ? { simOptions } : {})}>
                    <AuthProvider>{children}</AuthProvider>
                  </SimRuntimeProvider>
                </HeartbeatProvider>
              </HeroUINativeProvider>
            </I18nextProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
