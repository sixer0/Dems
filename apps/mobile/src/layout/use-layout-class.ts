import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Layout classes (04_mobile_specs §2.2), computed from the window size in dp (before insets).
 * The hook re-computes on every dimension change, so rotation and split-screen re-lay out live
 * (D17: orientation is never locked).
 */
export type LayoutClass = 'compact' | 'compact-landscape' | 'medium' | 'expanded';

/** Breakpoints in dp (04_mobile_specs §2.2; 600/840 follow the Android window-size classes). */
export const BREAKPOINTS = {
  /** compact | medium width boundary. */
  medium: 600,
  /** medium | expanded width boundary. */
  expanded: 840,
  /** A window lower than this is a landscape phone, never a multi-pane layout. */
  minPaneHeight: 480,
  /** From this width the expanded class shows the extended (232 dp) rail. */
  extendedRail: 1200,
} as const;

/** Navigation chrome sizes in dp (04_mobile_specs §2.2, §2.3). */
export const NAV_DIMENSIONS = {
  /** Bottom tab bar height, excluding the bottom inset (MB 2 tab bar ≈ 59 dp). */
  bottomBarHeight: 60,
  /** Icon-only rail on a landscape phone. */
  compactRail: 72,
  /** Rail with icon and label (tablet portrait, collapsed extended rail). */
  rail: 88,
  /** Extended rail with inline labels (tablet landscape, W ≥ 1200). */
  extendedRail: 232,
  /** Condensed header on a landscape phone. */
  condensedHeaderHeight: 48,
  /** Content-column header on medium and expanded. */
  headerHeight: 64,
} as const;

export type NavChromeKind = 'bottom-bar' | 'rail';
export type NavLabelMode = 'below' | 'none' | 'inline';

/** The navigation chrome a layout class gets (04_mobile_specs §2.3). */
export interface NavChrome {
  kind: NavChromeKind;
  /** Rail width in dp on the start side; 0 for the bottom bar. */
  railWidth: number;
  /** How labels sit next to the icons. */
  labels: NavLabelMode;
  /** 5 on phones (Home, Sessions, Evidence, Devices, More); 8 on tablets ("More" dissolves). */
  destinations: 5 | 8;
  /** True when the 232 dp extended rail is shown (expanded class, W ≥ 1200, not collapsed). */
  extended: boolean;
}

export interface NavChromeOptions {
  /** The persisted "collapse rail" preference (04 §2.3); only affects the extended rail. */
  railCollapsed?: boolean;
}

/** Pure classifier behind `useLayoutClass` (T-M01). */
export function layoutClassFor(width: number, height: number): LayoutClass {
  if (width < BREAKPOINTS.medium) return 'compact';
  if (height < BREAKPOINTS.minPaneHeight) return 'compact-landscape';
  if (width < BREAKPOINTS.expanded) return 'medium';
  return 'expanded';
}

/** Pure navigation-chrome rule per window size (04_mobile_specs §2.2 "Navigation chrome" column). */
export function navChromeFor(width: number, height: number, options: NavChromeOptions = {}): NavChrome {
  switch (layoutClassFor(width, height)) {
    case 'compact':
      return { kind: 'bottom-bar', railWidth: 0, labels: 'below', destinations: 5, extended: false };
    case 'compact-landscape':
      return { kind: 'rail', railWidth: NAV_DIMENSIONS.compactRail, labels: 'none', destinations: 5, extended: false };
    case 'medium':
      return { kind: 'rail', railWidth: NAV_DIMENSIONS.rail, labels: 'below', destinations: 8, extended: false };
    case 'expanded': {
      const extended = width >= BREAKPOINTS.extendedRail && !options.railCollapsed;
      return extended
        ? { kind: 'rail', railWidth: NAV_DIMENSIONS.extendedRail, labels: 'inline', destinations: 8, extended }
        : { kind: 'rail', railWidth: NAV_DIMENSIONS.rail, labels: 'below', destinations: 8, extended };
    }
  }
}

export interface LayoutInfo {
  layoutClass: LayoutClass;
  /** Window width in dp. */
  width: number;
  /** Window height in dp. */
  height: number;
  /** True for `medium` and `expanded`: screens may show panes side by side (04 §2.4). */
  isMultiPane: boolean;
  nav: NavChrome;
}

/** Current layout class and navigation chrome for the window (04_mobile_specs §2.2). */
export function useLayoutClass(options: NavChromeOptions = {}): LayoutInfo {
  const { width, height } = useWindowDimensions();
  const railCollapsed = options.railCollapsed ?? false;
  return useMemo(() => {
    const layoutClass = layoutClassFor(width, height);
    return {
      layoutClass,
      width,
      height,
      isMultiPane: layoutClass === 'medium' || layoutClass === 'expanded',
      nav: navChromeFor(width, height, { railCollapsed }),
    };
  }, [width, height, railCollapsed]);
}
