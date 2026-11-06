import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { palette } from '@dems/shared/tokens';

/** Every safe-area edge, in CSS order. */
export const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

/**
 * Edges whose inset is already consumed by navigation chrome around the screen (04_mobile_specs
 * §2.6): the bottom tab bar pads the bottom inset, a rail pads the start-side inset. The navigation
 * shell (step 70) wraps its `TabSlot` in this provider so screens never pad an inset twice.
 */
const ChromeInsetsContext = createContext<readonly Edge[]>([]);

export interface ChromeInsetsProviderProps {
  /** Edges the surrounding chrome already pads. */
  consumed: readonly Edge[];
  children: ReactNode;
}

export function ChromeInsetsProvider({ consumed, children }: ChromeInsetsProviderProps) {
  const parent = useContext(ChromeInsetsContext);
  const merged = useMemo(() => ALL_EDGES.filter((edge) => parent.includes(edge) || consumed.includes(edge)), [parent, consumed]);
  return <ChromeInsetsContext.Provider value={merged}>{children}</ChromeInsetsContext.Provider>;
}

/** The edges a screen root must pad: `explicit` if given, else every edge the chrome has not consumed. */
export function useScreenEdges(explicit?: readonly Edge[]): readonly Edge[] {
  const consumed = useContext(ChromeInsetsContext);
  return useMemo(() => explicit ?? ALL_EDGES.filter((edge) => !consumed.includes(edge)), [explicit, consumed]);
}

export interface SafeScreenProps {
  /** Screen id; the root carries `testID="screen-<id>"` (04_mobile_specs §4.0, uiautomator resource-id). */
  id: string;
  /** Edges to pad. Default: every edge not consumed by the surrounding chrome (`ChromeInsetsProvider`). */
  edges?: readonly Edge[];
  /** Wrap the content in a vertical `ScrollView`; the bottom inset then pads the scroll content. */
  scroll?: boolean;
  /** Extra props for the `ScrollView` when `scroll` is set (e.g. `keyboardShouldPersistTaps`). */
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'children'>;
  /** Style of the scroll content (with `scroll`) or of the inner content view. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  className?: string;
  children?: ReactNode;
}

/**
 * Screen root for every route (04_mobile_specs §2.6): edge-to-edge canvas on the design black,
 * safe-area padding on the edges the chrome does not already own, and the `screen-<id>` testID.
 * Forms use `KeyboardAwareScrollView` inside a non-scrolling SafeScreen (§2.6 keyboard rule).
 */
export function SafeScreen({
  id,
  edges,
  scroll = false,
  scrollProps,
  contentContainerStyle,
  style,
  className,
  children,
}: SafeScreenProps) {
  const insets = useSafeAreaInsets();
  const padded = useScreenEdges(edges);
  const pad = (edge: Edge) => (padded.includes(edge) ? insets[edge] : 0);

  const rootStyle: ViewStyle = {
    flex: 1,
    backgroundColor: palette.black,
    paddingTop: pad('top'),
    paddingLeft: pad('left'),
    paddingRight: pad('right'),
    // A scrolling screen pads its content instead, so the last row can scroll clear of the inset.
    paddingBottom: scroll ? 0 : pad('bottom'),
  };

  return (
    <View testID={`screen-${id}`} style={[rootStyle, style]} className={className}>
      {scroll ? (
        <ScrollView {...scrollProps} style={{ flex: 1 }} contentContainerStyle={contentContainerStyle}>
          {children}
          {/* Additive to any caller padding: a spacer the height of the bottom inset. */}
          {pad('bottom') > 0 ? <View testID={`screen-${id}-inset-spacer`} style={{ height: pad('bottom') }} /> : null}
        </ScrollView>
      ) : contentContainerStyle ? (
        <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
      ) : (
        children
      )}
    </View>
  );
}
