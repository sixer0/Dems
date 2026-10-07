/**
 * Navigation shell (step 70; 04_mobile_specs §3; 05_mobile_plan M-03).
 *
 * - `routes`: tab destinations, screen ids, public and guarded paths.
 * - `params`: zod parsing of route and deep-link params; safe internal hrefs.
 * - `pending-href`, `root-navigator`: the auth guard, the boot router and the post-sign-in order.
 * - `session-routes`, `session-guards`: the §3.7 resync table and the session deep-link policies.
 * - `back-guard`: `useBackGuard` + `BackGuardDialog` (§3.6).
 * - `master-detail`: list ↔ detail routing across layout classes (§2.5 rule 3).
 * - `tab-root`: open another tab at its root screen (CF-M2, R-P-3: Settings > Device Settings).
 * - `app-tabs`, `stacks`: the headless tabs with the responsive chrome, and the nested stacks.
 *
 * Route files in `src/app/**` stay thin: they parse params here and render a screen from
 * `src/features/<folder>/`.
 */
export {
  ALL_TABS,
  MORE_TABS,
  PHONE_TABS,
  ROUTE_SCREENS,
  TABLET_TABS,
  TAB_DESTINATIONS,
  activeDestination,
  isGuardedPath,
  tabForSegments,
  type NavLabelKey,
  type RouteAccess,
  type TabDestination,
  type TabHref,
  type TabName,
} from './routes';
export {
  MAX_HREF_LENGTH,
  SETTINGS_SECTIONS,
  firstParam,
  hasMotionParam,
  parseRecordId,
  parseScenario,
  parseSessionStep,
  parseSettingsSection,
  recordIdSchema,
  scenarioSchema,
  sessionStepSchema,
  settingsSectionSchema,
  toInternalHref,
  type InternalHref,
  type RawParams,
  type SessionStep,
  type SettingsSection,
} from './params';
export { SIGN_IN_PATH, clearPendingHref, peekPendingHref, recordIncomingLink, setSignedInSnapshot } from './pending-href';
export {
  isSessionActive,
  isSessionBusy,
  postSignInHref,
  sessionResyncHref,
  type ResyncContext,
  type SessionHref,
} from './session-routes';
export { useSessionLiveRedirect, useSessionNewRedirect } from './session-guards';
export { BootRedirect, RootNavigator, useBootHref } from './root-navigator';
export {
  BackGuardDialog,
  useBackGuard,
  type BackGuard,
  type BackGuardDialogProps,
  type BackGuardDialogVariant,
  type BackGuardMode,
  type BackGuardOptions,
} from './back-guard';
export { useDetailPaneHandover, useSelectionPush, type MasterListPath } from './master-detail';
export { findTabNavigation, tabForHref, useOpenTabRoot } from './tab-root';
export { AppTabs, TAB_TRIGGERS } from './app-tabs';
export { AppStack, AuthStack, DrillInStack, SessionFlowStack } from './stacks';
export { useRailCollapse, type RailCollapse } from './rail-prefs';
export { ScreenStub, type ScreenStubProps, type StubParamValue } from './screen-stub';
export { NotFoundScreen } from './not-found-screen';
export { StackCheckRoute, type StackCheckRouteProps } from './stack-check-route';
export {
  reportNavigationIssue,
  setNavigationLogSink,
  type NavigationLogLevel,
  type NavigationLogRecord,
  type NavigationLogSink,
} from './log';
