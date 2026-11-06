import { createContext, useContext, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { motion, spacing } from '@dems/shared/tokens';
import { useMotionPolicy, type MotionPolicy } from '@/motion';
import { useLayoutClass, type LayoutClass } from './use-layout-class';

const { gentle } = motion.spring;

/**
 * Pane re-flow on rotation and split-screen (04_mobile_specs §2.5 item 5, M-MB-03):
 * `LinearTransition` on the `gentle` spring - under FULL motion only (`paneReflowFor`).
 */
export const PANE_REFLOW = LinearTransition.springify()
  .stiffness(gentle.stiffness)
  .damping(gentle.damping)
  .mass(gentle.mass)
  .reduceMotion(ReduceMotion.System);

/**
 * The layout transition of a pane for a motion policy: the spring under full motion, NONE under
 * reduced motion (wave K M1, gate finding G81b-03).
 *
 * The pane used to carry `PANE_REFLOW` always and left "reduced" to `ReduceMotion.System`. On this
 * stack a reduced layout transition is skipped without the new frame being applied (proven on the
 * tablet: `implementation/142_fix_wave_k_m1.md` section 2): a pane whose content grew after its
 * mount - the Session Summary's right pane when "Sealed files" arrives from the Core - kept its old
 * height, its lower content lay outside its box, and Android delivered no touch to "Done", "View in
 * Evidence" and the rows there. With no `layout` prop the platform lays the pane out itself.
 */
export function paneReflowFor(policy: MotionPolicy): typeof PANE_REFLOW | undefined {
  return policy === 'reduced' ? undefined : PANE_REFLOW;
}

/** Gap between panes: 16 dp stacked (phone), 24 dp side by side (design spacing scale, 01S §2.7). */
export const PANE_GAP = { stacked: spacing[3], row: spacing[4] } as const;

interface PaneLayoutContextValue {
  stacked: boolean;
}

const PaneLayoutContext = createContext<PaneLayoutContextValue>({ stacked: true });

/** Whether the nearest `PaneLayout` currently stacks its panes (compact) or lays them side by side. */
export function usePaneStacked(): boolean {
  return useContext(PaneLayoutContext).stacked;
}

export interface PaneLayoutProps {
  children: ReactNode;
  /** Layout classes that stack the panes vertically. Default: `compact` only (04 §2.4). */
  stackOn?: readonly LayoutClass[];
  /** Gap in dp; defaults to `PANE_GAP` for the current arrangement. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_STACK_ON: readonly LayoutClass[] = ['compact'];

/**
 * Multi-pane container (04_mobile_specs §2.4): one column on compact, panes side by side on the
 * wider classes. Children are `Pane`s. Screens pick the pane widths of their §2.4 row, for example
 * Evidence on medium: `<Pane name="list" width={360} />` + `<Pane name="detail" flex={1} />`.
 */
export function PaneLayout({ children, stackOn = DEFAULT_STACK_ON, gap, style, testID }: PaneLayoutProps) {
  const { layoutClass } = useLayoutClass();
  const stacked = stackOn.includes(layoutClass);
  return (
    <PaneLayoutContext.Provider value={{ stacked }}>
      <View
        testID={testID}
        style={[
          {
            flex: 1,
            flexDirection: stacked ? 'column' : 'row',
            alignItems: 'stretch',
            gap: gap ?? (stacked ? PANE_GAP.stacked : PANE_GAP.row),
          },
          style,
        ]}
      >
        {children}
      </View>
    </PaneLayoutContext.Provider>
  );
}

export interface PaneProps {
  /** Pane name; the pane carries `testID="pane-<name>"` (04 §4.0, MA-12). */
  name: string;
  /** Fixed width in dp when side by side (e.g. a 360 dp list). */
  width?: number;
  /** Flex ratio when side by side (e.g. 2 and 3 for a 40% | 60% split). Default 1 when no width. */
  flex?: number;
  /** Minimum width in dp when side by side. */
  minWidth?: number;
  /** Hide this pane while stacked (master-detail: the detail is pushed as its own route on compact). */
  hideWhenStacked?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** One pane of a `PaneLayout`; re-flows with the M-MB-03 spring when the arrangement changes (full motion; `paneReflowFor`). */
export function Pane({ name, width, flex, minWidth, hideWhenStacked = false, style, children }: PaneProps) {
  const stacked = usePaneStacked();
  const policy = useMotionPolicy();
  if (stacked && hideWhenStacked) return null;

  const sizing: ViewStyle = stacked
    ? { alignSelf: 'stretch' }
    : width !== undefined
      ? { width, flexGrow: 0, flexShrink: 0, minWidth }
      : { flex: flex ?? 1, minWidth: minWidth ?? 0 };

  return (
    <Animated.View testID={`pane-${name}`} layout={paneReflowFor(policy)} style={[sizing, style]}>
      {children}
    </Animated.View>
  );
}
