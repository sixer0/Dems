// C-5 NavChrome (04_mobile_specs §4.0): the bottom tab bar, the navigation rail and the live
// mini-bar of the navigation shell (step 70). The layout that places them is src/navigation/app-tabs.tsx.
export { BottomTabBar, type BottomTabBarProps } from './bottom-tab-bar';
export { LiveMiniBar, elapsedSeconds, type LiveMiniBarPlacement, type LiveMiniBarProps } from './live-mini-bar';
export { NAV_ICON_SIZE, NavItem, type NavItemLayout, type NavItemProps } from './nav-item';
export { NavRail, RAIL_FOOTER_VERSION, type NavRailProps } from './nav-rail';
export { ResponsiveTabList, type ResponsiveTabListProps } from './responsive-tab-list';
export { useIndicatorTrack, type IndicatorTrack } from './use-indicator';
