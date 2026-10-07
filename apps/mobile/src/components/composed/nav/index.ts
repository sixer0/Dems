// C-5 NavChrome (04_mobile_specs §4.0): the bottom tab bar, the navigation rail and the live
// mini-bar of the navigation shell (step 70). The layout that places them is src/navigation/app-tabs.tsx.
export { BottomTabBar, type BottomTabBarProps } from './bottom-tab-bar';
export { LiveMiniBar, type LiveMiniBarPlacement, type LiveMiniBarProps } from './live-mini-bar';
export { COLOR_FADE_MS, NAV_ICON_SIZE, NavItem, colorFadeBudgetMs, type NavItemLayout, type NavItemProps } from './nav-item';
export { IndicatorTravelLayer, settledBoxStyle, type IndicatorBox, type IndicatorTravelLayerProps } from './indicator-travel';
export { NavRail, RAIL_FOOTER_VERSION, type NavRailProps } from './nav-rail';
export { ResponsiveTabList, type ResponsiveTabListProps } from './responsive-tab-list';
export { INDICATOR_TRAVEL_MS, indicatorTravelBudgetMs, useIndicatorTrack, type IndicatorTrack, type IndicatorTravel } from './use-indicator';
